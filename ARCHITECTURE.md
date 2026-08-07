# AI Family Historian Architecture

## Purpose
Define the production architecture for a private family-memory capture, preservation, editing, and publication SaaS. The system must preserve source truth, rights, provenance, and portability while using external AI only as a bounded processor.

## System overview
The launch system is a TypeScript modular monolith with independently scalable worker processes. The web client records interviews and manages archives. The API owns identity, permissions, records, rights, and workflow commands. PostgreSQL owns structured truth. R2 owns immutable original media and reproducible derivatives. Redis/BullMQ coordinates bounded jobs. The media package now emits explicit, sandbox-oriented ClamAV, ExifTool, FFmpeg, ImageMagick, OCR, and packaging plans; restricted worker execution and hosted tool verification remain release work. The AI Policy Gateway is the only route to DeepSeek, transcription, and narration providers.

## Repository map
- apps/web: customer UI, interview recorder, transcript editor, timeline, archive, publishing studio.
- apps/api: Fastify HTTP boundary, auth, OpenAPI, commands, queries, provider webhooks.
- apps/worker: queues for media, OCR, transcription, extraction, editorial generation, exports, deletion.
- apps/admin: planned audited support, rights review, abuse review, and operations UI; current bounded launch keeps these controls behind API/domain gates.
- packages/domain: entities, invariants, workflows, rights, provenance, publication state.
- packages/contracts: canonical request, response, event, and job schemas.
- packages/database: Drizzle schema, migrations, RLS, repositories, transaction boundaries.
- packages/storage: object naming, multipart upload, fixity, retention, signed access.
- packages/media: quarantine state machine, immutable-original checks, derivative plans, and command builders for FFmpeg/ImageMagick/ExifTool/OCR.
- packages/ai-gateway: redaction, consent checks, prompt registry, cache families, provider adapters, output validation.
- packages/provenance: evidence spans, quote lineage, generation lineage, tamper-evident manifests, and checksums.
- packages/publishing: release-gated chapter assembly, PDF, EPUB, narration manifests, index and export artifacts.
- packages/permissions: domain visibility and subject-right checks (currently surfaced through `packages/domain`).
- packages/audit: append-only, content-redacted security and provenance events.
- tests: unit, integration, E2E, live-fire, accessibility, performance, media, privacy, security.

## Code import law
1. packages/domain imports only packages/contracts primitives and pure utilities.
2. packages/contracts imports no application, database, provider, or UI module.
3. packages/database implements domain repository interfaces and may import domain and contracts; domain never imports database.
4. packages/storage and packages/media implement infrastructure interfaces and never mutate domain records directly.
5. apps/api and apps/worker orchestrate domain services and adapters; provider SDKs may appear only in adapter packages.
6. apps/web imports generated contracts and UI packages, never database or provider SDKs.
7. The AI Policy Gateway is the exclusive external language, transcription, and narration boundary.

## Runtime flows
### Interview
Browser obtains a short-lived recording session, presents versioned consent, records chunks, uploads through signed multipart URLs, and finalizes with checksums. A worker scans and normalizes media, produces playback derivatives, submits consent-approved audio for transcription, stores word-level transcript evidence, and creates candidate entities. The subject or editor corrects and approves transcript sections before quotation eligibility.

### Source ingestion
Original bytes are immutable. Each object receives SHA-256 fixity, MIME verification, metadata extraction, malware scan result, rights record, visibility policy, and derivative plan. Derivatives can be regenerated from originals and are never authoritative.

### Narrative generation
The service constructs a stable cache prefix containing platform policy, editorial rules, output schema, and task-family instructions; appends a versioned archive capsule containing only approved facts; appends source excerpts with evidence identifiers; then appends the current request. The response must contain claim-to-evidence mappings. Validation rejects unsupported quotations, invented dates, uncited factual claims, or references to inaccessible sources.

### Publishing
A publication edition pins source versions, transcript approvals, chapter versions, image selections, caption approvals, rights status, and generation lineage. Deterministic templates build HTML, PDF, EPUB, and audiobook manifests. Publication requires a rights gate and owner approval; public sharing is never automatic.

