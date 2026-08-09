import type { SessionPrincipal } from './index.js';

export interface SessionMetadata {
  readonly deviceLabel?: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

export interface StoredSession extends Omit<SessionPrincipal, 'archiveIds' | 'permissions'> {
  readonly sessionId: string;
  readonly archiveIds: readonly string[];
  readonly permissions: readonly string[];
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly revokedAt: string | null;
  readonly deviceLabel: string | null;
}

/**
 * Server-side session inventory contract. Implementations must treat a
 * revoked or expired row as unavailable and must never persist raw bearer
 * tokens, user-agent strings, or source IP addresses.
 */
export interface SessionStore {
  ensure(principal: SessionPrincipal, metadata?: SessionMetadata): Promise<StoredSession | null>;
  rotate(
    currentSessionId: string,
    replacement: SessionPrincipal,
    metadata?: SessionMetadata,
  ): Promise<void>;
  revoke(sessionId: string, reason: string): Promise<void>;
  revokeAllForUser(
    userId: string,
    exceptSessionId?: string,
    organizationId?: string,
  ): Promise<number>;
  listForUser(userId: string, organizationId?: string): Promise<readonly StoredSession[]>;
  find(sessionId: string): Promise<StoredSession | null>;
}
