import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const consentStatus = pgEnum('consent_status', [
  'pending',
  'granted',
  'withdrawn',
  'expired',
  'disputed',
]);
export const rightsStatus = pgEnum('rights_status', [
  'pending',
  'verified',
  'restricted',
  'disputed',
  'expired',
]);
export const transcriptStatus = pgEnum('transcript_status', [
  'processing',
  'draft',
  'corrected',
  'approved',
  'restricted',
]);
export const factStatus = pgEnum('fact_status', [
  'candidate',
  'confirmed',
  'disputed',
  'rejected',
  'superseded',
]);
export const editionStatus = pgEnum('edition_status', [
  'draft',
  'rights_review',
  'owner_review',
  'approved',
  'generating',
  'ready',
  'withdrawn',
]);
export const jobStatus = pgEnum('job_status', [
  'queued',
  'running',
  'retryable_failed',
  'terminal_failed',
  'completed',
  'cancelled',
]);
export const visibility = pgEnum('visibility', [
  'owner_only',
  'selected_contributors',
  'family_members',
  'link_recipients',
  'public_approved',
]);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

export const familyArchives = pgTable(
  'family_archives',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    aiProcessingEnabled: boolean('ai_processing_enabled').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index('family_archives_org_idx').on(table.organizationId)],
);

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    displayNameEncrypted: text('display_name_encrypted').notNull(),
    isLiving: boolean('is_living').notNull(),
    visibility: visibility('visibility').notNull().default('owner_only'),
    createdAt: createdAt(),
  },
  (table) => [index('people_scope_idx').on(table.organizationId, table.familyArchiveId)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('memberships_archive_user_idx').on(table.familyArchiveId, table.userId)],
);

export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => people.id),
    purpose: text('purpose').notNull(),
    policyVersion: text('policy_version').notNull(),
    status: consentStatus('status').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('consent_subject_purpose_idx').on(table.subjectId, table.purpose, table.createdAt),
  ],
);

export const rightsClaims = pgTable('rights_claims', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  familyArchiveId: uuid('family_archive_id')
    .notNull()
    .references(() => familyArchives.id),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  basis: text('basis').notNull(),
  status: rightsStatus('status').notNull(),
  evidenceObjectKey: text('evidence_object_key'),
  createdAt: createdAt(),
});

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    mediaType: text('media_type').notNull(),
    visibility: visibility('visibility').notNull().default('owner_only'),
    rightsStatus: rightsStatus('rights_status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (table) => [index('media_scope_idx').on(table.organizationId, table.familyArchiveId)],
);

export const originalObjects = pgTable(
  'original_objects',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id),
    objectKey: text('object_key').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    quarantineStatus: text('quarantine_status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('original_objects_key_idx').on(table.objectKey),
    uniqueIndex('original_objects_fixity_idx').on(table.familyArchiveId, table.sha256),
  ],
);

export const derivativeObjects = pgTable(
  'derivative_objects',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    originalObjectId: uuid('original_object_id')
      .notNull()
      .references(() => originalObjects.id),
    objectKey: text('object_key').notNull(),
    recipeVersion: text('recipe_version').notNull(),
    sha256: text('sha256').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('derivative_objects_key_idx').on(table.objectKey),
    uniqueIndex('derivative_objects_recipe_idx').on(table.originalObjectId, table.recipeVersion),
  ],
);

export const transcriptRevisions = pgTable('transcript_revisions', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  familyArchiveId: uuid('family_archive_id')
    .notNull()
    .references(() => familyArchives.id),
  mediaAssetId: uuid('media_asset_id')
    .notNull()
    .references(() => mediaAssets.id),
  priorRevisionId: uuid('prior_revision_id'),
  status: transcriptStatus('status').notNull(),
  encryptedText: text('encrypted_text').notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const evidenceLinks = pgTable('evidence_links', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  familyArchiveId: uuid('family_archive_id')
    .notNull()
    .references(() => familyArchives.id),
  sourceId: uuid('source_id').notNull(),
  revisionId: uuid('revision_id').notNull(),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
  createdAt: createdAt(),
});

export const confirmedFacts = pgTable('confirmed_facts', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  familyArchiveId: uuid('family_archive_id')
    .notNull()
    .references(() => familyArchives.id),
  encryptedText: text('encrypted_text').notNull(),
  confirmerId: uuid('confirmer_id').notNull(),
  status: factStatus('status').notNull().default('confirmed'),
  createdAt: createdAt(),
});

export const factEvidence = pgTable(
  'fact_evidence',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    factId: uuid('fact_id')
      .notNull()
      .references(() => confirmedFacts.id),
    evidenceLinkId: uuid('evidence_link_id')
      .notNull()
      .references(() => evidenceLinks.id),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('fact_evidence_unique_idx').on(table.factId, table.evidenceLinkId)],
);

export const quotations = pgTable('quotations', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  familyArchiveId: uuid('family_archive_id')
    .notNull()
    .references(() => familyArchives.id),
  transcriptRevisionId: uuid('transcript_revision_id')
    .notNull()
    .references(() => transcriptRevisions.id),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
  exactTextEncrypted: text('exact_text_encrypted').notNull(),
  createdAt: createdAt(),
});

export const editions = pgTable(
  'editions',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    editionHash: text('edition_hash').notNull(),
    status: editionStatus('status').notNull().default('draft'),
    manifest: jsonb('manifest').notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('editions_hash_idx').on(table.familyArchiveId, table.editionHash)],
);

export const publicationApprovals = pgTable('publication_approvals', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  familyArchiveId: uuid('family_archive_id')
    .notNull()
    .references(() => familyArchives.id),
  editionId: uuid('edition_id')
    .notNull()
    .references(() => editions.id),
  editionHash: text('edition_hash').notNull(),
  approverId: uuid('approver_id').notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const deletionJobs = pgTable(
  'deletion_jobs',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    familyArchiveId: uuid('family_archive_id')
      .notNull()
      .references(() => familyArchives.id),
    status: jobStatus('status').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    graceEndsAt: timestamp('grace_ends_at', { withTimezone: true }).notNull(),
    evidence: jsonb('evidence').notNull().default([]),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('deletion_jobs_idempotency_idx').on(table.organizationId, table.idempotencyKey),
  ],
);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  familyArchiveId: uuid('family_archive_id').references(() => familyArchives.id),
  actorPseudonym: text('actor_pseudonym').notNull(),
  action: text('action').notNull(),
  outcome: text('outcome').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
});

export const provenanceEvents = pgTable('provenance_events', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id),
  familyArchiveId: uuid('family_archive_id')
    .notNull()
    .references(() => familyArchives.id),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  lineage: jsonb('lineage').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
});
