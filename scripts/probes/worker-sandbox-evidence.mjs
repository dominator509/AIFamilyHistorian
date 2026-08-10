import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_CONTROLS = [
  'syscall_profile',
  'network_egress_deny',
  'read_only_root',
  'no_new_privileges',
  'capability_drop',
  'pid_limit',
  'cpu_memory_limits',
  'scratch_mount',
];

const MAX_FIELD_CHARS = 512;
const MAX_ATTESTATION_BYTES = 64 * 1024;
const MAX_PUBLIC_KEY_BYTES = 16 * 1024;

function assertBoundedString(value, field) {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > MAX_FIELD_CHARS ||
    [...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    })
  )
    throw new Error(`worker sandbox evidence: ${field} is invalid`);
}

export function signedAttestationPayload(input) {
  return JSON.stringify({
    schema_version: input.schema_version,
    issuer: input.issuer,
    subject: input.subject,
    evidence_id: input.evidence_id,
    deployment_image_digest: input.deployment_image_digest,
    deployment_app: input.deployment_app,
    deployment_worker_id: input.deployment_worker_id,
    issued_at: input.issued_at,
    expires_at: input.expires_at,
    controls: Object.fromEntries(
      REQUIRED_CONTROLS.map((control) => [control, input.controls?.[control]]),
    ),
  });
}

export function validateWorkerSandboxAttestation(input, now = Date.now(), expected = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('worker sandbox evidence: root must be an object');
  if (input.schema_version !== 'worker-sandbox-attestation/v1')
    throw new Error('worker sandbox evidence: unsupported schema_version');
  for (const field of [
    'issuer',
    'subject',
    'evidence_id',
    'deployment_image_digest',
    'deployment_app',
    'deployment_worker_id',
    'signature',
    'signature_algorithm',
  ])
    assertBoundedString(input[field], field);
  if (!/^sha256:[0-9a-f]{64}$/u.test(input.deployment_image_digest))
    throw new Error('worker sandbox evidence: deployment_image_digest is invalid');
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (expectedValue && input[field] !== expectedValue)
      throw new Error(`worker sandbox evidence: ${field} does not match the deployed workload`);
  }
  assertBoundedString(input.issued_at, 'issued_at');
  assertBoundedString(input.expires_at, 'expires_at');
  const issuedAt = Date.parse(input.issued_at);
  const expiresAt = Date.parse(input.expires_at);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt)
    throw new Error('worker sandbox evidence: attestation timestamps are invalid');
  if (issuedAt > now + 5 * 60 * 1000 || expiresAt <= now)
    throw new Error('worker sandbox evidence: attestation is not currently valid');
  if (expiresAt - issuedAt > 366 * 24 * 60 * 60 * 1000)
    throw new Error('worker sandbox evidence: attestation validity is too long');
  if (!input.controls || typeof input.controls !== 'object' || Array.isArray(input.controls))
    throw new Error('worker sandbox evidence: controls must be an object');
  for (const control of REQUIRED_CONTROLS) {
    if (input.controls[control] !== true)
      throw new Error(`worker sandbox evidence: control ${control} is not affirmed`);
  }
  if (input.signature_algorithm !== 'ed25519')
    throw new Error('worker sandbox evidence: unsupported signature algorithm');
  if (!/^[A-Za-z0-9_-]{86}$/u.test(input.signature))
    throw new Error('worker sandbox evidence: signature encoding is invalid');
  return true;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('worker sandbox evidence: evidence file is required');
  const bytes = await readFile(filePath);
  if (bytes.byteLength > MAX_ATTESTATION_BYTES)
    throw new Error('worker sandbox evidence: attestation exceeds 64 KiB');
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('worker sandbox evidence: attestation is not valid JSON');
  }
  const nowOverride = process.env.WORKER_SANDBOX_EVIDENCE_NOW;
  const now = nowOverride ? Number(nowOverride) : Date.now();
  if (!Number.isFinite(now)) throw new Error('worker sandbox evidence: clock override is invalid');
  validateWorkerSandboxAttestation(parsed, now, {
    deployment_image_digest: process.env.WORKER_SANDBOX_EVIDENCE_EXPECTED_IMAGE_DIGEST,
    deployment_app: process.env.WORKER_SANDBOX_EVIDENCE_EXPECTED_APP,
    deployment_worker_id: process.env.WORKER_SANDBOX_EVIDENCE_EXPECTED_WORKER_ID,
  });
  const publicKeyPath = process.env.WORKER_SANDBOX_EVIDENCE_PUBLIC_KEY_FILE;
  if (!publicKeyPath) throw new Error('worker sandbox evidence: public key file is required');
  const publicKeyBytes = await readFile(publicKeyPath);
  if (publicKeyBytes.byteLength > MAX_PUBLIC_KEY_BYTES)
    throw new Error('worker sandbox evidence: public key exceeds 16 KiB');
  let publicKey;
  try {
    publicKey = createPublicKey(publicKeyBytes);
  } catch {
    throw new Error('worker sandbox evidence: public key is invalid');
  }
  const expectedPublicKeySha256 = process.env.WORKER_SANDBOX_EVIDENCE_EXPECTED_PUBLIC_KEY_SHA256;
  if (expectedPublicKeySha256 !== undefined) {
    if (!/^[0-9a-f]{64}$/iu.test(expectedPublicKeySha256))
      throw new Error('worker sandbox evidence: expected public key fingerprint is invalid');
    const actualPublicKeySha256 = createHash('sha256')
      .update(publicKey.export({ type: 'spki', format: 'der' }))
      .digest('hex');
    if (actualPublicKeySha256 !== expectedPublicKeySha256.toLowerCase())
      throw new Error(
        'worker sandbox evidence: public key fingerprint does not match trust anchor',
      );
  }
  let signature;
  try {
    signature = Buffer.from(parsed.signature, 'base64url');
  } catch {
    throw new Error('worker sandbox evidence: signature encoding is invalid');
  }
  if (!verify(null, Buffer.from(signedAttestationPayload(parsed), 'utf8'), publicKey, signature))
    throw new Error('worker sandbox evidence: signature verification failed');
  console.log('worker sandbox evidence: structured attestation valid');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
