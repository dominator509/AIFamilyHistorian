import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  DeepgramTranscriber,
  ElevenLabsNarrator,
  MAX_PROVIDER_AUDIO_INPUT_BYTES,
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

  it('disables redirects before sending credential-bearing provider requests', async () => {
    let requestInit: RequestInit | undefined;
    const mailer = new ResendMailer({
      baseUrl,
      apiKey: 'resend-test-key',
      maxAttempts: 1,
      fetchImpl: (_input, init) => {
        requestInit = init;
        return new Response(JSON.stringify({ id: 'email-redirect' }), { status: 200 });
      },
    });
    await mailer.send({
      from: 'Family <noreply@example.invalid>',
      to: ['reader@example.invalid'],
      subject: 'Subject',
      text: 'Body',
      idempotencyKey: 'redirect-proof',
    });
    expect(requestInit?.redirect).toBe('error');
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
      stripe.verifyWebhookSignature(
        payload,
        `t=${timestamp},v1=${'0'.repeat(64)},v1=${signature}`,
        secret,
        timestamp,
      ),
    ).not.toThrow();
    expect(() =>
      stripe.verifyWebhookSignature(
        payload,
        `t=${timestamp},t=${timestamp},v1=${signature}`,
        secret,
        timestamp,
      ),
    ).toThrow('Stripe webhook signature is invalid');
    expect(() =>
      stripe.verifyWebhookSignature(
        payload,
        `t=${timestamp},v1=${signature}${'0'.repeat(4096)}`,
        secret,
        timestamp,
      ),
    ).toThrow('Stripe webhook signature input is too large');
    expect(() =>
      stripe.verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, 'wrong', timestamp),
    ).toThrow(ProviderAdapterError);
    expect(() =>
      stripe.verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret, Number.NaN),
    ).toThrow('Stripe webhook clock settings are invalid');
    expect(() =>
      stripe.verifyWebhookSignature(
        payload,
        `t=${timestamp},v1=${signature}`,
        secret,
        timestamp,
        86_401,
      ),
    ).toThrow('Stripe webhook clock settings are invalid');
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

  it('opens a provider circuit after bounded retryable failures', async () => {
    let calls = 0;
    const mailer = new ResendMailer({
      baseUrl,
      apiKey: 'test-key',
      maxAttempts: 1,
      circuitFailureThreshold: 2,
      circuitCooldownMs: 60_000,
      fetchImpl: () => {
        calls += 1;
        return Promise.resolve(new Response('{}', { status: 503 }));
      },
    });
    const input = {
      from: 'Family <noreply@example.invalid>',
      to: ['reader@example.invalid'],
      subject: 'Subject',
      text: 'Body',
      idempotencyKey: 'circuit-test',
    };
    await expect(mailer.send(input)).rejects.toMatchObject({ status: 503, retryable: true });
    await expect(mailer.send(input)).rejects.toMatchObject({ status: 503, retryable: true });
    await expect(mailer.send(input)).rejects.toThrow('resend circuit is open');
    expect(calls).toBe(2);
  });

  it('cancels failed upstream response bodies before retry or surfacing the error', async () => {
    let cancelled = false;
    const mailer = new ResendMailer({
      baseUrl,
      apiKey: 'test-key',
      maxAttempts: 1,
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"error":"upstream"}'));
              },
              cancel() {
                cancelled = true;
              },
            }),
            { status: 503 },
          ),
        ),
    });
    await expect(
      mailer.send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'Body',
        idempotencyKey: 'cancel-failed-body',
      }),
    ).rejects.toMatchObject({ status: 503, retryable: true });
    expect(cancelled).toBe(true);
  });

  it('rejects provider responses that exceed bounded memory budgets', async () => {
    const oversizedJson = new ResendMailer({
      baseUrl,
      apiKey: 'test-key',
      maxAttempts: 1,
      fetchImpl: () =>
        Promise.resolve(
          new Response('{}', {
            status: 200,
            headers: { 'content-length': String(8 * 1024 * 1024 + 1) },
          }),
        ),
    });
    await expect(
      oversizedJson.send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'Body',
        idempotencyKey: 'oversized-json',
      }),
    ).rejects.toMatchObject({ provider: 'resend' });

    const oversizedAudio = new ElevenLabsNarrator({
      baseUrl,
      apiKey: 'test-key',
      maxAttempts: 1,
      fetchImpl: () =>
        Promise.resolve(
          new Response('', {
            status: 200,
            headers: { 'content-length': String(128 * 1024 * 1024 + 1) },
          }),
        ),
    });
    await expect(
      oversizedAudio.synthesize({ voiceId: 'stock-voice', text: 'Approved narration.' }),
    ).rejects.toMatchObject({ provider: 'elevenlabs' });

    const unboundedJson = new ResendMailer({
      baseUrl,
      apiKey: 'test-key',
      maxAttempts: 1,
      fetchImpl: () => Promise.resolve(new Response(null, { status: 200 })),
    });
    await expect(
      unboundedJson.send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'Body',
        idempotencyKey: 'unbounded-json',
      }),
    ).rejects.toMatchObject({ provider: 'resend' });
  });

  it('rejects provider responses with oversized parsed fields', async () => {
    const deepgram = new DeepgramTranscriber({
      baseUrl,
      apiKey: 'test-key',
      maxAttempts: 1,
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              results: {
                channels: [{ alternatives: [{ transcript: 'x'.repeat(1_000_001) }] }],
              },
            }),
          ),
        ),
    });
    await expect(deepgram.transcribe(new Uint8Array([1]), 'audio/wav')).rejects.toMatchObject({
      provider: 'deepgram',
      retryable: false,
      message: 'deepgram returned an invalid response',
    });

    const turnstile = new TurnstileVerifier({
      baseUrl,
      apiKey: 'test-key',
      maxAttempts: 1,
      fetchImpl: () =>
        Promise.resolve(
          new Response(JSON.stringify({ success: false, 'error-codes': ['x'.repeat(257)] })),
        ),
    });
    await expect(turnstile.verify({ response: 'token' })).rejects.toMatchObject({
      provider: 'turnstile',
      retryable: false,
      message: 'turnstile returned an invalid response',
    });

    const resend = new ResendMailer({
      baseUrl,
      apiKey: 'test-key',
      maxAttempts: 1,
      fetchImpl: () => Promise.resolve(new Response(JSON.stringify({ id: 'x'.repeat(513) }))),
    });
    await expect(
      resend.send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'Body',
        idempotencyKey: 'bounded-response',
      }),
    ).rejects.toMatchObject({
      provider: 'resend',
      retryable: false,
      message: 'resend returned an invalid response',
    });
  });

  it('rejects oversized or unsafe provider request inputs before dispatch', async () => {
    let calls = 0;
    const fetchImpl = () => {
      calls += 1;
      return Promise.resolve(new Response(JSON.stringify({ id: 'email-1' })));
    };
    await expect(
      new ResendMailer({ baseUrl, apiKey: 'test-key', fetchImpl }).send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'x'.repeat(1_048_577),
        idempotencyKey: 'oversized-request',
      }),
    ).rejects.toMatchObject({ provider: 'resend' });
    await expect(
      new ElevenLabsNarrator({ baseUrl, apiKey: 'test-key', fetchImpl }).synthesize({
        voiceId: 'stock-voice',
        text: 'x'.repeat(1_000_001),
      }),
    ).rejects.toMatchObject({ provider: 'elevenlabs' });
    await expect(
      new StripeBillingAdapter({ baseUrl, apiKey: 'test-key' }).createCheckoutSession({
        priceId: 'price_test',
        successUrl: 'http://unsafe.example/ok',
        cancelUrl: 'https://example.invalid/cancel',
        clientReferenceId: 'archive-1',
        idempotencyKey: 'checkout-unsafe',
      }),
    ).rejects.toMatchObject({ provider: 'stripe' });
    await expect(
      new DeepgramTranscriber({ baseUrl, apiKey: 'test-key' }).transcribe(
        new Uint8Array([1]),
        'audio/wav',
        {
          ...Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`q${index}`, 'value'])),
        },
      ),
    ).rejects.toMatchObject({ provider: 'deepgram' });
    expect(calls).toBe(0);
  });

  it('rejects control characters in provider headers and metadata before dispatch', async () => {
    let calls = 0;
    const fetchImpl = () => {
      calls += 1;
      return Promise.resolve(new Response('{}'));
    };
    await expect(
      new DeepgramTranscriber({ baseUrl, apiKey: 'test-key', fetchImpl }).transcribe(
        new Uint8Array([1]),
        'audio/wav\r\nX-Injected: yes',
      ),
    ).rejects.toMatchObject({ provider: 'deepgram', retryable: false });
    await expect(
      new ResendMailer({ baseUrl, apiKey: 'test-key', fetchImpl }).send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'Body',
        idempotencyKey: 'request-1\nX-Injected: yes',
      }),
    ).rejects.toMatchObject({ provider: 'resend', retryable: false });
    await expect(
      new ResendMailer({ baseUrl, apiKey: 'test-key\r\nX-Injected: yes', fetchImpl }).send({
        from: 'Family <noreply@example.invalid>',
        to: ['reader@example.invalid'],
        subject: 'Subject',
        text: 'Body',
        idempotencyKey: 'request-2',
      }),
    ).rejects.toMatchObject({ provider: 'resend', retryable: false });
    expect(calls).toBe(0);
  });

  it('rejects oversized Deepgram audio before copying or dispatching the request', async () => {
    let calls = 0;
    const fetchImpl = () => {
      calls += 1;
      return Promise.resolve(new Response('{}'));
    };
    await expect(
      new DeepgramTranscriber({ baseUrl, apiKey: 'test-key', fetchImpl }).transcribe(
        new Uint8Array(MAX_PROVIDER_AUDIO_INPUT_BYTES + 1),
        'audio/wav',
      ),
    ).rejects.toMatchObject({
      provider: 'deepgram',
      retryable: false,
      message: 'audio payload exceeds the allowed size',
    });
    expect(calls).toBe(0);
  });
});
