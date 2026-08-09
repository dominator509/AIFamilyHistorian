import { createHash } from 'node:crypto';
import type {
  SessionMetadata,
  SessionPrincipal,
  SessionStore,
  StoredSession,
} from '@family-historian/auth';
import type { DatabasePool } from '@family-historian/database';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} is invalid`);
}

function hashMetadata(value: string | undefined): string | null {
  if (!value) return null;
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

type SessionRow = {
  session_id: string;
  user_id: string;
  organization_id: string;
  archive_ids: string[];
  permissions: string[];
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  device_label: string | null;
};

function rowToSession(row: SessionRow): StoredSession {
  return Object.freeze({
    sessionId: row.session_id,
    userId: row.user_id,
    organizationId: row.organization_id,
    archiveIds: Object.freeze([...row.archive_ids]),
    permissions: Object.freeze([...row.permissions]),
    expiresAt: Math.floor(row.expires_at.getTime() / 1000),
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    revokedAt: row.revoked_at?.toISOString() ?? null,
    deviceLabel: row.device_label,
  });
}

/** PostgreSQL-backed server-side session inventory and revocation store. */
export class PostgresSessionStore implements SessionStore {
  public constructor(private readonly pool: DatabasePool) {}

  public async ensure(
    principal: SessionPrincipal,
    metadata: SessionMetadata = {},
  ): Promise<StoredSession | null> {
    assertUuid(principal.sessionId ?? '', 'sessionId');
    assertUuid(principal.userId, 'userId');
    assertUuid(principal.organizationId, 'organizationId');
    for (const archiveId of principal.archiveIds) assertUuid(archiveId, 'archiveId');
    await this.pool.query(
      `insert into auth_sessions(
         session_id, user_id, organization_id, archive_ids, permissions,
         device_label, user_agent_hash, ip_hash, expires_at
       ) values ($1,$2,$3,$4::uuid[],$5::text[],$6,$7,$8,to_timestamp($9))
       on conflict (session_id) do nothing`,
      [
        principal.sessionId,
        principal.userId,
        principal.organizationId,
        principal.archiveIds,
        principal.permissions,
        metadata.deviceLabel ?? null,
        hashMetadata(metadata.userAgent),
        hashMetadata(metadata.ipAddress),
        principal.expiresAt,
      ],
    );
    const existing = await this.find(principal.sessionId!);
    if (!existing || existing.revokedAt || existing.expiresAt <= Math.floor(Date.now() / 1000))
      return null;
    if (
      existing.userId !== principal.userId ||
      existing.organizationId !== principal.organizationId ||
      !sameValues(existing.archiveIds, principal.archiveIds) ||
      !sameValues(existing.permissions, principal.permissions)
    )
      return null;
    await this.pool.query(
      `update auth_sessions
          set last_seen_at = now()
        where session_id = $1
          and revoked_at is null
          and expires_at > now()
          and last_seen_at < now() - interval '5 minutes'`,
      [principal.sessionId],
    );
    return existing;
  }

  public async rotate(
    currentSessionId: string,
    replacement: SessionPrincipal,
    metadata: SessionMetadata = {},
  ): Promise<void> {
    assertUuid(currentSessionId, 'currentSessionId');
    assertUuid(replacement.sessionId ?? '', 'replacement sessionId');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query<{
        session_id: string;
        user_id: string;
        organization_id: string;
        archive_ids: string[];
        permissions: string[];
      }>(
        `select session_id, user_id, organization_id, archive_ids, permissions
           from auth_sessions
          where session_id = $1
            and revoked_at is null
            and expires_at > now()
          for update`,
        [currentSessionId],
      );
      if (current.rowCount !== 1) throw new Error('AUTH_REQUIRED');
      const currentRow = current.rows[0]!;
      if (
        currentRow.user_id !== replacement.userId ||
        currentRow.organization_id !== replacement.organizationId ||
        !sameValues(currentRow.archive_ids, replacement.archiveIds) ||
        !sameValues(currentRow.permissions, replacement.permissions)
      )
        throw new Error('AUTH_REQUIRED');
      await client.query(
        `update auth_sessions set revoked_at = now(), revoked_reason = 'rotated'
          where session_id = $1 and revoked_at is null`,
        [currentSessionId],
      );
      await client.query(
        `insert into auth_sessions(
           session_id, user_id, organization_id, archive_ids, permissions,
           device_label, user_agent_hash, ip_hash, expires_at
         ) values ($1,$2,$3,$4::uuid[],$5::text[],$6,$7,$8,to_timestamp($9))`,
        [
          replacement.sessionId,
          replacement.userId,
          replacement.organizationId,
          replacement.archiveIds,
          replacement.permissions,
          metadata.deviceLabel ?? null,
          hashMetadata(metadata.userAgent),
          hashMetadata(metadata.ipAddress),
          replacement.expiresAt,
        ],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  public async revoke(sessionId: string, reason: string, organizationId?: string): Promise<void> {
    assertUuid(sessionId, 'sessionId');
    if (organizationId) assertUuid(organizationId, 'organizationId');
    await this.pool.query(
      `update auth_sessions
          set revoked_at = coalesce(revoked_at, now()), revoked_reason = coalesce(revoked_reason, $2)
        where session_id = $1
          and ($3::uuid is null or organization_id = $3::uuid)`,
      [sessionId, reason, organizationId ?? null],
    );
  }

  public async revokeAllForUser(
    userId: string,
    exceptSessionId?: string,
    organizationId?: string,
  ): Promise<number> {
    assertUuid(userId, 'userId');
    if (exceptSessionId) assertUuid(exceptSessionId, 'exceptSessionId');
    if (organizationId) assertUuid(organizationId, 'organizationId');
    const result = await this.pool.query(
      `update auth_sessions
          set revoked_at = coalesce(revoked_at, now()), revoked_reason = coalesce(revoked_reason, 'administrative')
        where user_id = $1
          and ($3::uuid is null or organization_id = $3::uuid)
          and revoked_at is null
          and ($2::uuid is null or session_id <> $2::uuid)`,
      [userId, exceptSessionId ?? null, organizationId ?? null],
    );
    return result.rowCount ?? 0;
  }

  public async listForUser(
    userId: string,
    organizationId?: string,
  ): Promise<readonly StoredSession[]> {
    assertUuid(userId, 'userId');
    if (organizationId) assertUuid(organizationId, 'organizationId');
    const result = await this.pool.query<SessionRow>(
      `select session_id, user_id, organization_id, archive_ids, permissions,
              created_at, last_seen_at, expires_at, revoked_at, device_label
         from auth_sessions
        where user_id = $1
          and ($2::uuid is null or organization_id = $2::uuid)
        order by created_at desc`,
      [userId, organizationId ?? null],
    );
    return Object.freeze(result.rows.map(rowToSession));
  }

  public async find(sessionId: string): Promise<StoredSession | null> {
    assertUuid(sessionId, 'sessionId');
    const result = await this.pool.query<SessionRow>(
      `select session_id, user_id, organization_id, archive_ids, permissions,
              created_at, last_seen_at, expires_at, revoked_at, device_label
         from auth_sessions
        where session_id = $1`,
      [sessionId],
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }
}
