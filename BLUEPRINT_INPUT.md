# 6LAYER Filled Input: AI Family Historian

## Project Name
AI Family Historian

## Project Description
A privacy-first, multi-tenant SaaS that interviews living story subjects, ingests family photographs, documents, audio, video, letters, recipes, timelines, and genealogical context, then converts verified source material into an evidence-linked family archive. The product produces edited memoirs, printed-book-ready manuscripts, narrated audiobooks, searchable transcripts, interactive timelines, family trees, topic collections, private family portals, and preservation exports. DeepSeek V4 Flash performs bounded interviewing, organization, editorial assistance, contradiction detection, translation assistance, and narrative drafting through an isolated AI Policy Gateway. Source media, approved transcripts, provenance records, and human-confirmed facts remain authoritative. AI prose is always distinguishable from quoted source material.

## Product Goal
Create the most trusted and automated family-history production platform for older adults and their families. It must support at least 1,000 family archives on the launch architecture, handle large media uploads safely, preserve provenance and consent, generate polished multi-format deliverables, maintain at least 97 percent cache hits on cache-eligible repeated DeepSeek prefixes, and prevent fabricated memories, unauthorized voice or likeness use, privacy violations, and accidental publication of sensitive family claims.

## Target Users
Older adults and retirees preserving their life stories; adult children buying preservation packages for parents or grandparents; family historians and genealogists; diaspora and immigrant families preserving multilingual oral history; military families; adoptees and blended families; professional memoir interviewers; senior-living communities; hospice and palliative-care partners subject to appropriate consent and healthcare boundaries; libraries, historical societies, and cultural organizations operating private projects.

## Core User Outcomes
1. Create a private family archive, invite contributors, and assign owner, subject, interviewer, editor, fact-checker, viewer, and legacy-steward roles.
2. Capture a guided audio or video interview with consent, pause and resume safely, transcribe it, identify speakers, and allow line-level correction.
3. Upload large photographs, scans, documents, audio, and video through resumable multipart upload with malware scanning, deduplication, checksums, metadata, and preservation derivatives.
4. Extract candidate people, places, dates, events, relationships, quotations, recipes, artifacts, and themes with source-level citations and human confirmation.
5. Build a versioned family timeline and relationship graph while representing uncertainty, conflicting recollections, aliases, approximate dates, and disputed claims without forcing false certainty.
6. Draft a memoir chapter using confirmed facts and approved quotations only, with every factual claim traceable to source evidence and all connective AI prose labeled in provenance metadata.
7. Generate a print-ready book manuscript, cover inputs, image captions, index inputs, source notes, and accessible PDF and EPUB exports.
8. Generate a narrated audiobook using a licensed stock voice or the living subject's independently verified self-voice; prohibit unauthorized impersonation and prohibit creating another person's professional voice clone.
9. Create a private searchable family portal with granular per-item visibility, living-person privacy controls, embargo dates, download controls, and revocable share links.
10. Export the complete archive in documented portable formats, including originals, derivatives, checksums, transcripts, structured metadata, provenance, permissions, and generated works.
11. Delete an archive or selected media through a verifiable deletion workflow that propagates to processors where contractually supported and preserves only legally required records.
12. Record consent, copyright ownership or license, publicity and likeness rights, voice rights, contributor releases, withdrawal, deceased-person handling, and publication approval for every relevant subject and asset.
13. Detect likely contradictions, unsupported claims, defamatory or highly sensitive allegations, and living-person privacy risks before sharing or publication.
14. Measure DeepSeek cache-hit, cache-miss, latency, token, redaction, provenance, hallucination, and cost telemetry without logging source content.
15. Purchase a concierge, self-service, family, or institutional subscription and manage usage, storage, transcription, narration, print-production, and renewal limits.
16. Complete an annual archive review covering broken permissions, departed contributors, stale links, missing rights, preservation fixity, new interviews, and export readiness.

## Existing Repository Status
Greenfield.

