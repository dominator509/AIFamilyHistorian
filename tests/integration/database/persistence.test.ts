import { beforeAll, describe, expect, it } from 'vitest';
import {
  bootstrapArchive,
  createPool,
  listConfirmedFactIds,
  migrate,
  storeConfirmedFact,
  uuidV7,
  withTenantTransaction,
  type DatabaseContext,
} from '../../../packages/database/src/index.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const pool = createPool();

beforeAll(async () => {
  await migrate(pool);
});

describe('PostgreSQL persistence invariants', () => {
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
});
