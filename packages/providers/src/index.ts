import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export interface ProviderAdapterOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly circuitFailureThreshold?: number;
  readonly circuitCooldownMs?: number;
  readonly fetchImpl?: typeof fetch;
}

export class ProviderAdapterError extends Error {
  public constructor(
    message: string,
    public readonly provider: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): void {
  if (!webhookSecret.trim())
    throw new ProviderAdapterError('Stripe webhook secret is required', 'stripe');
  if (
    Buffer.byteLength(payload, 'utf8') > 16 * 1024 * 1024 ||
    Buffer.byteLength(signatureHeader, 'utf8') > 4 * 1024
  )
    throw new ProviderAdapterError('Stripe webhook signature input is too large', 'stripe');
  if (
    !Number.isSafeInteger(nowSeconds) ||
    nowSeconds < 0 ||
    !Number.isSafeInteger(toleranceSeconds) ||
    toleranceSeconds < 0 ||
    toleranceSeconds > 86_400
  )
    throw new ProviderAdapterError('Stripe webhook clock settings are invalid', 'stripe');
  const values = new Map<string, string[]>();
  for (const part of signatureHeader.split(',')) {
    const separator = part.indexOf('=');
    if (separator <= 0 || separator === part.length - 1)
      throw new ProviderAdapterError('Stripe webhook signature is invalid', 'stripe');
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!/^[a-z][a-z0-9_]{0,31}$/u.test(key) || !value)
      throw new ProviderAdapterError('Stripe webhook signature is invalid', 'stripe');
    const entries = values.get(key) ?? [];
    entries.push(value);
    values.set(key, entries);
  }
  const timestamps = values.get('t') ?? [];
  const supplied = values.get('v1') ?? [];
  const timestamp = Number(timestamps[0]);
  if (
    timestamps.length !== 1 ||
    !Number.isInteger(timestamp) ||
    supplied.length === 0 ||
    !supplied.every((value) => /^[a-f0-9]{64}$/u.test(value)) ||
    Math.abs(nowSeconds - timestamp) > toleranceSeconds
  )
    throw new ProviderAdapterError('Stripe webhook signature is invalid or expired', 'stripe');
  const expected = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  const valid = supplied.some((value) => {
    const suppliedBytes = Buffer.from(value, 'hex');
    return (
      suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes)
    );
  });
  if (!valid) throw new ProviderAdapterError('Stripe webhook signature is invalid', 'stripe');
}

interface RequestOptions {
  readonly provider: string;
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body?: BodyInit;
}

interface CircuitState {
  failures: number;
  openUntil: number;
}

const MAX_PROVIDER_JSON_BYTES = 8 * 1024 * 1024;
const MAX_PROVIDER_AUDIO_BYTES = 128 * 1024 * 1024;
/** Deepgram receives a fully materialized Uint8Array, so bound input before copying it. */
export const MAX_PROVIDER_AUDIO_INPUT_BYTES = 128 * 1024 * 1024;
export const MAX_PROVIDER_TEXT_CHARS = 1_000_000;
export const MAX_PROVIDER_EMAIL_BODY_BYTES = 1 * 1024 * 1024;
export const MAX_PROVIDER_RECIPIENTS = 100;
export const MAX_PROVIDER_QUERY_PARAMS = 32;
const MAX_PROVIDER_URL_CHARS = 2_048;
const MAX_PROVIDER_METADATA_CHARS = 512;

async function readBoundedBytes(
  response: Response,
  maxBytes: number,
  provider: string,
): Promise<Uint8Array> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes)
      throw new ProviderAdapterError(`${provider} response exceeds the allowed size`, provider);
  }
  if (!response.body) {
    if (declaredLength === null)
      throw new ProviderAdapterError(`${provider} response has no bounded body length`, provider);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes)
      throw new ProviderAdapterError(`${provider} response exceeds the allowed size`, provider);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ProviderAdapterError(`${provider} response exceeds the allowed size`, provider);
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
  return bytes;
}

