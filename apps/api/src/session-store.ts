import { createHash } from 'node:crypto';
import {
  validateSessionMetadata,
  type SessionMetadata,
  type SessionPrincipal,
  type SessionStore,
  type StoredSession,
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

function canonicalArchivePermissions(
  value: Readonly<Record<string, readonly string[]>> | null | undefined,
): string | null {
  if (!value) return null;
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((archiveId) => [archiveId, [...value[archiveId]!].sort()]),
    ),
  );
}

type SessionRow = {
  session_id: string;
  user_id: string;
  organization_id: string;
  archive_ids: string[];
  permissions: string[];
  archive_permissions: Record<string, string[]> | null;
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
    ...(row.archive_permissions
      ? {
          archivePermissions: Object.freeze(
            Object.fromEntries(
              Object.entries(row.archive_permissions).map(([archiveId, permissions]) => [
                archiveId,
                Object.freeze([...permissions]),
              ]),
            ),
          ),
        }
      : {}),
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
    const validatedMetadata = validateSessionMetadata(metadata);
    assertUuid(principal.sessionId ?? '', 'sessionId');
    assertUuid(principal.userId, 'userId');
    assertUuid(principal.organizationId, 'organizationId');
    for (const archiveId of principal.archiveIds) assertUuid(archiveId, 'archiveId');
    await this.pool.query(
      `insert into auth_sessions(
         session_id, user_id, organization_id, archive_ids, permissions, archive_permissions,
         device_label, user_agent_hash, ip_hash, expires_at
       ) values ($1,$2,$3,$4::uuid[],$5::text[],$6::jsonb,$7,$8,$9,to_timestamp($10))
       on conflict (session_id) do nothing`,
      [
        principal.sessionId,
        principal.userId,
        principal.organizationId,
        principal.archiveIds,
        principal.permissions,
        principal.archivePermissions ? JSON.stringify(principal.archivePermissions) : null,
        validatedMetadata.deviceLabel ?? null,
        hashMetadata(validatedMetadata.userAgent),
        hashMetadata(validatedMetadata.ipAddress),
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
      !sameValues(existing.permissions, principal.permissions) ||
      canonicalArchivePermissions(existing.archivePermissions) !==
        canonicalArchivePermissions(principal.archivePermissions)
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
    const validatedMetadata = validateSessionMetadata(metadata);
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
        archive_permissions: Record<string, string[]> | null;
      }>(
        `select session_id, user_id, organization_id, archive_ids, permissions, archive_permissions
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
        !sameValues(currentRow.permissions, replacement.permissions) ||
        canonicalArchivePermissions(currentRow.archive_permissions) !==
          canonicalArchivePermissions(replacement.archivePermissions)
      )
        throw new Error('AUTH_REQUIRED');
      await client.query(
        `update auth_sessions set revoked_at = now(), revoked_reason = 'rotated'
          where session_id = $1 and revoked_at is null`,
        [currentSessionId],
      );
      await client.query(
        `insert into auth_sessions(
           session_id, user_id, organization_id, archive_ids, permissions, archive_permissions,
           device_label, user_agent_hash, ip_hash, expires_at
         ) values ($1,$2,$3,$4::uuid[],$5::text[],$6::jsonb,$7,$8,$9,to_timestamp($10))`,
        [
          replacement.sessionId,
          replacement.userId,
          replacement.organizationId,
          replacement.archiveIds,
          replacement.permissions,
          replacement.archivePermissions ? JSON.stringify(replacement.archivePermissions) : null,
          validatedMetadata.deviceLabel ?? null,
          hashMetadata(validatedMetadata.userAgent),
          hashMetadata(validatedMetadata.ipAddress),
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
      `select session_id, user_id, organization_id, archive_ids, permissions, archive_permissions,
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
      `select session_id, user_id, organization_id, archive_ids, permissions, archive_permissions,
              created_at, last_seen_at, expires_at, revoked_at, device_label
         from auth_sessions
        where session_id = $1`,
      [sessionId],
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }
}
