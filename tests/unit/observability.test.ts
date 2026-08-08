import { describe, expect, it } from 'vitest';
import {
  buildTelemetryEvent,
  metricSample,
  redactTelemetryValue,
} from '../../packages/observability/src/index.js';

describe('observability redaction', () => {
  it('removes content and secret material before event emission', () => {
    const event = buildTelemetryEvent(
      {
        service: 'api',
        environment: 'test',
        requestId: 'request-1',
        action: 'ai.complete',
        outcome: 'blocked',
        durationMs: 4,
      },
      { sourceText: 'private story', token: 'sk-live-fire-secret-value', count: 2 },
      '2026-08-06T00:00:00.000Z',
    );
    expect(event.details).toEqual({
      sourceText: '[CONTENT_REDACTED]',
      token: '[SECRET_REDACTED]',
      count: 2,
    });
  });

  it('supports finite, labelled metrics and bounded recursive redaction', () => {
    expect(redactTelemetryValue({ nested: { prompt: 'hidden' } })).toEqual({
      nested: { prompt: '[CONTENT_REDACTED]' },
    });
    expect(metricSample('ai.cache_ratio', 0.97, 'ratio', { provider: 'deepseek' }).value).toBe(
      0.97,
    );
    expect(() => metricSample('bad', Number.NaN, 'count')).toThrow('finite');
  });

  it('redacts provider-specific keys and secret-bearing object fields', () => {
    expect(
      redactTelemetryValue({ authorization: 'provider-token-fixture', apiKey: 'ordinary-value' }),
    ).toEqual({
      authorization: '[SECRET_REDACTED]',
      apiKey: '[SECRET_REDACTED]',
    });
  });
});
