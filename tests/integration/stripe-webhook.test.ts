import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';
import { ArchiveService } from '../../apps/api/src/archive-service.js';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
} from '../../packages/database/src/index.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const pool = createPool();
const service = new ArchiveService(pool, 'a'.repeat(32));
const secret = 'whsec_local-integration-secret';
const app = await createApp({
  service,
  sessionSecret: 's'.repeat(32),
  stripeWebhookSecret: secret,
});

function signedPayload(payload: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

describe('Stripe webhook ingestion', () => {
  let organizationId: string;
  let familyArchiveId: string;

  beforeAll(async () => {
    await migrate(pool);
    organizationId = uuidV7();
    familyArchiveId = uuidV7();
    await bootstrapArchive(
      pool,
      { organizationId, familyArchiveId },
      'Stripe family',
      'Stripe archive',
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('persists a verified webhook and acknowledges replay safely', async () => {
    const eventId = `evt_${organizationId.replaceAll('-', '')}1`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { organization_id: organizationId, family_archive_id: familyArchiveId },
        },
      },
    });
    const first = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': signedPayload(payload) },
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ status: 'accepted', eventId });
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': signedPayload(payload) },
      payload,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    const rows = await pool.query<{
      provider: string;
      event_type: string;
      signature_verified: boolean;
      count: number;
    }>(
      'select provider, event_type, signature_verified, count(*)::int as count from provider_callback_events where provider_event_id = $1 group by provider, event_type, signature_verified',
      [eventId],
    );
    expect(rows.rows).toEqual([
      {
        provider: 'stripe',
        event_type: 'checkout.session.completed',
        signature_verified: true,
        count: 1,
      },
    ]);
  });

  it('rejects an invalid signature before persistence', async () => {
    const eventId = `evt_${organizationId.replaceAll('-', '')}2`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'invoice.paid',
      data: {
        object: {
          metadata: { organization_id: organizationId, family_archive_id: familyArchiveId },
        },
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' },
      payload,
    });
    expect(response.statusCode).toBe(400);
    const rows = await pool.query(
      'select 1 from provider_callback_events where provider_event_id = $1',
      [eventId],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('rejects a replay with a different signed payload', async () => {
    const eventId = `evt_${organizationId.replaceAll('-', '')}3`;
    const firstPayload = JSON.stringify({
      id: eventId,
      type: 'invoice.paid',
      data: {
        object: {
          metadata: { organization_id: organizationId, family_archive_id: familyArchiveId },
          amount: 1,
        },
      },
    });
    const secondPayload = firstPayload.replace('amount":1', 'amount":2');
    await expect(
      app.inject({
        method: 'POST',
        url: '/v1/webhooks/stripe',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signedPayload(firstPayload),
        },
        payload: firstPayload,
      }),
    ).resolves.toMatchObject({ statusCode: 200 });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signedPayload(secondPayload),
      },
      payload: secondPayload,
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects tenant-mismatched archive metadata before persistence', async () => {
    const otherOrganizationId = uuidV7();
    const otherArchiveId = uuidV7();
    await bootstrapArchive(
      pool,
      { organizationId: otherOrganizationId, familyArchiveId: otherArchiveId },
      'Other Stripe family',
      'Other Stripe archive',
    );
    const eventId = `evt_${organizationId.replaceAll('-', '')}4`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { organization_id: organizationId, family_archive_id: otherArchiveId },
        },
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': signedPayload(payload) },
      payload,
    });
    expect(response.statusCode).toBe(400);
    const rows = await pool.query(
      'select 1 from provider_callback_events where provider_event_id = $1',
      [eventId],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('rejects signed event metadata containing control characters before persistence', async () => {
    const eventId = `evt_${organizationId.replaceAll('-', '')}5`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'invoice.\npaid',
      data: {
        object: {
          metadata: { organization_id: organizationId, family_archive_id: familyArchiveId },
        },
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/stripe',
      headers: { 'content-type': 'application/json', 'stripe-signature': signedPayload(payload) },
      payload,
    });
    expect(response.statusCode).toBe(400);
    const rows = await pool.query(
      'select 1 from provider_callback_events where provider_event_id = $1',
      [eventId],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('rejects unsafe callback metadata at the database boundary', async () => {
    await expect(
      pool.query(
        `insert into provider_callback_events
          (id, organization_id, family_archive_id, provider, provider_event_id, event_type, payload, payload_sha256, signature_verified)
         values ($1,$2,$3,'stripe',$4,$5,'{}'::jsonb,$6,true)`,
        [
          uuidV7(),
          organizationId,
          familyArchiveId,
          `evt${String.fromCharCode(10)}unsafe`,
          'invoice.paid',
          'a'.repeat(64),
        ],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        `insert into provider_callback_events
          (id, organization_id, family_archive_id, provider, provider_event_id, event_type, payload, payload_sha256, signature_verified)
         values ($1,$2,$3,'stripe',$4,$5,'{}'::jsonb,$6,true)`,
        [
          uuidV7(),
          organizationId,
          familyArchiveId,
          'evt_unsafe_type',
          `invoice.${'x'.repeat(200)}`,
          'a'.repeat(64),
        ],
      ),
    ).rejects.toThrow();
  });
});
