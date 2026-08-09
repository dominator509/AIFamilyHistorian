import type { SessionPrincipal } from './index.js';

export interface SessionMetadata {
  readonly deviceLabel?: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
}

export const MAX_SESSION_DEVICE_LABEL_CHARS = 256;
export const MAX_SESSION_USER_AGENT_CHARS = 2_048;
export const MAX_SESSION_IP_ADDRESS_CHARS = 128;

export function validateSessionMetadata(metadata: SessionMetadata = {}): SessionMetadata {
  if (
    metadata.deviceLabel !== undefined &&
    (typeof metadata.deviceLabel !== 'string' ||
      metadata.deviceLabel.length > MAX_SESSION_DEVICE_LABEL_CHARS)
  )
    throw new Error('SESSION_METADATA_INVALID');
  if (
    metadata.userAgent !== undefined &&
    (typeof metadata.userAgent !== 'string' ||
      metadata.userAgent.length > MAX_SESSION_USER_AGENT_CHARS)
  )
    throw new Error('SESSION_METADATA_INVALID');
  if (
    metadata.ipAddress !== undefined &&
    (typeof metadata.ipAddress !== 'string' ||
      metadata.ipAddress.length > MAX_SESSION_IP_ADDRESS_CHARS)
  )
    throw new Error('SESSION_METADATA_INVALID');
  return Object.freeze({
    ...(metadata.deviceLabel !== undefined ? { deviceLabel: metadata.deviceLabel } : {}),
    ...(metadata.userAgent !== undefined ? { userAgent: metadata.userAgent } : {}),
    ...(metadata.ipAddress !== undefined ? { ipAddress: metadata.ipAddress } : {}),
  });
}

export interface StoredSession extends Omit<
  SessionPrincipal,
  'archiveIds' | 'permissions' | 'archivePermissions'
> {
  readonly sessionId: string;
  readonly archiveIds: readonly string[];
  readonly permissions: readonly string[];
  readonly archivePermissions?: Readonly<Record<string, readonly string[]>>;
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
  revoke(sessionId: string, reason: string, organizationId?: string): Promise<void>;
  revokeAllForUser(
    userId: string,
    exceptSessionId?: string,
    organizationId?: string,
  ): Promise<number>;
  listForUser(userId: string, organizationId?: string): Promise<readonly StoredSession[]>;
  find(sessionId: string): Promise<StoredSession | null>;
}
