import type { Pool, PoolClient } from 'pg';
import { withTenantTransaction, type DatabaseContext } from './client.js';
import { uuidV7 } from './uuid-v7.js';

export interface MutationResult<T> {
  readonly status: number;
  readonly body: T;
  readonly replayed: boolean;
}

export interface MutationDescriptor extends DatabaseContext {
  readonly idempotencyKey: string;
  readonly method: string;
  readonly route: string;
  readonly actorPseudonym: string;
  readonly action: string;
}

export async function withIdempotentMutation<T>(
  pool: Pool,
  descriptor: MutationDescriptor,
  operation: (client: PoolClient) => Promise<{ status: number; body: T }>,
): Promise<MutationResult<T>> {
  if (descriptor.idempotencyKey.length < 16 || descriptor.idempotencyKey.length > 200)
    throw new Error('Idempotency-Key must contain 16 to 200 characters');
  return withTenantTransaction(pool, descriptor, async (client) => {
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${descriptor.organizationId}:${descriptor.idempotencyKey}:${descriptor.method}:${descriptor.route}`,
    ]);
    const prior = await client.query<{ response_status: number; response_body: T }>(
      'select response_status, response_body from api_idempotency_keys where organization_id = $1 and idempotency_key = $2 and method = $3 and route = $4',
      [descriptor.organizationId, descriptor.idempotencyKey, descriptor.method, descriptor.route],
    );
    const replay = prior.rows[0];
    if (replay)
      return { status: replay.response_status, body: replay.response_body, replayed: true };

    const result = await operation(client);
    if (result.status < 200 || result.status > 299)
      throw new Error('only successful mutations may be idempotently persisted');
    await client.query(
      'insert into audit_events(id, organization_id, family_archive_id, actor_pseudonym, action, outcome, metadata, occurred_at) values ($1,$2,$3,$4,$5,$6,$7,now())',
      [
        uuidV7(),
        descriptor.organizationId,
        descriptor.familyArchiveId,
        descriptor.actorPseudonym,
        descriptor.action,
        'success',
        { route: descriptor.route, method: descriptor.method },
      ],
    );
    await client.query(
      "insert into api_idempotency_keys(id, organization_id, family_archive_id, idempotency_key, method, route, response_status, response_body, expires_at) values ($1,$2,$3,$4,$5,$6,$7,$8,now() + interval '24 hours')",
      [
        uuidV7(),
        descriptor.organizationId,
        descriptor.familyArchiveId,
        descriptor.idempotencyKey,
        descriptor.method,
        descriptor.route,
        result.status,
        result.body,
      ],
    );
    return { ...result, replayed: false };
  });
}
