import type { z } from 'zod';
import { canonicalJson, sha256 } from './canonical-json.js';
import { enforceOutboundPolicy, type ProcessingPurpose } from './policy.js';
import type { AiProvider, ProviderUsage } from './provider.js';

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
}

export class AiGateway {
  public constructor(private readonly provider: AiProvider) {}

  public async execute<T>(request: GatewayRequest<T>): Promise<GatewayResult<T>> {
    const policy = enforceOutboundPolicy({
      purpose: request.purpose,
      consentPurposes: request.consentPurposes,
      aiProcessingEnabled: request.aiProcessingEnabled,
      text: request.inputText,
    });
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
      input: request.input,
      sourceText: policy.outboundText,
    });
    const approximateTokens = Math.ceil((stablePrefix.length + dynamicInput.length) / 4);
    if (approximateTokens > request.maxInputTokens) throw new Error('BUDGET_EXCEEDED');

    const response = await this.provider.complete({
      model: request.model,
      stablePrefix,
      dynamicInput,
      temperature: 0,
    });
    let decoded: unknown;
    try {
      decoded = JSON.parse(response.content);
    } catch {
      throw new Error('Provider returned invalid JSON');
    }
    const value = request.outputSchema.parse(decoded);
    const cacheTotal = response.usage.cacheHitTokens + response.usage.cacheMissTokens;
    return {
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
        redactions: policy.redactions,
      },
      usage: {
        ...response.usage,
        cacheRatio: cacheTotal === 0 ? 0 : response.usage.cacheHitTokens / cacheTotal,
      },
    };
  }
}
