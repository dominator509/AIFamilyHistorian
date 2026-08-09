import type { z } from 'zod';
import { canonicalJson, sha256 } from './canonical-json.js';
import {
  containsPromptInjection,
  enforceOutboundPolicy,
  sanitizeOutboundValue,
  ProviderPolicyError,
  type ProcessingPurpose,
} from './policy.js';
import type { AiProvider, ProviderUsage } from './provider.js';

export const MAX_AI_CACHE_VALUE_BYTES = 16 * 1024 * 1024;
/** Keep direct gateway callers from redacting or serializing unbounded source text. */
export const MAX_AI_INPUT_TEXT_BYTES = 4 * 1024 * 1024;
/** Generic providers must not return an arbitrarily large structured response. */
export const MAX_AI_PROVIDER_CONTENT_BYTES = 8 * 1024 * 1024;
const MAX_AI_PROVIDER_METADATA_CHARS = 512;
const MAX_AI_PROVIDER_USAGE_TOKENS = 1_000_000_000;

export interface GatewayRequest<T> {
  organizationId: string;
  familyArchiveId: string;
  purpose: ProcessingPurpose;
  consentPurposes: readonly ProcessingPurpose[];
  aiProcessingEnabled: boolean;
  promptFamily: string;
  promptVersion: string;
  policyVersion: string;
  model: string;
  input: unknown;
  inputText: string;
  outputSchema: z.ZodType<T>;
  maxInputTokens: number;
}

export interface GatewayResult<T> {
  value: T;
  provenance: {
    provider: string;
    providerRequestId?: string;
    model: string;
    promptFamily: string;
    promptVersion: string;
    policyVersion: string;
    inputHash: string;
    stablePrefixHash: string;
    redactions: number;
  };
  usage: ProviderUsage & { cacheRatio: number };
  applicationCacheHit?: boolean;
}

export interface AiResultCache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete?(key: string): Promise<void>;
}

export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del?(key: string): Promise<unknown>;
}

/** JSON-only Redis adapter; callers must provide a private, access-controlled Redis client. */
export class RedisAiResultCache implements AiResultCache {
  public constructor(private readonly client: RedisCacheClient) {}

  public async get(key: string): Promise<unknown> {
    const encoded = await this.client.get(key);
    if (encoded === null) return undefined;
    if (Buffer.byteLength(encoded, 'utf8') > MAX_AI_CACHE_VALUE_BYTES) {
      await this.delete(key);
      return undefined;
    }
    try {
      return JSON.parse(encoded) as unknown;
    } catch {
      await this.delete(key);
      return undefined;
    }
  }

  public async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 86_400)
      throw new Error('AI cache TTL is outside the allowed range');
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('AI cache value is not serializable');
    if (Buffer.byteLength(encoded, 'utf8') > MAX_AI_CACHE_VALUE_BYTES)
      throw new Error('AI cache value exceeds the allowed size');
    await this.client.set(key, encoded, 'EX', ttlSeconds);
  }

  public async delete(key: string): Promise<void> {
    if (this.client.del) await this.client.del(key);
  }
}

function isValidCachedResult(value: unknown): value is GatewayResult<unknown> {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const provenance = candidate.provenance;
  const usage = candidate.usage;
  if (provenance === null || typeof provenance !== 'object') return false;
  if (usage === null || typeof usage !== 'object') return false;
  const p = provenance as Record<string, unknown>;
  const u = usage as Record<string, unknown>;
  const usageValues = [u.inputTokens, u.outputTokens, u.cacheHitTokens, u.cacheMissTokens];
  return (
    Object.prototype.hasOwnProperty.call(candidate, 'value') &&
    typeof p.provider === 'string' &&
    (!('providerRequestId' in p) || typeof p.providerRequestId === 'string') &&
    typeof p.model === 'string' &&
    typeof p.promptFamily === 'string' &&
    typeof p.promptVersion === 'string' &&
    typeof p.policyVersion === 'string' &&
    typeof p.inputHash === 'string' &&
    typeof p.stablePrefixHash === 'string' &&
    Number.isInteger(p.redactions) &&
    (p.redactions as number) >= 0 &&
    usageValues.every((entry) => Number.isInteger(entry) && (entry as number) >= 0) &&
    typeof u.cacheRatio === 'number' &&
    Number.isFinite(u.cacheRatio) &&
    u.cacheRatio >= 0 &&
    u.cacheRatio <= 1
  );
}

export interface AiGatewayOptions {
  readonly cache?: AiResultCache;
  readonly cacheTtlSeconds?: number;
}