async function readBoundedJson(response: Response, provider: string): Promise<unknown> {
  const bytes = await readBoundedBytes(response, MAX_PROVIDER_JSON_BYTES, provider);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ProviderAdapterError(`${provider} returned invalid JSON`, provider);
  }
}

function parseProviderResponse<T>(schema: z.ZodType<T>, payload: unknown, provider: string): T {
  try {
    return schema.parse(payload);
  } catch {
    throw new ProviderAdapterError(`${provider} returned an invalid response`, provider);
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
    // Failed upstream responses are already unusable; cleanup is best effort.
  }
}

const circuitStates = new WeakMap<object, CircuitState>();

function circuitState(options: ProviderAdapterOptions): CircuitState {
  const existing = circuitStates.get(options);
  if (existing) return existing;
  const created = { failures: 0, openUntil: 0 };
  circuitStates.set(options, created);
  return created;
}

function validateProviderOptions(options: ProviderAdapterOptions, provider: string): void {
  if (!options.apiKey.trim())
    throw new ProviderAdapterError(`${provider} API key is required`, provider);
  if (options.apiKey.length > MAX_PROVIDER_METADATA_CHARS)
    throw new ProviderAdapterError(`${provider} API key is too long`, provider);
  const timeoutMs = options.timeoutMs ?? 20_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000)
    throw new ProviderAdapterError(`${provider} timeout is outside the allowed range`, provider);
  const maxAttempts = options.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5)
    throw new ProviderAdapterError(
      `${provider} retry count is outside the allowed range`,
      provider,
    );
  const failureThreshold = options.circuitFailureThreshold ?? 5;
  if (!Number.isInteger(failureThreshold) || failureThreshold < 1 || failureThreshold > 20)
    throw new ProviderAdapterError(
      `${provider} circuit failure threshold is outside the allowed range`,
      provider,
    );
  const cooldownMs = options.circuitCooldownMs ?? 30_000;
  if (!Number.isInteger(cooldownMs) || cooldownMs < 1_000 || cooldownMs > 300_000)
    throw new ProviderAdapterError(
      `${provider} circuit cooldown is outside the allowed range`,
      provider,
    );
  let parsed: URL;
  try {
    parsed = new URL(options.baseUrl);
  } catch {
    throw new ProviderAdapterError(`${provider} endpoint is invalid`, provider);
  }
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback))
    throw new ProviderAdapterError(`${provider} endpoint must use HTTPS`, provider);
  if (parsed.username || parsed.password || parsed.search || parsed.hash)
    throw new ProviderAdapterError(
      `${provider} endpoint contains unsupported URL components`,
      provider,
    );
  if (options.baseUrl.length > MAX_PROVIDER_URL_CHARS)
    throw new ProviderAdapterError(`${provider} endpoint is too long`, provider);
}

function assertProviderText(value: string, label: string, provider: string): void {
  if (!value.trim() || value.length > MAX_PROVIDER_TEXT_CHARS)
    throw new ProviderAdapterError(`${provider} ${label} is invalid`, provider);
}

function assertProviderMetadata(value: string, label: string, provider: string): void {
  if (!value.trim() || value.length > MAX_PROVIDER_METADATA_CHARS)
    throw new ProviderAdapterError(`${provider} ${label} is invalid`, provider);
}

