# AI Family Historian Security

## Security goals
Protect private family media, living-person information, recordings, identities, rights records, generated works, and payment metadata against unauthorized access, cross-tenant disclosure, impersonation, extortion, doxxing, deepfake abuse, destructive loss, and silent alteration.

## Threat model
Primary threats include credential theft, malicious invitees, abusive family members, insecure share links, media parser exploits, poisoned files, prompt injection inside source documents, cross-tenant object access, provider compromise, unauthorized publication, fraudulent voice cloning, defamatory generated claims, support abuse, ransomware, and archive loss.

## Authentication and authorization
Passkeys are preferred; TOTP MFA is available and mandatory for owners, editors with publication rights, support, and administrators. Server sessions are secure, rotated, revocable, and device-visible. Authorization combines organization role, archive role, item visibility, subject consent, rights status, publication state, and purpose. The API rechecks permission for every object download and derivative request.

## Upload security
Use direct signed multipart upload with strict size, type, and count quotas. Finalization independently verifies object size, MIME signature, checksum, ownership, and upload state. Quarantine until ClamAV and parser-safe normalization complete. Never send customer files to public malware scanning services. Run FFmpeg, ImageMagick, OCR, and ExifTool in restricted containers with resource, syscall, network, and time limits.

## Voice and likeness safety
The platform never offers unrestricted cloning. Professional voice workflows require the living subject to complete provider verification in their own identity context. Another person cannot create that professional clone on the subject's behalf. Deceased-person cloning from archived recordings is prohibited. Generated narration carries provenance and disclosure metadata. Any suspected impersonation freezes generation and sharing pending review.

## Editorial and defamation safeguards
High-risk claims involving crimes, abuse, parentage, health, sexuality, finances, immigration, or misconduct receive restricted defaults and a publication review gate. The model cannot convert allegations into stated fact. Living-person allegations require source attribution, owner review, and legal review when publication risk is material.

## Secrets and logs
Secrets live only in secret managers or environment injection, never source. Logs exclude transcript text, images, prompts, names, filenames, addresses, access tokens, signed URLs, and provider payloads. Stable error codes replace sensitive values.

## Encryption and keys
TLS in transit. Provider storage encryption plus application envelope encryption for restricted fields. Per-archive data keys wrapped by KMS. Keys rotate and are versioned. Temporary media scratch is encrypted and wiped. Backups are encrypted and restoration-tested.

## AI and prompt injection
Uploaded content is untrusted evidence, never instruction. The gateway separates policies from source text, scans for injection patterns, constrains output to schemas, validates citations, and rejects tool or command requests embedded in documents. Prohibited content is redacted before external processing.

## API protections
Strict CORS allowlist, CSRF defenses for cookie-authenticated mutations, secure headers, body and upload limits, per-user and per-archive rate limits, webhook signatures, idempotency keys, replay protection, SSRF-resistant fetch allowlists, and no arbitrary URL ingestion.

## Safe migrations and production data
Use expand-migrate-contract. No destructive production query outside reviewed migrations or documented deletion jobs. Developers do not download production media. Support content access is approved, time-limited, visible, and audited.

## Dependency policy
Exact versions and lockfile required. Critical or high exploitable vulnerabilities block release unless a time-bounded ADR documents reachability, compensating control, owner, and expiry.

## Security checks
scripts/security-check.sh verifies secret scanning, dependency policy, insecure patterns, headers, authorization tests, upload constraints, log redaction, provider isolation, and rights enforcement. SECURITY STOP conditions are destructive irreversible action not specified, or a legal/security judgment not answered by approved specs.
