import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { DeepSeekProvider } from '../../../packages/ai-gateway/src/index.js';

describe('DeepSeek adapter contract', () => {
  const servers: ReturnType<typeof createServer>[] = [];
  afterEach(async () => {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    servers.length = 0;
  });

  it('constructs the authenticated official chat-completions request and validates usage', async () => {
    let authorization = '';
    let body: unknown;
    const server = createServer((request, response) => {
      authorization = request.headers.authorization ?? '';
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            id: 'provider-request',
            choices: [{ message: { content: '{"claims":[]}' } }],
            usage: {
              prompt_tokens: 20,
              completion_tokens: 4,
              prompt_cache_hit_tokens: 12,
              prompt_cache_miss_tokens: 8,
            },
          }),
        );
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string')
      throw new Error('test server address missing');
    const provider = new DeepSeekProvider({
      apiKey: 'sk-test-contract-key-000000000000',
      baseUrl: `http://127.0.0.1:${address.port}`,
      maxAttempts: 1,
    });
    const result = await provider.complete({
      model: 'deepseek-chat',
      stablePrefix: 'stable',
      dynamicInput: 'dynamic',
      temperature: 0,
    });
    expect(authorization).toBe('Bearer sk-test-contract-key-000000000000');
    expect(body).toMatchObject({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      stream: false,
    });
    expect(result).toMatchObject({
      content: '{"claims":[]}',
      providerRequestId: 'provider-request',
      usage: { cacheHitTokens: 12, cacheMissTokens: 8 },
    });
  });

  it('opens a circuit after bounded retryable failures', async () => {
    let calls = 0;
    const provider = new DeepSeekProvider({
      apiKey: 'sk-test-circuit-key-000000000000',
      baseUrl: 'http://127.0.0.1:1',
      maxAttempts: 1,
      circuitFailureThreshold: 2,
      circuitCooldownMs: 60_000,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(new Response('{}', { status: 503 }));
      },
    });
    const request = {
      model: 'deepseek-chat',
      stablePrefix: 'stable',
      dynamicInput: 'dynamic',
      temperature: 0,
    };
    await expect(provider.complete(request)).rejects.toThrow(/status 503/u);
    await expect(provider.complete(request)).rejects.toThrow(/status 503/u);
    await expect(provider.complete(request)).rejects.toThrow('DeepSeek circuit is open');
    expect(calls).toBe(2);
  });
});
