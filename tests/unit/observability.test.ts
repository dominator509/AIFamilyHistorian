import { describe, expect, it } from 'vitest';
import {
  buildTelemetryEvent,
  MAX_TELEMETRY_LABELS,
  MAX_TELEMETRY_METRIC_NAME_CHARS,
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

  it('normalizes telemetry keys and preserves special object keys safely', () => {
    const input = JSON.parse(
      '{"Authorization":"provider-token-fixture","API_KEY":"ordinary-value","source_text":"private story","__proto__":"not-a-prototype"}',
    ) as Record<string, unknown>;
    const redacted = redactTelemetryValue(input) as Record<string, unknown>;
    expect(redacted).toEqual(
      JSON.parse(
        '{"Authorization":"[SECRET_REDACTED]","API_KEY":"[SECRET_REDACTED]","source_text":"[CONTENT_REDACTED]","__proto__":"not-a-prototype"}',
      ),
    );
    expect(Object.prototype.hasOwnProperty.call(redacted, '__proto__')).toBe(true);
  });

  it('fails closed on oversized telemetry values and collections', () => {
    expect(redactTelemetryValue('x'.repeat(16_385))).toBe('[REDACTED_LIMIT]');
    expect(redactTelemetryValue(Array.from({ length: 1_001 }, () => 'value'))).toBe(
      '[REDACTED_LIMIT]',
    );
    const oversizedObject = Object.fromEntries(
      Array.from({ length: 1_001 }, (_, index) => [`field-${index}`, 'value']),
    );
    expect(redactTelemetryValue(oversizedObject)).toBe('[REDACTED_LIMIT]');
  });

  it('bounds metric labels, metric names, context fields, and timestamps', () => {
    expect(() => metricSample('x'.repeat(MAX_TELEMETRY_METRIC_NAME_CHARS + 1), 1, 'count')).toThrow(
      'metric name and unit are invalid',
    );
    expect(() =>
      metricSample(
        'bounded',
        1,
        'count',
        Object.fromEntries(
          Array.from({ length: MAX_TELEMETRY_LABELS + 1 }, (_, i) => [`k${i}`, 'v']),
        ),
      ),
    ).toThrow('metric labels exceed the allowed count');
    expect(() =>
      buildTelemetryEvent(
        {
          service: 'api',
          environment: 'test',
          requestId: 'x'.repeat(513),
          action: 'test',
          outcome: 'ok',
          durationMs: 1,
        },
        {},
        'not-a-timestamp',
      ),
    ).toThrow('telemetry context field is invalid');
    expect(() =>
      buildTelemetryEvent(
        {
          service: 'api',
          environment: 'test',
          requestId: 'request-1',
          action: 'test',
          outcome: 'ok',
          durationMs: 1,
        },
        {},
        'not-a-timestamp',
      ),
    ).toThrow('telemetry timestamp is invalid');
  });
});
