import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  DeepgramTranscriber,
  ElevenLabsNarrator,
  ProviderAdapterError,
  ResendMailer,
  StripeBillingAdapter,
  TurnstileVerifier,
} from '../../packages/providers/src/index.js';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createServer((request, response) => {
    void route(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('provider test server did not bind');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
    else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf8');
  response.setHeader('content-type', 'application/json');
  if (request.url?.startsWith('/v1/listen')) {
    expect(request.headers.authorization).toBe('Token deepgram-test-key');
    response.end(
      JSON.stringify({
        results: { channels: [{ alternatives: [{ transcript: 'hello', confidence: 0.99 }] }] },
        metadata: { request_id: 'dg-1' },
      }),
    );
    return;
  }
  if (request.url?.startsWith('/v1/text-to-speech/')) {
    expect(request.headers['xi-api-key']).toBe('eleven-test-key');
    response.setHeader('content-type', 'audio/mpeg');
    response.setHeader('request-id', 'el-1');
    response.end(Buffer.from([0x49, 0x44, 0x33]));
    return;
  }
  if (request.url === '/emails') {
    expect(request.headers.authorization).toBe('Bearer resend-test-key');
    expect(request.headers['idempotency-key']).toBe('email-1');
    const parsedBody = JSON.parse(body) as { subject?: unknown };
    expect(parsedBody.subject).toBe('Subject');
    response.end(JSON.stringify({ id: 'email-1' }));
    return;
  }
  if (request.url === '/turnstile/v0/siteverify') {
    expect(body).toContain('secret=turnstile-test-key');
    response.end(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }));
    return;
  }
  if (request.url === '/v1/checkout/sessions') {
    expect(request.headers.authorization).toBe('Bearer sk_test_provider');
    response.end(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.invalid/session' }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'not found' }));
}

describe('provider adapters', () => {
  it('constructs and validates Deepgram, ElevenLabs, Resend, and Turnstile requests', async () => {
    const transcript = await new DeepgramTranscriber({
      baseUrl,
      apiKey: 'deepgram-test-key',
    }).transcribe(new Uint8Array([1]), 'audio/wav');
    expect(transcript).toEqual({
      transcript: 'hello',
      confidence: 0.99,
      providerRequestId: 'dg-1',
    });
    const audio = await new ElevenLabsNarrator({ baseUrl, apiKey: 'eleven-test-key' }).synthesize({
      voiceId: 'stock-voice',
      text: 'Approved narration.',
    });
    expect([...audio.audio]).toEqual([0x49, 0x44, 0x33]);
    const email = await new ResendMailer({ baseUrl, apiKey: 'resend-test-key' }).send({
      from: 'Family <noreply@example.invalid>',
      to: ['reader@example.invalid'],
      subject: 'Subject',
      text: 'Body',
      idempotencyKey: 'email-1',
    });
    expect(email.id).toBe('email-1');
    const turnstile = await new TurnstileVerifier({ baseUrl, apiKey: 'turnstile-test-key' }).verify(
      { response: 'token' },
    );
    expect(turnstile.success).toBe(false);
  });

  it('constructs Stripe checkout requests and verifies signed webhooks fail closed', async () => {
    const stripe = new StripeBillingAdapter({ baseUrl, apiKey: 'sk_test_provider' });
    const session = await stripe.createCheckoutSession({
      priceId: 'price_test',
      successUrl: 'https://example.invalid/ok',
      cancelUrl: 'https://example.invalid/cancel',
      clientReferenceId: 'archive-1',
      idempotencyKey: 'checkout-1',
    });
    expect(session.id).toBe('cs_test_1');
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
    const timestamp = 1_780_000_000;
    const secret = 'whsec_test';
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    expect(() =>
      stripe.verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp),
    ).not.toThrow();
    expect(() =>
      stripe.verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, 'wrong', timestamp),
    ).toThrow(ProviderAdapterError);
  });

  it('rejects unsafe provider endpoints and unbounded retry settings', async () => {
    await expect(
      new ResendMailer({ baseUrl: 'http://provider.example.test', apiKey: 'test-key' }).send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'Body',
        idempotencyKey: 'unsafe-endpoint',
      }),
    ).rejects.toMatchObject({ provider: 'resend' });
    await expect(
      new ResendMailer({ baseUrl, apiKey: 'test-key', maxAttempts: 6 }).send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'Body',
        idempotencyKey: 'too-many-retries',
      }),
    ).rejects.toMatchObject({ provider: 'resend' });
  });
});
