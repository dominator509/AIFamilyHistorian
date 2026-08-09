import { strict as assert } from 'node:assert';

const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not configured');

const fixtureUrl =
  process.env.DEEPGRAM_FIXTURE_URL?.trim() ??
  'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav';
const endpoint = new URL('https://api.deepgram.com/v1/listen');
endpoint.searchParams.set('model', 'nova-3');
endpoint.searchParams.set('smart_format', 'true');

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_RESPONSE_BYTES)
      throw new Error('Deepgram response exceeds the allowed size');
  }
  if (!response.body) {
    if (declaredLength === null) throw new Error('Deepgram response has no bounded body length');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RESPONSE_BYTES)
      throw new Error('Deepgram response exceeds the allowed size');
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Deepgram response exceeds the allowed size');
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Token ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url: fixtureUrl }),
  signal: AbortSignal.timeout(60_000),
});

assert.equal(response.ok, true, `Deepgram transcription failed with HTTP ${response.status}`);
const body = (await readBoundedJson(response)) as {
  results?: { channels?: Array<{ alternatives?: Array<{ transcript?: unknown }> }> };
  metadata?: { request_id?: unknown };
};
const transcriptValue = body.results?.channels?.[0]?.alternatives?.[0]?.transcript;
if (typeof transcriptValue !== 'string')
  throw new Error('Deepgram response omitted transcript text');
const transcript = transcriptValue;
assert.ok(transcript.trim().length > 0, 'Deepgram returned an empty transcript');

const requestId =
  typeof body.metadata?.request_id === 'string' &&
  /^[A-Za-z0-9._:-]{1,256}$/u.test(body.metadata.request_id)
    ? body.metadata.request_id
    : typeof body.metadata?.request_id === 'string'
      ? 'present'
      : 'absent';
console.log(`deepgram transcription: ok request_id=${requestId} characters=${transcript.length}`);
