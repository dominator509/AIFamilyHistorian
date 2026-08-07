import { strict as assert } from 'node:assert';

const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not configured');

const fixtureUrl =
  process.env.DEEPGRAM_FIXTURE_URL?.trim() ??
  'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav';
const endpoint = new URL('https://api.deepgram.com/v1/listen');
endpoint.searchParams.set('model', 'nova-3');
endpoint.searchParams.set('smart_format', 'true');

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
const body = (await response.json()) as {
  results?: { channels?: Array<{ alternatives?: Array<{ transcript?: unknown }> }> };
  metadata?: { request_id?: unknown };
};
const transcriptValue = body.results?.channels?.[0]?.alternatives?.[0]?.transcript;
if (typeof transcriptValue !== 'string')
  throw new Error('Deepgram response omitted transcript text');
const transcript = transcriptValue;
assert.ok(transcript.trim().length > 0, 'Deepgram returned an empty transcript');

console.log(
  `deepgram transcription: ok request_id=${typeof body.metadata?.request_id === 'string' ? body.metadata.request_id : 'absent'} characters=${transcript.length}`,
);
