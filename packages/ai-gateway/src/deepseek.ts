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
}

export class DeepSeekProvider implements AiProvider {
  public readonly name = 'deepseek';
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxAttempts: number;

  public constructor(private readonly config: DeepSeekConfig) {
    if (!config.apiKey.startsWith('sk-')) throw new Error('DeepSeek API key shape is invalid');
    this.#baseUrl = (config.baseUrl ?? 'https://api.deepseek.com').replace(/\/$/u, '');
    this.#timeoutMs = config.timeoutMs ?? 30_000;
    this.#maxAttempts = config.maxAttempts ?? 3;
  }

  public async complete(
    request: ProviderRequest,
    parentSignal?: AbortSignal,
  ): Promise<ProviderResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      const timeout = AbortSignal.timeout(this.#timeoutMs);
      const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
      try {
        const response = await fetch(`${this.#baseUrl}/chat/completions`, {
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
        if (signal.aborted || attempt === this.#maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('DeepSeek provider unavailable');
  }
}