## Preferred Tech Stack
Frontend: Next.js 16, React, TypeScript, Tailwind CSS, Radix UI, React Hook Form, Zod, TipTap collaborative editor, waveform and transcript components, Playwright.
Backend: TypeScript modular monolith using Fastify with OpenAPI, BullMQ workers, FFmpeg media workers, and a provider-isolated AI and media processing gateway.
Database: PostgreSQL 17 with pgvector, Drizzle ORM, row-level security, temporal/version tables, application-level envelope encryption, and append-only provenance events.
Authentication: Better Auth with passkeys, TOTP MFA, Argon2id password fallback, secure server-side sessions, device management, contributor invitations, and recovery controls.
Hosting / Deployment: Cloudflare DNS, CDN, WAF, Turnstile, Stream optional for private playback, and R2 object storage; containerized web/API and workers on Fly.io; managed PostgreSQL on Neon; Upstash Redis; GitHub Actions.
Testing: Vitest, Testcontainers, Playwright, axe-core, k6, OpenAPI contract tests, FFmpeg media fixture verification, POSIX shell gates.
Package Manager: pnpm 10 pinned through Corepack.
CI/CD: GitHub Actions with immutable lockfile installation, migration checks, media pipeline tests, full verify, image build, staging deployment, and manual production approval.
Observability: OpenTelemetry, Sentry, structured JSON logs with Pino, Prometheus-compatible metrics, media-job telemetry, and external uptime checks.

## External Services, APIs, and Credentials Already Known
DeepSeek Open Platform API for language tasks; Deepgram for primary speech-to-text with a local Whisper fallback for consent-sensitive projects; ElevenLabs only for licensed narration and verified self-voice workflows; Neon PostgreSQL; Upstash Redis; Cloudflare R2, Turnstile, DNS, WAF, and optional Stream; Stripe Billing; Resend transactional email; Sentry; GitHub Actions and GitHub Container Registry; Fly.io; local ClamAV; local FFmpeg, ExifTool, ImageMagick, OCRmyPDF, and PaddleOCR; optional Lulu Direct or another approved print-on-demand provider after contractual and API verification.

## Agent Platforms Expected To Run This Pack
Claude Code, Codex CLI, Hermes, OpenClaw, and any terminal agent able to read, edit, and execute repository commands.

## Auto-Deploy Authorization
No. The run ends at a proven, tagged, ship-ready artifact and emits one exact manual production deployment command.

## Business Constraints
Launch concierge-assisted before pure self-service; startup infrastructure must remain lean; target core platform infrastructure below 1,200 USD monthly at 1,000 archives excluding pass-through transcription, narration, print, and excess storage; subscriptions and usage credits must prevent unbounded media costs; no advertising, data sale, data brokerage, public training corpus, or hidden model training; customers retain ownership of source material; generated-work rights and licenses must be stated clearly; customer media may never be used for product marketing without separate opt-in permission.

## Technical Constraints
Modular monolith first; separate scalable media-worker pool; direct resumable multipart uploads; immutable originals with fixity hashes; derivative regeneration; no production GPU requirement; DeepSeek only through the AI Policy Gateway; provider abstraction mandatory; stable canonical prompt prefixes; versioned archive capsules; deterministic extraction and search before LLM use; source-citation enforcement; no model output accepted as historical fact without evidence and confirmation; all jobs idempotent; safe schema migrations; support 1,000 archives without redesign and scale horizontally.

## Security / Compliance Constraints
NIST-aligned risk management; OWASP ASVS Level 2 baseline; OWASP API Security Top 10; strong encryption; tenant isolation; least privilege; passkeys and MFA; immutable audit and provenance logging; customer-approved support access; secure SDLC; vendor risk review; incident response; copyright and takedown process; privacy-rights workflow; consent and release records; voice and likeness safeguards; child-safety and minor-content rules; abuse prevention against impersonation, fraud, harassment, doxxing, and non-consensual intimate content; legal review and cyber plus technology E&O and media liability insurance before production.

## Performance Requirements
P95 ordinary authenticated API latency below 400 ms excluding asynchronous AI and media jobs; P95 dashboard interactive below 3 seconds on normal broadband; resumable upload acknowledgement below 2 seconds; support 1,000 archives, 250 monthly active archives, 50 simultaneous interviews, 20 concurrent uploads, and configurable media-worker concurrency; progressive playback derivatives; queue backpressure; at least 97 percent cache hits on cache-eligible repeated DeepSeek prefix tokens and at least 90 percent overall input-token cache-hit target after warming; Max Thinking under 3 percent of calls; task token and dollar ceilings; export of a 25 GB archive completes asynchronously with resumability and integrity manifest.