function assertHttpsUrl(value: string, label: string, provider: string): void {
  if (value.length > MAX_PROVIDER_URL_CHARS) {
    throw new ProviderAdapterError(`${provider} ${label} is invalid`, provider);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProviderAdapterError(`${provider} ${label} is invalid`, provider);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
    throw new ProviderAdapterError(`${provider} ${label} is invalid`, provider);
}

async function request(options: ProviderAdapterOptions, input: RequestOptions): Promise<Response> {
  validateProviderOptions(options, input.provider);
  const state = circuitState(options);
  if (state.openUntil > Date.now())
    throw new ProviderAdapterError(
      `${input.provider} circuit is open`,
      input.provider,
      undefined,
      true,
    );
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxAttempts = options.maxAttempts ?? 3;
  const failureThreshold = options.circuitFailureThreshold ?? 5;
  const cooldownMs = options.circuitCooldownMs ?? 30_000;
  let lastError: unknown;
  let lastFailureRetryable = false;
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
        const response = await fetchImpl(input.url, {
          method: input.method,
          headers: input.headers,
          ...(input.body === undefined ? {} : { body: input.body }),
          signal: timeout,
        });
        if (response.ok) {
          state.failures = 0;
          state.openUntil = 0;
          return response;
        }
        await discardResponseBody(response);
        const retryable = response.status === 429 || response.status >= 500;
        lastFailureRetryable = retryable;
        lastError = new ProviderAdapterError(
          `${input.provider} request failed with status ${response.status}`,
          input.provider,
          response.status,
          retryable,
        );
        if (!retryable || attempt === maxAttempts) throw lastError;
      } catch (error) {
        lastError = error;
        lastFailureRetryable = !(error instanceof ProviderAdapterError) || error.retryable;
        if (error instanceof ProviderAdapterError && !error.retryable) throw error;
        if (attempt === maxAttempts) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  } catch (error) {
    if (lastFailureRetryable) {
      state.failures += 1;
      if (state.failures >= failureThreshold) state.openUntil = Date.now() + cooldownMs;
    }
    throw error;
  }
  throw lastError instanceof Error ? lastError : new Error('provider request failed');
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/u, '')}${path}`;
}

const deepgramResponseSchema = z.object({
  results: z.object({
    channels: z
      .array(
        z.object({
          alternatives: z
            .array(
              z.object({
                transcript: z.string().max(MAX_PROVIDER_TEXT_CHARS),
                confidence: z.number().finite().optional(),
              }),
            )
            .min(1)
            .max(32),
        }),
      )
      .min(1)
      .max(32),
  }),
  metadata: z
    .object({ request_id: z.string().max(MAX_PROVIDER_METADATA_CHARS).optional() })
    .optional(),
});

export interface TranscriptResult {
  readonly transcript: string;
  readonly confidence?: number;
  readonly providerRequestId?: string;
}

export class DeepgramTranscriber {
  readonly #options: ProviderAdapterOptions;
  public constructor(options: ProviderAdapterOptions) {
    this.#options = options;
  }

  public async transcribe(
    bytes: Uint8Array,
    contentType: string,
    query: Record<string, string> = {},
  ): Promise<TranscriptResult> {
    if (bytes.byteLength === 0)
      throw new ProviderAdapterError('audio payload is empty', 'deepgram');
    if (bytes.byteLength > MAX_PROVIDER_AUDIO_INPUT_BYTES)
      throw new ProviderAdapterError('audio payload exceeds the allowed size', 'deepgram');
    assertProviderMetadata(contentType, 'content type', 'deepgram');
    const queryEntries = Object.entries(query);
    if (queryEntries.length > MAX_PROVIDER_QUERY_PARAMS)
      throw new ProviderAdapterError('deepgram query is too large', 'deepgram');
    for (const [key, value] of queryEntries) {
      assertProviderMetadata(key, 'query key', 'deepgram');
      assertProviderMetadata(value, 'query value', 'deepgram');
    }
    const url = new URL(endpoint(this.#options.baseUrl, '/v1/listen'));
    for (const [key, value] of Object.entries({ model: 'nova-3', smart_format: 'true', ...query }))
      url.searchParams.set(key, value);
    const response = await request(this.#options, {
      provider: 'deepgram',
      method: 'POST',
      url: url.toString(),
      headers: { Authorization: `Token ${this.#options.apiKey}`, 'Content-Type': contentType },
      body: bytes.slice().buffer,
    });
    const parsed = parseProviderResponse(
      deepgramResponseSchema,
      await readBoundedJson(response, 'deepgram'),
      'deepgram',
    );
    const alternative = parsed.results.channels[0]?.alternatives[0];
    if (!alternative)
      throw new ProviderAdapterError('Deepgram returned no transcript alternative', 'deepgram');
    return {
      transcript: alternative.transcript,
      ...(alternative.confidence === undefined ? {} : { confidence: alternative.confidence }),
      ...(parsed.metadata?.request_id ? { providerRequestId: parsed.metadata.request_id } : {}),
    };
  }
}

