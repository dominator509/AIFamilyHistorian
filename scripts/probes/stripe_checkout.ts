import { randomUUID } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { StripeBillingAdapter } from '../../packages/providers/src/index.js';

const apiKey = process.env.STRIPE_SECRET_KEY?.trim();
const priceId = process.env.STRIPE_PRICE_ID?.trim();
if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not configured');
if (!priceId) throw new Error('STRIPE_PRICE_ID is not configured');

const adapter = new StripeBillingAdapter({
  baseUrl: 'https://api.stripe.com',
  apiKey,
  timeoutMs: 30_000,
  maxAttempts: 2,
});
const session = await adapter.createCheckoutSession({
  priceId,
  successUrl: 'https://example.invalid/billing/success',
  cancelUrl: 'https://example.invalid/billing/cancel',
  clientReferenceId: `codex-stripe-live-fire-${randomUUID()}`,
  idempotencyKey: `codex-stripe-live-fire-${randomUUID()}`,
});

assert.match(session.id, /^cs_[A-Za-z0-9_]+$/u);
if (session.url !== undefined && session.url !== null) assert.match(session.url, /^https?:\/\//u);
console.log(`stripe checkout: ok session=${session.id}`);
