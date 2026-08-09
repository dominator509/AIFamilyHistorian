import { beforeAll, describe, expect, it } from 'vitest';
import { ArchiveService } from '../../../apps/api/src/archive-service.js';
import {
  bootstrapArchive,
  createPool,
  listConfirmedFactIds,
  migrate,
  storeConfirmedFact,
  uuidV7,
  withIdempotentMutation,
  withTenantTransaction,
  type DatabaseContext,
} from '../../../packages/database/src/index.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const pool = createPool();

beforeAll(async () => {
  await migrate(pool);
});

describe('PostgreSQL persistence invariants', () => {
  it('rejects an archive context whose organization does not own the archive', async () => {
    const first: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    const second: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, first, 'Context family', 'Context archive');
    await bootstrapArchive(pool, second, 'Other context family', 'Other context archive');
    const service = new ArchiveService(pool, 'a'.repeat(32));
    await expect(
      service.getArchive({
        organizationId: first.organizationId,
        familyArchiveId: second.familyArchiveId,
      }),
    ).rejects.toThrow('Archive tenant scope is invalid');
  });

  it('enforces the organization/archive pair at the database foreign-key boundary', async () => {
    const first: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    const second: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, first, 'Foreign-key family', 'Foreign-key archive');
    await bootstrapArchive(pool, second, 'Other foreign-key family', 'Other foreign-key archive');
    await expect(
      pool.query(
        "insert into media_assets(id, organization_id, family_archive_id, media_type, rights_status) values ($1,$2,$3,'image','pending')",
        [uuidV7(), first.organizationId, second.familyArchiveId],
      ),
    ).rejects.toThrow(/media_assets_tenant_fk/u);
  });

  it('enforces tenant isolation with RLS and stores evidence-linked facts transactionally', async () => {
    const first: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    const second: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, first, 'First family', 'First archive');
    await bootstrapArchive(pool, second, 'Second family', 'Second archive');
    const evidenceId = uuidV7();
    await withTenantTransaction(pool, first, async (client) => {
      await client.query(
        'insert into evidence_links(id, organization_id, family_archive_id, source_id, revision_id, start_offset, end_offset) values ($1,$2,$3,$4,$5,0,12)',
        [evidenceId, first.organizationId, first.familyArchiveId, uuidV7(), uuidV7()],
      );
    });
    const factId = uuidV7();
    await storeConfirmedFact(pool, first, {
      id: factId,
      encryptedText: 'ciphertext-only',
      confirmerId: uuidV7(),
      evidenceLinkIds: [evidenceId],
    });
    expect(await listConfirmedFactIds(pool, first)).toContain(factId);
    expect(await listConfirmedFactIds(pool, second)).not.toContain(factId);
  });

  it('binds fact confirmation to the authenticated actor', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Confirmation family', 'Confirmation archive');
    const evidenceId = uuidV7();
    await withTenantTransaction(pool, context, async (client) => {
      await client.query(
        'insert into evidence_links(id, organization_id, family_archive_id, source_id, revision_id, start_offset, end_offset) values ($1,$2,$3,$4,$5,0,12)',
        [evidenceId, context.organizationId, context.familyArchiveId, uuidV7(), uuidV7()],
      );
    });
    const actorUserId = uuidV7();
    const service = new ArchiveService(pool, 'a'.repeat(32));
    await expect(
      service.create(context, actorUserId, `fact-confirmation-${uuidV7()}`, '/v1/facts', {
        kind: 'facts',
        input: {
          text: 'Authenticated confirmation only',
          confirmerId: uuidV7(),
          evidenceLinkIds: [evidenceId],
          status: 'confirmed',
        },
      }),
    ).rejects.toThrow('Only the authenticated actor can confirm a fact');
    await expect(
      service.create(context, actorUserId, `fact-confirmation-${uuidV7()}`, '/v1/facts', {
        kind: 'facts',
        input: {
          text: 'Authenticated confirmation accepted',
          confirmerId: actorUserId,
          evidenceLinkIds: [evidenceId],
          status: 'confirmed',
        },
      }),
    ).resolves.toMatchObject({ replayed: false, response: { status: 'accepted' } });
    const persisted = await withTenantTransaction(pool, context, async (client) =>
      client.query<{ count: string }>(
        'select count(*)::text as count from confirmed_facts where organization_id = $1 and family_archive_id = $2',
        [context.organizationId, context.familyArchiveId],
      ),
    );
    expect(persisted.rows[0]?.count).toBe('1');
  });

  it('rejects original-object mutation and audit-event mutation', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Immutable family', 'Immutable archive');
    const mediaId = uuidV7();
    const originalId = uuidV7();
    await withTenantTransaction(pool, context, async (client) => {
      await client.query(
        "insert into media_assets(id, organization_id, family_archive_id, media_type, rights_status) values ($1,$2,$3,'image','verified')",
        [mediaId, context.organizationId, context.familyArchiveId],
      );
      await client.query(
        "insert into original_objects(id, organization_id, family_archive_id, media_asset_id, object_key, content_type, byte_size, sha256) values ($1,$2,$3,$4,$5,'image/jpeg',4,$6)",
        [
          originalId,
          context.organizationId,
          context.familyArchiveId,
          mediaId,
          `opaque/${uuidV7()}`,
          'a'.repeat(64),
        ],
      );
    });
    await expect(
      withTenantTransaction(pool, context, async (client) =>
        client.query('update original_objects set byte_size = 5 where id = $1', [originalId]),
      ),
    ).rejects.toThrow(/immutable/);

    const auditId = uuidV7();
    await withTenantTransaction(pool, context, async (client) => {
      await client.query(
        "insert into audit_events(id, organization_id, family_archive_id, actor_pseudonym, action, outcome, occurred_at) values ($1,$2,$3,'actor-hash','archive.read','allowed',now())",
        [auditId, context.organizationId, context.familyArchiveId],
      );
    });
    await expect(
      withTenantTransaction(pool, context, async (client) =>
        client.query("update audit_events set outcome = 'changed' where id = $1", [auditId]),
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('rejects unsafe audit and provenance metadata at the database boundary', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Metadata family', 'Metadata archive');
    const auditId = uuidV7();
    await expect(
      withTenantTransaction(pool, context, (client) =>
        client.query(
          "insert into audit_events(id, organization_id, family_archive_id, actor_pseudonym, action, outcome, occurred_at) values ($1,$2,$3,'actor-hash',$4,'allowed',now())",
          [
            auditId,
            context.organizationId,
            context.familyArchiveId,
            `audit${String.fromCharCode(10)}entry`,
          ],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenantTransaction(pool, context, (client) =>
        client.query(
          "insert into audit_events(id, organization_id, family_archive_id, actor_pseudonym, action, outcome, occurred_at) values ($1,$2,$3,$4,'audit.safe', 'allowed', now())",
          [
            uuidV7(),
            context.organizationId,
            context.familyArchiveId,
            `worker${String.fromCharCode(10)}label`,
          ],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenantTransaction(pool, context, (client) =>
        client.query(
          "insert into audit_events(id, organization_id, family_archive_id, actor_pseudonym, action, outcome, occurred_at) values ($1,$2,$3,'worker:job-intake','audit.safe',$4,now())",
          [uuidV7(), context.organizationId, context.familyArchiveId, 'x'.repeat(129)],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      withTenantTransaction(pool, context, (client) =>
        client.query(
          'insert into provenance_events(id, organization_id, family_archive_id, entity_type, entity_id, event_type, lineage, occurred_at) values ($1,$2,$3,$4,$5,$6,$7,now())',
          [
            uuidV7(),
            context.organizationId,
            context.familyArchiveId,
            'audit',
            uuidV7(),
            'x'.repeat(257),
            {},
          ],
        ),
      ),
    ).rejects.toThrow();
  });

  it('keeps queued job tenant scope immutable after enqueue', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Outbox family', 'Outbox archive');
    const jobId = uuidV7();
    await withTenantTransaction(pool, context, (client) =>
      client.query(
        'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
        [jobId, context.organizationId, context.familyArchiveId, 'privacy.request', {}],
      ),
    );
    await expect(
      pool.query('update job_outbox set organization_id = $2 where id = $1', [jobId, uuidV7()]),
    ).rejects.toThrow(/tenant scope is immutable/u);
    await expect(
      pool.query('update job_outbox set payload = $2 where id = $1', [jobId, { forged: true }]),
    ).rejects.toThrow(/authoritative fields are immutable/u);
    await pool.query("update job_outbox set status = 'running' where id = $1", [jobId]);
    await pool.query("update job_outbox set status = 'completed' where id = $1", [jobId]);
    await expect(
      pool.query("update job_outbox set status = 'running' where id = $1", [jobId]),
    ).rejects.toThrow(/status transition is invalid/u);
  });

  it('enforces one immutable derivative recipe per original object', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Derivative family', 'Derivative archive');
    const mediaId = uuidV7();
    const originalId = uuidV7();
    const recipeVersion = 'waveform-v1';
    await withTenantTransaction(pool, context, async (client) => {
      await client.query(
        "insert into media_assets(id, organization_id, family_archive_id, media_type, rights_status) values ($1,$2,$3,'audio','verified')",
        [mediaId, context.organizationId, context.familyArchiveId],
      );
      await client.query(
        "insert into original_objects(id, organization_id, family_archive_id, media_asset_id, object_key, content_type, byte_size, sha256, quarantine_status) values ($1,$2,$3,$4,$5,'audio/wav',4,$6,'clean')",
        [
          originalId,
          context.organizationId,
          context.familyArchiveId,
          mediaId,
          `opaque/${uuidV7()}`,
          'a'.repeat(64),
        ],
      );
      await client.query(
        'insert into derivative_objects(id, organization_id, family_archive_id, original_object_id, object_key, recipe_version, sha256) values ($1,$2,$3,$4,$5,$6,$7)',
        [
          uuidV7(),
          context.organizationId,
          context.familyArchiveId,
          originalId,
          `derivative/${uuidV7()}`,
          recipeVersion,
          'b'.repeat(64),
        ],
      );
    });
    await expect(
      withTenantTransaction(pool, context, async (client) =>
        client.query(
          'insert into derivative_objects(id, organization_id, family_archive_id, original_object_id, object_key, recipe_version, sha256) values ($1,$2,$3,$4,$5,$6,$7)',
          [
            uuidV7(),
            context.organizationId,
            context.familyArchiveId,
            originalId,
            `derivative/${uuidV7()}`,
            recipeVersion,
            'b'.repeat(64),
          ],
        ),
      ),
    ).rejects.toThrow(/derivative_objects_recipe_idx|duplicate key/u);
  });

  it('permits only the declared quarantine transitions while preserving original fixity', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Quarantine family', 'Quarantine archive');
    const mediaId = uuidV7();
    const originalId = uuidV7();
    await withTenantTransaction(pool, context, async (client) => {
      await client.query(
        "insert into media_assets(id, organization_id, family_archive_id, media_type, rights_status) values ($1,$2,$3,'image','verified')",
        [mediaId, context.organizationId, context.familyArchiveId],
      );
      await client.query(
        "insert into original_objects(id, organization_id, family_archive_id, media_asset_id, object_key, content_type, byte_size, sha256) values ($1,$2,$3,$4,$5,'image/jpeg',4,$6)",
        [
          originalId,
          context.organizationId,
          context.familyArchiveId,
          mediaId,
          `opaque/${uuidV7()}`,
          'b'.repeat(64),
        ],
      );
      await client.query(
        "update original_objects set quarantine_status = 'scanning' where id = $1",
        [originalId],
      );
      await client.query("update original_objects set quarantine_status = 'clean' where id = $1", [
        originalId,
      ]);
    });
    await expect(
      withTenantTransaction(pool, context, async (client) =>
        client.query("update original_objects set quarantine_status = 'scanning' where id = $1", [
          originalId,
        ]),
      ),
    ).rejects.toThrow(/immutable/);
    await expect(
      withTenantTransaction(pool, context, async (client) =>
        client.query('update original_objects set byte_size = 5 where id = $1', [originalId]),
      ),
    ).rejects.toThrow(/immutable/);
  });

  it('serializes idempotent mutations and writes exactly one audit event', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Idempotent family', 'Idempotent archive');
    const recordingSessionId = uuidV7();
    const descriptor = {
      ...context,
      idempotencyKey: `integration-${uuidV7()}`,
      method: 'POST',
      route: '/v1/archives/:archiveId/recording-sessions',
      actorPseudonym: 'actor-hash',
      action: 'recording_session.create',
    };
    const execute = () =>
      withIdempotentMutation(pool, descriptor, async (client) => {
        await client.query(
          "insert into recording_sessions(id, organization_id, family_archive_id, status) values ($1,$2,$3,'scheduled')",
          [recordingSessionId, context.organizationId, context.familyArchiveId],
        );
        return { status: 201, body: { id: recordingSessionId } };
      });
    expect((await execute()).replayed).toBe(false);
    expect((await execute()).replayed).toBe(true);
    const counts = await withTenantTransaction(pool, context, async (client) =>
      client.query<{ sessions: string; audits: string }>(
        "select (select count(*) from recording_sessions where id = $1)::text as sessions, (select count(*) from audit_events where action = 'recording_session.create')::text as audits",
        [recordingSessionId],
      ),
    );
    expect(counts.rows[0]).toEqual({ sessions: '1', audits: '1' });
  });

  it('rejects unsafe or expired idempotency records at the database boundary', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(
      pool,
      context,
      'Idempotency boundary family',
      'Idempotency boundary archive',
    );
    const base = [
      uuidV7(),
      context.organizationId,
      context.familyArchiveId,
      'POST',
      '/v1/test',
      201,
      {},
    ];
    await expect(
      pool.query(
        `insert into api_idempotency_keys
          (id, organization_id, family_archive_id, idempotency_key, method, route, response_status, response_body, expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,now() + interval '24 hours')`,
        [
          base[0],
          base[1],
          base[2],
          `key${String.fromCharCode(10)}unsafe`,
          base[3],
          base[4],
          base[5],
          base[6],
        ],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        `insert into api_idempotency_keys
          (id, organization_id, family_archive_id, idempotency_key, method, route, response_status, response_body, expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,now() - interval '1 second')`,
        [base[0], base[1], base[2], `key-${'x'.repeat(20)}`, base[3], base[4], base[5], base[6]],
      ),
    ).rejects.toThrow();
  });
});