export class ElevenLabsNarrator {
  readonly #options: ProviderAdapterOptions;
  public constructor(options: ProviderAdapterOptions) {
    this.#options = options;
  }

  public async synthesize(input: {
    voiceId: string;
    text: string;
    modelId?: string;
  }): Promise<{ audio: Uint8Array; providerRequestId?: string }> {
    assertProviderMetadata(input.voiceId, 'voice id', 'elevenlabs');
    assertProviderText(input.text, 'narration text', 'elevenlabs');
    if (input.modelId !== undefined)
      assertProviderMetadata(input.modelId, 'model id', 'elevenlabs');
    const response = await request(this.#options, {
      provider: 'elevenlabs',
      method: 'POST',
      url: endpoint(
        this.#options.baseUrl,
        `/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`,
      ),
      headers: {
        'xi-api-key': this.#options.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: input.text,
        model_id: input.modelId ?? 'eleven_multilingual_v2',
      }),
    });
    const audio = await readBoundedBytes(response, MAX_PROVIDER_AUDIO_BYTES, 'elevenlabs');
    if (audio.byteLength === 0)
      throw new ProviderAdapterError('ElevenLabs returned empty audio', 'elevenlabs');
    return {
      audio,
      ...(response.headers.get('request-id')
        ? { providerRequestId: response.headers.get('request-id')! }
        : {}),
    };
  }
}

const resendResponseSchema = z.object({ id: z.string().min(1).max(MAX_PROVIDER_METADATA_CHARS) });

export class ResendMailer {
  readonly #options: ProviderAdapterOptions;
  public constructor(options: ProviderAdapterOptions) {
    this.#options = options;
  }

