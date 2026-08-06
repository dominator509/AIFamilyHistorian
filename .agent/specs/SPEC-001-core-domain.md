# Spec 001 Core Domain

## Canonical entities
Organization, FamilyArchive, Person, LivingSubject, DeceasedSubject, Membership, Role, PermissionGrant, RecordingSession, ConsentRecord, ContributorRelease, RightsClaim, PublicationApproval, MediaAsset, OriginalObject, DerivativeObject, FixityRecord, Transcript, TranscriptRevision, TranscriptSpan, Speaker, CandidateFact, ConfirmedFact, DisputedClaim, EvidenceLink, Quotation, PersonRelationship, Place, LifeEvent, TimelineEntry, Recipe, Artifact, Theme, StoryPrompt, InterviewPlan, Chapter, ChapterRevision, Edition, BookExport, EpubExport, AudiobookExport, PortalShare, Embargo, VoiceAuthorization, NarrationJob, PrivacyRequest, DeletionJob, ExportJob, AuditEvent, ProvenanceEvent, Subscription, UsageLedger, WorkflowRun.

## Invariants
1. OriginalObject bytes never mutate.
2. Quotation text equals an approved TranscriptSpan or approved document span.
3. ConfirmedFact has at least one EvidenceLink and a confirmer.
4. DisputedClaim can coexist with competing claims.
5. PublicationApproval pins one immutable Edition hash.
6. VoiceAuthorization is valid only for stock licenses or the living subject's verified self-voice.
7. Rights and consent are purpose-specific and revocable for future processing.
8. A generated ChapterRevision records model, prompt, inputs, citations, and approver.
9. Every share and export applies item visibility and living-person restrictions.
10. Deletion is idempotent and produces processor and storage evidence.