## State and truth rules
- Original media bytes and fixity manifests are immutable.
- Corrected transcript revisions are append-only; approved quotations pin exact revision and offsets.
- Candidate facts are not historical truth.
- Confirmed facts include confirmer, time, evidence, confidence, visibility, and dispute state.
- Multiple conflicting recollections may coexist.
- Generated prose is versioned and attributed to model, prompt, input evidence, and approver.
- A quotation may never be generated, normalized beyond approved editorial rules, or silently paraphrased.
- Archive deletion removes content and processor copies while retaining only narrowly documented legal/security evidence.

## External boundaries
DeepSeek: editorial and reasoning tasks only after consent and redaction. Deepgram: transcription only for opted-in recordings. Local Whisper is the fallback for projects that prohibit external audio processing. ElevenLabs: stock narration or living subject self-verified voice only. R2: encrypted object storage. Stripe: payment. Resend: transactional communication. Print providers receive only approved edition artifacts and shipping details for a specific order.

## Cache architecture
Canonical prefix order is global editorial law, task-family rules, output schema, stable style guide, versioned archive capsule, source excerpts, then volatile instruction. JSON key order, whitespace, tool order, and schemas are byte-stable. Application exact-result cache runs before DeepSeek. Cache success is measured as reusable-prefix hit ratio, total input-token hit ratio, avoided-call ratio, and effective dollar cost. Padding, oversharing, or retaining data solely to improve cache metrics is forbidden.

## Security boundaries
All requests carry organization and archive scope. RLS and application authorization both enforce isolation. Original media uses opaque object keys and short-lived signed URLs. Temporary worker files use encrypted ephemeral storage and are wiped after job completion. Support access is just-in-time, purpose-bound, approved, and audited. Provider callbacks are signature-verified and idempotent.

## Validation and errors
Zod validates every trust boundary. Domain errors are stable typed codes. Provider errors are mapped and redacted. Media jobs retain bounded diagnostic metadata but no source content in logs. Failed jobs are retryable only under LOOPS.md budgets and dead-letter safely.

## Observability
Structured logs include trace_id, archive_id pseudonym, job_id, task_family, provider, cache counts, media duration, bytes, status, and redaction counts. Logs exclude names, transcript text, prompts, source excerpts, filenames, addresses, and raw provider payloads.

## Architectural invariants
INV-001 Structured approved source records, not model output, are authoritative.
INV-002 Every published factual claim maps to evidence or is visibly labeled interpretation.
INV-003 Every published quotation maps byte-for-byte to an approved source span.
INV-004 No external provider receives content without current purpose-specific consent.
INV-005 Voice generation uses licensed stock voices or the living subject's verified self-voice only.
INV-006 Original media is immutable and fixity-verifiable.
INV-007 Public sharing and print fulfillment require explicit edition approval.
INV-008 Rights and visibility checks run at read, export, share, generation, and publication boundaries.
INV-009 AI, transcription, TTS, and print providers are replaceable adapters.
INV-010 Cache optimization never overrides minimization, consent, rights, deletion, or purpose limitation.
INV-011 Every destructive workflow is delayed, auditable, idempotent, and verifiable.
INV-012 Open export formats prevent platform lock-in.

## Forbidden moves
No direct provider calls outside gateways; no mutable originals; no generated quotations; no facial recognition; no posthumous voice cloning; no production demo mode; no public-by-default resources; no provider content logging; no rights checks delegated only to the UI; no permanent media in worker scratch storage.

## Change procedures
A feature starts with spec and vocabulary changes, then contracts, domain rules, migration, adapters, tests, and documentation. A dependency requires evidence, exact pinning, security review, and DECISIONS.md entry. A schema change uses expand-migrate-contract. A provider integration requires preflight credentials, a read-only probe, contract snapshot, data-flow update, deletion behavior, fallback, and live-fire proof.

## Architecture review checklist
Verify all invariants, import boundaries, consent checks, rights gates, evidence lineage, export portability, provider isolation, job idempotence, deletion propagation, cache metrics, and real-dependency tests before approval.
