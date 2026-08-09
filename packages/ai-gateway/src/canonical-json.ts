import { createHash } from 'node:crypto';

export const MAX_CANONICAL_JSON_BYTES = 16 * 1024 * 1024;
export const MAX_CANONICAL_JSON_DEPTH = 32;

export class CanonicalJsonError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CanonicalJsonError';
  }
}

function normalize(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_CANONICAL_JSON_DEPTH)
    throw new CanonicalJsonError('canonical JSON exceeds the maximum nesting depth');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new CanonicalJsonError('canonical JSON contains a non-finite number');
    return value;
  }
  if (typeof value !== 'object')
    throw new CanonicalJsonError('canonical JSON contains an unsupported value');
  if (seen.has(value)) throw new CanonicalJsonError('canonical JSON contains a cycle');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((nested) => normalize(nested, depth + 1, seen));
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested, depth + 1, seen)]),
    );
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  const encoded = JSON.stringify(normalize(value, 0, new WeakSet<object>()));
  if (encoded === undefined) throw new CanonicalJsonError('canonical JSON is not serializable');
  if (Buffer.byteLength(encoded, 'utf8') > MAX_CANONICAL_JSON_BYTES)
    throw new CanonicalJsonError('canonical JSON exceeds the maximum size');
  return encoded;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