## Accessibility Requirements
WCAG 2.2 AA target; keyboard complete; semantic HTML; visible focus; at least 18 px default body text; 44 by 44 pixel targets; no color-only status; transcript keyboard navigation; captions; transcript correction; audio descriptions metadata; plain-language errors; printable workflows; reduced motion; accessible PDF and EPUB generation targets.

## Data / Privacy Requirements
Data minimization and private-by-default sharing; explicit consent before recording; visible recording state; per-subject and per-asset rights records; no silent recording; separate consent for AI processing, transcription, voice generation, publication, marketing, and public sharing; strong living-person privacy controls; minors require verified guardian authority and heightened defaults; sensitive stories and allegations require restricted visibility and review; DeepSeek processing off until enabled; redaction and DLP gateway; no provider-training or retention promises unless contractually verified; configurable retention; verified deletion and export; subprocessor register; data-processing records; DPIA; state-law matrix maintained by counsel; no sale, targeted advertising, or data-broker activity; preserve consent and rights evidence after content deletion only where legally required and documented.

## Integrations
DeepSeek API, Deepgram API, optional local Whisper, ElevenLabs restricted narration, Stripe Billing, Resend, Cloudflare R2 and Turnstile, optional Cloudflare Stream, Neon, Upstash, Sentry, OpenTelemetry, Fly.io, GitHub, local ClamAV, FFmpeg, ExifTool, ImageMagick, OCRmyPDF, browser MediaRecorder and WebAuthn, optional print-on-demand provider after preflight approval.

## Non-Goals
No public social network; no scraping genealogy sites without licensed APIs and user authorization; no definitive genealogy claims from model inference; no facial recognition; no biometric identity matching; no unauthorized voice cloning; no cloning a deceased person's voice from family recordings; no deepfake video; no synthetic statement presented as a real quotation; no hidden reconstruction of missing memories; no legal determination of copyright, defamation, inheritance, or publicity rights; no therapy, healthcare, hospice documentation, or medical advice; no automatic publication; no public archive by default; no minors as account owners; no DNA storage or genetic analysis; no permanent lock-in to proprietary formats.

## Timeline / Milestones
Sixteen-week revenue-first launch: weeks 1-2 foundation, threat model, consent model, and media spike; weeks 3-4 core archive domain and provenance; weeks 5-6 persistence, large upload, fixity, and derivatives; weeks 7-8 interview, transcription, speaker correction, and extraction; weeks 9-10 editor, timeline, family graph, and source citations; weeks 11-12 book, EPUB, PDF, audiobook, and private portal exports; weeks 13-14 auth, rights, privacy, billing, and abuse controls; week 15 live-fire, accessibility, performance, preservation, and operations; week 16 counsel, insurer, pilot, and ship readiness.

## Deployment Target
Staging and production Fly.io applications in a US region, Cloudflare edge and R2 with configured jurisdiction controls where available, Neon US PostgreSQL, Upstash US Redis, GitHub Container Registry, isolated media-worker machines with temporary encrypted scratch storage. Production deployment is manual after all gates, vendor reviews, rights documents, and insurance reviews pass.

## Runtime Budgets
Each milestone maximum six attempts; ordinary milestones 90 minutes; media processing, auth, consent, rights, deletion, portability, provenance, and live-fire milestones 180 minutes. AI, transcription, TTS, media, storage, and print jobs enforce per-plan duration, size, concurrency, token, and dollar ceilings.

## Special Instructions
Rights, privacy, consent, provenance, and editorial truthfulness are product architecture. Produce a layered Privacy Policy, Terms of Service, AI Processing Notice, Recording and Interview Consent, Contributor Release, Publication Approval, Voice and Likeness Policy, Copyright and Takedown Policy, Minor Content Policy, Editorial Ethics Policy, Subprocessor Register, Retention Schedule, DPA template, DPIA, Incident Response Plan, and counsel review checklist. Every quotation must be either verbatim from an approved transcript/source or explicitly marked as paraphrase. Every generated historical claim requires evidence or must be labeled as unverified interpretation. DeepSeek remains optional, isolated, replaceable, and barred from prohibited sensitive content. Cache optimization never overrides minimization, rights, consent, purpose limitation, or deletion.
