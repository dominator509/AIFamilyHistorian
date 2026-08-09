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

export const MAX_TELEMETRY_DEPTH = 8;
export const MAX_TELEMETRY_COLLECTION_ITEMS = 1_000;
export const MAX_TELEMETRY_STRING_CHARS = 16_384;
export const MAX_TELEMETRY_CONTEXT_CHARS = 512;
export const MAX_TELEMETRY_METRIC_NAME_CHARS = 256;
export const MAX_TELEMETRY_METRIC_UNIT_CHARS = 64;
export const MAX_TELEMETRY_LABELS = 100;
export const MAX_TELEMETRY_LABEL_KEY_CHARS = 128;
export const MAX_TELEMETRY_LABEL_VALUE_CHARS = 512;

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
  if (depth > MAX_TELEMETRY_DEPTH) return '[REDACTED_DEPTH]';
  const normalizedKey = key ? normalizeTelemetryKey(key) : undefined;
  if (normalizedKey && NORMALIZED_CONTENT_KEYS.has(normalizedKey)) return '[CONTENT_REDACTED]';
  if (normalizedKey && NORMALIZED_SENSITIVE_KEYS.has(normalizedKey)) return '[SECRET_REDACTED]';
  if (typeof value === 'string') {
    const redacted = value
      .replaceAll(PRIVATE_KEY_PATTERN, '[SECRET_REDACTED]')
      .replaceAll(SECRET_PATTERN, '[SECRET_REDACTED]')
      .replaceAll(EMAIL_PATTERN, '[IDENTIFIER_REDACTED]');
    return redacted.length > MAX_TELEMETRY_STRING_CHARS ? '[REDACTED_LIMIT]' : redacted;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_TELEMETRY_COLLECTION_ITEMS) return '[REDACTED_LIMIT]';
    return value.map((item) => redactTelemetryValue(item, undefined, depth + 1));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > MAX_TELEMETRY_COLLECTION_ITEMS) return '[REDACTED_LIMIT]';
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of entries)
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
  for (const [field, value] of Object.entries(context)) {
    if (field === 'durationMs' || value === undefined) continue;
    if (typeof value !== 'string' || value.length > MAX_TELEMETRY_CONTEXT_CHARS)
      throw new Error('telemetry context field is invalid');
  }
  if (!Number.isNaN(Date.parse(timestamp)) && timestamp.length <= MAX_TELEMETRY_CONTEXT_CHARS) {
    // Timestamp is intentionally accepted in any parseable RFC-compatible form.
  } else {
    throw new Error('telemetry timestamp is invalid');
  }
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
  if (
    !name.trim() ||
    name.length > MAX_TELEMETRY_METRIC_NAME_CHARS ||
    !unit.trim() ||
    unit.length > MAX_TELEMETRY_METRIC_UNIT_CHARS
  )
    throw new Error('metric name and unit are invalid');
  if (!Number.isFinite(value)) throw new Error('metric value must be finite');
  const labelEntries = Object.entries(labels);
  if (labelEntries.length > MAX_TELEMETRY_LABELS)
    throw new Error('metric labels exceed the allowed count');
  for (const [key, labelValue] of labelEntries) {
    if (
      !key.trim() ||
      key.length > MAX_TELEMETRY_LABEL_KEY_CHARS ||
      labelValue.length > MAX_TELEMETRY_LABEL_VALUE_CHARS
    )
      throw new Error('metric label is invalid');
  }
  return Object.freeze({ name, value, unit, labels: Object.freeze({ ...labels }), recordedAt });
}
