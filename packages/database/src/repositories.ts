import type { Pool } from 'pg';
import { withTenantTransaction, type DatabaseContext } from './client.js';
import { uuidV7 } from './uuid-v7.js';

export interface StoredFact {
  readonly id: string;
  readonly encryptedText: string;
  readonly confirmerId: string;
  readonly evidenceLinkIds: readonly string[];
}

export async function bootstrapArchive(
  pool: Pool,
  context: DatabaseContext,
  organizationName: string,
  archiveName: string,
): Promise<void> {
  await withTenantTransaction(pool, context, async (client) => {
    await client.query('insert into organizations(id, name) values ($1, $2)', [
      context.organizationId,
      organizationName,
    ]);
    await client.query(
      'insert into family_archives(id, organization_id, name) values ($1, $2, $3)',
      [context.familyArchiveId, context.organizationId, archiveName],
    );
  });
}

export async function storeConfirmedFact(
  pool: Pool,
  context: DatabaseContext,
  fact: StoredFact,
): Promise<void> {
  if (fact.evidenceLinkIds.length === 0) throw new Error('confirmed fact requires evidence');
  await withTenantTransaction(pool, context, async (client) => {
    await client.query(
      'insert into confirmed_facts(id, organization_id, family_archive_id, encrypted_text, confirmer_id) values ($1, $2, $3, $4, $5)',
      [
        fact.id,
        context.organizationId,
        context.familyArchiveId,
        fact.encryptedText,
        fact.confirmerId,
      ],
    );
    for (const evidenceLinkId of fact.evidenceLinkIds) {
      await client.query(
        'insert into fact_evidence(id, organization_id, family_archive_id, fact_id, evidence_link_id) values ($1, $2, $3, $4, $5)',
        [uuidV7(), context.organizationId, context.familyArchiveId, fact.id, evidenceLinkId],
      );
    }
  });
}

export async function listConfirmedFactIds(
  pool: Pool,
  context: DatabaseContext,
): Promise<readonly string[]> {
  return withTenantTransaction(pool, context, async (client) => {
    const result = await client.query<{ id: string }>(
      'select id from confirmed_facts order by created_at, id',
    );
    return result.rows.map((row) => row.id);
  });
}
