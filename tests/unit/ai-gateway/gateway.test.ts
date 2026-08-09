import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AiGateway,
  MAX_AI_CACHE_VALUE_BYTES,
  RedisAiResultCache,
  type AiProvider,
  type ProviderRequest,
  type ProviderResponse,
} from '../../../packages/ai-gateway/src/index.js';

class RecordingProvider implements AiProvider {
  public readonly name = 'test-double';
  public requests: ProviderRequest[] = [];
  public constructor(private readonly content: string) {}
  public complete(request: ProviderRequest): Promise<ProviderResponse> {
    this.requests.push(request);
    return Promise.resolve({
      content: this.content,
      providerRequestId: 'test-request',
      usage: { inputTokens: 100, outputTokens: 10, cacheHitTokens: 60, cacheMissTokens: 40 },
    });
  }
}

class MemoryCache {
  public readonly values = new Map<string, unknown>();
  public get(key: string): Promise<unknown> {
    return Promise.resolve(this.values.get(key));
  }
  public set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
  public delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

describe('AI gateway', () => {
  it('bounds Redis cache envelopes before parsing or writing', async () => {
    const values = new Map<string, string>();
    const client = {
      get: (key: string) => Promise.resolve(values.get(key) ?? null),
      set: (key: string, value: string) => {
        values.set(key, value);
        return Promise.resolve('OK');
      },
      del: (key: string) => {
        values.delete(key);
        return Promise.resolve(1);
      },
    };
    const cache = new RedisAiResultCache(client);
    const oversized = 'x'.repeat(MAX_AI_CACHE_VALUE_BYTES + 1);
    values.set('oversized', JSON.stringify(oversized));
    await expect(cache.get('oversized')).resolves.toBeUndefined();
    expect(values.has('oversized')).toBe(false);
    await expect(cache.set('write-oversized', oversized, 60)).rejects.toThrow(
      'AI cache value exceeds the allowed size',
    );
    expect(values.has('write-oversized')).toBe(false);
  });

  it('validates structured output and records deterministic provenance and cache usage', async () => {
    const provider = new RecordingProvider('{"claims":[]}');
    const gateway = new AiGateway(provider);
    const result = await gateway.execute({
      organizationId: '01900000-0000-7000-8000-000000000001',
      familyArchiveId: '01900000-0000-7000-8000-000000000002',
      purpose: 'chapter_drafting',
      consentPurposes: ['chapter_drafting'],
      aiProcessingEnabled: true,
      promptFamily: 'chapter-draft',
      promptVersion: '1',
      policyVersion: '1',
      model: 'deepseek-chat',
      input: { evidenceIds: [] },
      inputText: 'No factual claims are supplied.',
      outputSchema: z.object({ claims: z.array(z.never()) }),
      maxInputTokens: 2_000,
    });
    expect(result.value.claims).toEqual([]);
    expect(result.usage.cacheRatio).toBe(0.6);
    expect(result.provenance).toMatchObject({
      provider: 'test-double',
      promptFamily: 'chapter-draft',
      redactions: 0,
    });
    expect(provider.requests[0]?.temperature).toBe(0);
  });

  it('never accepts malformed or schema-invalid provider output', async () => {
    const base = {
      organizationId: '01900000-0000-7000-8000-000000000001',
      familyArchiveId: '01900000-0000-7000-8000-000000000002',
      purpose: 'fact_extraction' as const,
      consentPurposes: ['fact_extraction' as const],
      aiProcessingEnabled: true,
      promptFamily: 'facts',
      promptVersion: '1',
      policyVersion: '1',
      model: 'deepseek-chat',
      input: {},
      inputText: 'source',
      outputSchema: z.object({ claims: z.array(z.string()) }),
      maxInputTokens: 2_000,
    };
    await expect(new AiGateway(new RecordingProvider('not json')).execute(base)).rejects.toThrow(
      /invalid JSON/u,
    );
    await expect(
      new AiGateway(new RecordingProvider('{"unexpected":true}')).execute(base),
    ).rejects.toThrow();
  });

  it('redacts provider credentials before outbound policy evaluation', async () => {
    const provider = new RecordingProvider('{"claims":[]}');
    const gateway = new AiGateway(provider);
    const providerCredential = ['re', 'test_fixture_123456'].join('_');
    await gateway.execute({
      organizationId: '01900000-0000-7000-8000-000000000001',
      familyArchiveId: '01900000-0000-7000-8000-000000000002',
      purpose: 'chapter_drafting',
      consentPurposes: ['chapter_drafting'],
      aiProcessingEnabled: true,
      promptFamily: 'chapter-drafting',
      promptVersion: '1',
      policyVersion: '1',
      model: 'deepseek-chat',
      input: { note: providerCredential },
      inputText: `A provider token ${providerCredential} appeared in source.`,
      outputSchema: z.object({ claims: z.array(z.never()) }),
      maxInputTokens: 2_000,
    });
    expect(provider.requests[0]?.dynamicInput).not.toContain(providerCredential);
    expect(provider.requests[0]?.dynamicInput).toContain('[REDACTED]');
  });

  it('uses a deterministic tenant-isolated exact-result cache after schema validation', async () => {
    const provider = new RecordingProvider('{"claims":[]}');
    const cache = new MemoryCache();
    const gateway = new AiGateway(provider, { cache });
    const base = {
      organizationId: '01900000-0000-7000-8000-000000000001',
      familyArchiveId: '01900000-0000-7000-8000-000000000002',
      purpose: 'chapter_drafting' as const,
      consentPurposes: ['chapter_drafting' as const],
      aiProcessingEnabled: true,
      promptFamily: 'chapter-drafting',
      promptVersion: '1',
      policyVersion: '1',
      model: 'deepseek-chat',
      input: { evidenceIds: [] },
      inputText: 'No factual claims are supplied.',
      outputSchema: z.object({ claims: z.array(z.never()) }),
      maxInputTokens: 2_000,
    };
    await gateway.execute(base);
    const cached = await gateway.execute(base);
    expect(cached.applicationCacheHit).toBe(true);
    expect(provider.requests).toHaveLength(1);
    await gateway.execute({ ...base, organizationId: '01900000-0000-7000-8000-000000000003' });
    expect(provider.requests).toHaveLength(2);
  });

  it('discards cache envelopes with invalid provenance or usage telemetry', async () => {
    const provider = new RecordingProvider('{"claims":[]}');
    const cache = new MemoryCache();
    const gateway = new AiGateway(provider, { cache });
    const base = {
      organizationId: '01900000-0000-7000-8000-000000000001',
      familyArchiveId: '01900000-0000-7000-8000-000000000002',
      purpose: 'chapter_drafting' as const,
      consentPurposes: ['chapter_drafting' as const],
      aiProcessingEnabled: true,
      promptFamily: 'chapter-drafting',
      promptVersion: '1',
      policyVersion: '1',
      model: 'deepseek-chat',
      input: { evidenceIds: [] },
      inputText: 'No factual claims are supplied.',
      outputSchema: z.object({ claims: z.array(z.never()) }),
      maxInputTokens: 2_000,
    };
    await gateway.execute(base);
    const key = [...cache.values.keys()][0]!;
    const stored = cache.values.get(key) as Record<string, unknown>;
    cache.values.set(key, {
      ...stored,
      usage: { ...(stored.usage as Record<string, unknown>), cacheRatio: 4 },
    });
    const result = await gateway.execute(base);
    expect(result.applicationCacheHit).not.toBe(true);
    expect(provider.requests).toHaveLength(2);
    expect(cache.values.get(key)).toMatchObject({ usage: { cacheRatio: 0.6 } });
  });

  it('rejects invalid input budgets before contacting the provider', async () => {
    const provider = new RecordingProvider('{"claims":[]}');
    const gateway = new AiGateway(provider);
    const base = {
      organizationId: '01900000-0000-7000-8000-000000000001',
      familyArchiveId: '01900000-0000-7000-8000-000000000002',
      purpose: 'chapter_drafting' as const,
      consentPurposes: ['chapter_drafting' as const],
      aiProcessingEnabled: true,
      promptFamily: 'chapter-drafting',
      promptVersion: '1',
      policyVersion: '1',
      model: 'deepseek-chat',
      input: {},
      inputText: 'source',
      outputSchema: z.object({ claims: z.array(z.never()) }),
    };
    await expect(gateway.execute({ ...base, maxInputTokens: Number.NaN })).rejects.toThrow(
      'AI input budget is invalid',
    );
    await expect(gateway.execute({ ...base, maxInputTokens: 0 })).rejects.toThrow(
      'AI input budget is invalid',
    );
    expect(provider.requests).toHaveLength(0);
  });
});
