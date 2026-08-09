import { describe, expect, it } from 'vitest';
import { DeepSeekProvider } from '../../../packages/ai-gateway/src/index.js';
import type { DeepSeekProviderError } from '../../../packages/ai-gateway/src/index.js';

const request = {
  model: 'deepseek-chat',
  stablePrefix: 'policy',
  dynamicInput: 'source',
  temperature: 0,
};

describe('DeepSeek provider response boundaries', () => {
  it('rejects declared responses above the bounded JSON budget', async () => {
    const provider = new DeepSeekProvider({
      apiKey: 'sk-test-key',
      maxAttempts: 1,
      fetchImpl: () =>
        Promise.resolve(
          new Response('{}', {
            status: 200,
            headers: { 'content-length': String(8 * 1024 * 1024 + 1) },
          }),
        ),
    });
    await expect(provider.complete(request)).rejects.toThrow(
      'DeepSeek response exceeds the allowed size',
    );

    const unbounded = new DeepSeekProvider({
      apiKey: 'sk-test-key',
      maxAttempts: 1,
      fetchImpl: () => Promise.resolve(new Response(null, { status: 200 })),
    });
    await expect(unbounded.complete(request)).rejects.toThrow(
      'DeepSeek response has no bounded body length',
    );
  });

  it('parses a bounded valid response normally', async () => {
    const provider = new DeepSeekProvider({
      apiKey: 'sk-test-key',
      maxAttempts: 1,
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'request-1',
              choices: [{ message: { content: '{"claims":[]}' } }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            }),
            { status: 200 },
          ),
        ),
    });
    await expect(provider.complete(request)).resolves.toMatchObject({
      content: '{"claims":[]}',
      providerRequestId: 'request-1',
    });
  });

  it('normalizes malformed provider responses without retrying them', async () => {
    let calls = 0;
    const provider = new DeepSeekProvider({
      apiKey: 'sk-test-key',
      maxAttempts: 3,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'request-1', choices: [{ message: { content: 1 } }] })),
        );
      },
    });
    await expect(provider.complete(request)).rejects.toMatchObject({
      name: 'DeepSeekProviderError',
      message: 'DeepSeek returned an invalid response',
      retryable: false,
    } satisfies Partial<DeepSeekProviderError>);
    expect(calls).toBe(1);
  });

  it('cancels failed upstream response bodies before retry or surfacing the error', async () => {
    let cancelled = false;
    const provider = new DeepSeekProvider({
      apiKey: 'sk-test-key',
      maxAttempts: 1,
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"error":"upstream"}'));
              },
              cancel() {
                cancelled = true;
              },
            }),
            { status: 503 },
          ),
        ),
    });
    await expect(provider.complete(request)).rejects.toThrow(
      'DeepSeek request failed with status 503',
    );
    expect(cancelled).toBe(true);
  });
});
