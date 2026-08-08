import { z } from 'zod';
import type { AiProvider, ProviderRequest, ProviderResponse } from './provider.js';

const responseSchema = z.object({
  id: z.string().min(1),
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
      prompt_cache_hit_tokens: z.number().int().nonnegative().optional(),
      prompt_cache_miss_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  circuitFailureThreshold?: number;
  circuitCooldownMs?: number;
  fetchImpl?: typeof fetch;
}

export class DeepSeekProvider implements AiProvider {
  public readonly name = 'deepseek';
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxAttempts: number;
  readonly #circuitFailureThreshold: number;
  readonly #circuitCooldownMs: number;
  readonly #fetchImpl: typeof fetch;
  #circuitFailures = 0;
  #circuitOpenUntil = 0;

  public constructor(private readonly config: DeepSeekConfig) {
    if (!config.apiKey.startsWith('sk-')) throw new Error('DeepSeek API key shape is invalid');
    const baseUrl = config.baseUrl ?? 'https://api.deepseek.com';
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new Error('DeepSeek endpoint is invalid');
    }
    const loopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback))
      throw new Error('DeepSeek endpoint must use HTTPS');
    if (parsed.username || parsed.password || parsed.search || parsed.hash)
      throw new Error('DeepSeek endpoint contains unsupported URL components');
    const timeoutMs = config.timeoutMs ?? 30_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000)
      throw new Error('DeepSeek timeout is outside the allowed range');
    const maxAttempts = config.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5)
      throw new Error('DeepSeek retry count is outside the allowed range');
    const circuitFailureThreshold = config.circuitFailureThreshold ?? 5;
    if (
      !Number.isInteger(circuitFailureThreshold) ||
      circuitFailureThreshold < 1 ||
      circuitFailureThreshold > 20
    )
      throw new Error('DeepSeek circuit failure threshold is outside the allowed range');
    const circuitCooldownMs = config.circuitCooldownMs ?? 30_000;
    if (
      !Number.isInteger(circuitCooldownMs) ||
      circuitCooldownMs < 1_000 ||
      circuitCooldownMs > 300_000
    )
      throw new Error('DeepSeek circuit cooldown is outside the allowed range');
    this.#baseUrl = parsed.toString().replace(/\/$/u, '');
    this.#timeoutMs = timeoutMs;
    this.#maxAttempts = maxAttempts;
    this.#circuitFailureThreshold = circuitFailureThreshold;
    this.#circuitCooldownMs = circuitCooldownMs;
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  public async complete(
    request: ProviderRequest,
    parentSignal?: AbortSignal,
  ): Promise<ProviderResponse> {
    if (this.#circuitOpenUntil > Date.now()) throw new Error('DeepSeek circuit is open');
    let lastError: unknown;
    let retryableFailure = false;
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      const timeout = AbortSignal.timeout(this.#timeoutMs);
      const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
      try {
        const response = await this.#fetchImpl(`${this.#baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.config.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: request.model,
            messages: [
              { role: 'system', content: request.stablePrefix },
              { role: 'user', content: request.dynamicInput },
            ],
            temperature: request.temperature,
            response_format: { type: 'json_object' },
            stream: false,
          }),
          signal,
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          retryableFailure = retryable;
          if (!retryable || attempt === this.#maxAttempts) {
            lastError = new Error(`DeepSeek request failed with status ${response.status}`);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, attempt * 250));
          continue;
        }
        const parsed = responseSchema.parse(await response.json());
        const usage = parsed.usage;
        return {
          content: parsed.choices[0]?.message.content ?? '',
          providerRequestId: parsed.id,
          usage: {
            inputTokens: usage?.prompt_tokens ?? 0,
            outputTokens: usage?.completion_tokens ?? 0,
            cacheHitTokens: usage?.prompt_cache_hit_tokens ?? 0,
            cacheMissTokens: usage?.prompt_cache_miss_tokens ?? 0,
          },
        };
      } catch (error) {
        lastError = error;
        retryableFailure = true;
        if (signal.aborted || attempt === this.#maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
    if (retryableFailure) {
      this.#circuitFailures += 1;
      if (this.#circuitFailures >= this.#circuitFailureThreshold)
        this.#circuitOpenUntil = Date.now() + this.#circuitCooldownMs;
    }
    throw lastError instanceof Error ? lastError : new Error('DeepSeek provider unavailable');
  }
}