export class AiGateway {
  public constructor(
    private readonly provider: AiProvider,
    private readonly options: AiGatewayOptions = {},
  ) {
    const ttl = options.cacheTtlSeconds ?? 300;
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 86_400)
      throw new Error('AI cache TTL is outside the allowed range');
  }

  public async execute<T>(request: GatewayRequest<T>): Promise<GatewayResult<T>> {
    if (
      !Number.isSafeInteger(request.maxInputTokens) ||
      request.maxInputTokens < 1 ||
      request.maxInputTokens > 1_000_000
    )
      throw new Error('AI input budget is invalid');
    if (
      typeof request.inputText !== 'string' ||
      Buffer.byteLength(request.inputText, 'utf8') > MAX_AI_INPUT_TEXT_BYTES
    )
      throw new Error('AI input text exceeds the allowed size');
    const policy = enforceOutboundPolicy({
      purpose: request.purpose,
      consentPurposes: request.consentPurposes,
      aiProcessingEnabled: request.aiProcessingEnabled,
      text: request.inputText,
    });
    const inputJson = canonicalJson(request.input);
    if (containsPromptInjection(inputJson))
      throw new ProviderPolicyError(
        'PROVIDER_POLICY_REJECTED',
        'Prompt-injection content cannot cross the provider boundary',
      );
    const sanitizedInput = sanitizeOutboundValue(request.input);
    const stablePrefix = canonicalJson({
      contract: 'AI Family Historian evidence-only structured output',
      policyVersion: request.policyVersion,
      promptFamily: request.promptFamily,
      promptVersion: request.promptVersion,
      rules: [
        'Return one JSON object matching the requested schema.',
        'Do not invent facts or quotations.',
        'Mark interpretation explicitly.',
        'Every factual claim must reference supplied evidence.',
      ],
    });
    const dynamicInput = canonicalJson({
      organizationScope: sha256(request.organizationId),
      archiveScope: sha256(request.familyArchiveId),
      input: sanitizedInput.value,
      sourceText: policy.outboundText,
    });
    const cacheKey = `ai-result:v1:${sha256(
      canonicalJson({
        provider: this.provider.name,
        organizationScope: sha256(request.organizationId),
        archiveScope: sha256(request.familyArchiveId),
        purpose: request.purpose,
        promptFamily: request.promptFamily,
        promptVersion: request.promptVersion,
        policyVersion: request.policyVersion,
        model: request.model,
        stablePrefix,
        dynamicInput,
      }),
    )}`;
    if (this.options.cache) {
      const cached = await this.options.cache.get(cacheKey);
      if (isValidCachedResult(cached)) {
        try {
          const value = request.outputSchema.parse(cached.value);
          return {
            ...cached,
            value,
            applicationCacheHit: true,
          };
        } catch {
          await this.options.cache.delete?.(cacheKey);
        }
      }
    }
    const approximateTokens = Math.ceil((stablePrefix.length + dynamicInput.length) / 4);
    if (approximateTokens > request.maxInputTokens) throw new Error('BUDGET_EXCEEDED');

    const response = await this.provider.complete({
      model: request.model,
      stablePrefix,
      dynamicInput,
      temperature: 0,
    });
    if (
      response === null ||
      typeof response !== 'object' ||
      typeof response.content !== 'string' ||
      Buffer.byteLength(response.content, 'utf8') > MAX_AI_PROVIDER_CONTENT_BYTES ||
      (response.providerRequestId !== undefined &&
        (typeof response.providerRequestId !== 'string' ||
          response.providerRequestId.length > MAX_AI_PROVIDER_METADATA_CHARS))
    )
      throw new Error('Provider returned an invalid response');
    const usageValues = [
      response.usage?.inputTokens,
      response.usage?.outputTokens,
      response.usage?.cacheHitTokens,
      response.usage?.cacheMissTokens,
    ];
    if (
      !response.usage ||
      usageValues.some(
        (value) =>
          !Number.isSafeInteger(value) || value < 0 || value > MAX_AI_PROVIDER_USAGE_TOKENS,
      )
    )
      throw new Error('Provider returned invalid usage telemetry');
    let decoded: unknown;
    try {
      decoded = JSON.parse(response.content);
    } catch {
      throw new Error('Provider returned invalid JSON');
    }
    const value = request.outputSchema.parse(decoded);
    const cacheTotal = response.usage.cacheHitTokens + response.usage.cacheMissTokens;
    const result: GatewayResult<T> = {
      value,
      provenance: {
        provider: this.provider.name,
        ...(response.providerRequestId ? { providerRequestId: response.providerRequestId } : {}),
        model: request.model,
        promptFamily: request.promptFamily,
        promptVersion: request.promptVersion,
        policyVersion: request.policyVersion,
        inputHash: sha256(dynamicInput),
        stablePrefixHash: sha256(stablePrefix),
        redactions: policy.redactions + sanitizedInput.redactions,
      },
      usage: {
        ...response.usage,
        cacheRatio: cacheTotal === 0 ? 0 : response.usage.cacheHitTokens / cacheTotal,
      },
    };
    if (this.options.cache)
      await this.options.cache.set(cacheKey, result, this.options.cacheTtlSeconds ?? 300);
    return result;
  }
}
