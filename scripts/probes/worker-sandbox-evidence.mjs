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

export function validateWorkerSandboxAttestation(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('worker sandbox evidence: root must be an object');
  if (input.schema_version !== 'worker-sandbox-attestation/v1')
    throw new Error('worker sandbox evidence: unsupported schema_version');
  for (const field of ['issuer', 'subject', 'evidence_id', 'signature', 'signature_algorithm'])
    assertBoundedString(input[field], field);
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
  validateWorkerSandboxAttestation(parsed, now);
  console.log('worker sandbox evidence: structured attestation valid');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
