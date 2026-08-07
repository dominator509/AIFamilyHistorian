import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AiGateway,
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

describe('AI gateway', () => {
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
});
