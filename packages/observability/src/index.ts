const SECRET_PATTERN = /\b(?:sk|pk|rk|whsec|re|dg|gsk)[_-][A-Za-z0-9_.-]{12,}\b/gu;
const PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const CONTENT_KEYS = new Set([
  'content',
  'inputText',
  'sourceText',
  'prompt',
  'promptText',
  'responseText',
  'transcript',
  'plaintext',
  'body',
]);
const SENSITIVE_KEYS = new Set([
  'authorization',
  'apiKey',
  'accessKeyId',
  'secretAccessKey',
  'secret',
  'token',
  'password',
  'dsn',
]);

const normalizeTelemetryKey = (key: string): string =>
  key.replace(/[^a-z0-9]/giu, '').toLowerCase();
const NORMALIZED_CONTENT_KEYS = new Set([...CONTENT_KEYS].map(normalizeTelemetryKey));
const NORMALIZED_SENSITIVE_KEYS = new Set([...SENSITIVE_KEYS].map(normalizeTelemetryKey));

export interface TelemetryContext {
  readonly service: string;
  readonly environment: string;
  readonly requestId: string;
  readonly traceId?: string;
  readonly tenantPseudonym?: string;
  readonly actorPseudonym?: string;
  readonly action: string;
  readonly outcome: string;
  readonly durationMs: number;
  readonly policyDecision?: string;
  readonly errorClass?: string;
}

export interface TelemetryEvent extends TelemetryContext {
  readonly timestamp: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface MetricSample {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly recordedAt: string;
}

export function redactTelemetryValue(value: unknown, key?: string, depth = 0): unknown {
  if (depth > 8) return '[REDACTED_DEPTH]';
  const normalizedKey = key ? normalizeTelemetryKey(key) : undefined;
  if (normalizedKey && NORMALIZED_CONTENT_KEYS.has(normalizedKey)) return '[CONTENT_REDACTED]';
  if (normalizedKey && NORMALIZED_SENSITIVE_KEYS.has(normalizedKey)) return '[SECRET_REDACTED]';
  if (typeof value === 'string')
    return value
      .replaceAll(PRIVATE_KEY_PATTERN, '[SECRET_REDACTED]')
      .replaceAll(SECRET_PATTERN, '[SECRET_REDACTED]')
      .replaceAll(EMAIL_PATTERN, '[IDENTIFIER_REDACTED]');
  if (Array.isArray(value))
    return value.map((item) => redactTelemetryValue(item, undefined, depth + 1));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value))
      Object.defineProperty(result, childKey, {
        configurable: true,
        enumerable: true,
        value: redactTelemetryValue(childValue, childKey, depth + 1),
        writable: true,
      });
    return result;
  }
  return value;
}

export function buildTelemetryEvent(
  context: TelemetryContext,
  details: Readonly<Record<string, unknown>> = {},
  timestamp = new Date().toISOString(),
): TelemetryEvent {
  if (!Number.isFinite(context.durationMs) || context.durationMs < 0)
    throw new Error('durationMs must be a nonnegative finite number');
  return Object.freeze({
    ...context,
    timestamp,
    details: Object.freeze(redactTelemetryValue(details) as Record<string, unknown>),
  });
}

export function metricSample(
  name: string,
  value: number,
  unit: string,
  labels: Readonly<Record<string, string>> = {},
  recordedAt = new Date().toISOString(),
): MetricSample {
  if (!name.trim() || !unit.trim()) throw new Error('metric name and unit are required');
  if (!Number.isFinite(value)) throw new Error('metric value must be finite');
  return Object.freeze({ name, value, unit, labels: Object.freeze({ ...labels }), recordedAt });
}