  public async send(input: {
    from: string;
    to: readonly string[];
    subject: string;
    html?: string;
    text?: string;
    idempotencyKey: string;
  }): Promise<{ id: string }> {
    assertProviderMetadata(input.from, 'sender', 'resend');
    if (input.to.length === 0 || input.to.length > MAX_PROVIDER_RECIPIENTS)
      throw new ProviderAdapterError('email fields are incomplete', 'resend');
    for (const recipient of input.to) assertProviderMetadata(recipient, 'recipient', 'resend');
    assertProviderMetadata(input.subject, 'subject', 'resend');
    assertProviderMetadata(input.idempotencyKey, 'idempotency key', 'resend');
    if (!input.html && !input.text)
      throw new ProviderAdapterError('email body is required', 'resend');
    if (
      (input.html !== undefined &&
        Buffer.byteLength(input.html, 'utf8') > MAX_PROVIDER_EMAIL_BODY_BYTES) ||
      (input.text !== undefined &&
        Buffer.byteLength(input.text, 'utf8') > MAX_PROVIDER_EMAIL_BODY_BYTES)
    )
      throw new ProviderAdapterError('resend email body is too large', 'resend');
    const body = JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      ...(input.html ? { html: input.html } : {}),
      ...(input.text ? { text: input.text } : {}),
    });
    if (Buffer.byteLength(body, 'utf8') > MAX_PROVIDER_EMAIL_BODY_BYTES)
      throw new ProviderAdapterError('resend email payload is too large', 'resend');
    const response = await request(this.#options, {
      provider: 'resend',
      method: 'POST',
      url: endpoint(this.#options.baseUrl, '/emails'),
      headers: {
        Authorization: `Bearer ${this.#options.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body,
    });
    return parseProviderResponse(
      resendResponseSchema,
      await readBoundedJson(response, 'resend'),
      'resend',
    );
  }
}

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string().max(256)).max(64).optional(),
  hostname: z.string().max(MAX_PROVIDER_METADATA_CHARS).optional(),
  action: z.string().max(MAX_PROVIDER_METADATA_CHARS).optional(),
});
export type TurnstileResult = z.infer<typeof turnstileResponseSchema>;

export class TurnstileVerifier {
  readonly #options: ProviderAdapterOptions;
  public constructor(options: ProviderAdapterOptions) {
    this.#options = options;
  }

  public async verify(input: {
    response: string;
    remoteIp?: string;
    idempotencyKey?: string;
  }): Promise<TurnstileResult> {
    if (!input.response || input.response.length > 2048)
      throw new ProviderAdapterError('Turnstile token is invalid', 'turnstile');
    if (input.remoteIp !== undefined)
      assertProviderMetadata(input.remoteIp, 'remote IP', 'turnstile');
    if (input.idempotencyKey !== undefined)
      assertProviderMetadata(input.idempotencyKey, 'idempotency key', 'turnstile');
    const body = new URLSearchParams({
      secret: this.#options.apiKey,
      response: input.response,
      ...(input.remoteIp ? { remoteip: input.remoteIp } : {}),
      ...(input.idempotencyKey ? { idempotency_key: input.idempotencyKey } : {}),
    });
    const response = await request(this.#options, {
      provider: 'turnstile',
      method: 'POST',
      url: endpoint(this.#options.baseUrl, '/turnstile/v0/siteverify'),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return parseProviderResponse(
      turnstileResponseSchema,
      await readBoundedJson(response, 'turnstile'),
      'turnstile',
    );
  }
}

const stripeSessionSchema = z.object({
  id: z.string().startsWith('cs_').max(MAX_PROVIDER_METADATA_CHARS),
  url: z.string().url().max(MAX_PROVIDER_URL_CHARS).nullable().optional(),
});

export class StripeBillingAdapter {
  readonly #options: ProviderAdapterOptions;
  public constructor(options: ProviderAdapterOptions) {
    this.#options = options;
  }

  public async createCheckoutSession(input: {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    clientReferenceId: string;
    idempotencyKey: string;
  }): Promise<{ id: string; url?: string | null }> {
    assertProviderMetadata(input.priceId, 'price id', 'stripe');
    assertHttpsUrl(input.successUrl, 'success URL', 'stripe');
    assertHttpsUrl(input.cancelUrl, 'cancel URL', 'stripe');
    assertProviderMetadata(input.clientReferenceId, 'client reference id', 'stripe');
    assertProviderMetadata(input.idempotencyKey, 'idempotency key', 'stripe');
    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': input.priceId,
      'line_items[0][quantity]': '1',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.clientReferenceId,
    });
    const response = await request(this.#options, {
      provider: 'stripe',
      method: 'POST',
      url: endpoint(this.#options.baseUrl, '/v1/checkout/sessions'),
      headers: {
        Authorization: `Bearer ${this.#options.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': input.idempotencyKey,
      },
      body,
    });
    const parsed = parseProviderResponse(
      stripeSessionSchema,
      await readBoundedJson(response, 'stripe'),
      'stripe',
    );
    return { id: parsed.id, ...(parsed.url === undefined ? {} : { url: parsed.url }) };
  }

  public verifyWebhookSignature(
    payload: string,
    signatureHeader: string,
    webhookSecret: string,
    nowSeconds = Math.floor(Date.now() / 1000),
    toleranceSeconds = 300,
  ): void {
    verifyStripeWebhookSignature(
      payload,
      signatureHeader,
      webhookSecret,
      nowSeconds,
      toleranceSeconds,
    );
  }
}
