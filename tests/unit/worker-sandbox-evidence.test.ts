import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const now = Date.parse('2026-08-09T18:00:00.000Z');
const valid = {
  schema_version: 'worker-sandbox-attestation/v1',
  issuer: 'operations.example',
  subject: 'family-historian-worker-staging',
  evidence_id: 'attestation-2026-08-09',
  signature: 'signed-evidence-placeholder-for-test',
  signature_algorithm: 'ed25519',
  issued_at: '2026-08-09T17:00:00.000Z',
  expires_at: '2026-08-10T17:00:00.000Z',
  controls: {
    syscall_profile: true,
    network_egress_deny: true,
    read_only_root: true,
    no_new_privileges: true,
    capability_drop: true,
    pid_limit: true,
    cpu_memory_limits: true,
    scratch_mount: true,
  },
};

function runProbe(value: unknown): string {
  const directory = mkdtempSync(join(tmpdir(), 'worker-sandbox-evidence-'));
  const filePath = join(directory, 'attestation.json');
  writeFileSync(filePath, JSON.stringify(value));
  try {
    return execFileSync('node', ['scripts/probes/worker-sandbox-evidence.mjs', filePath], {
      env: { ...process.env, WORKER_SANDBOX_EVIDENCE_NOW: String(now) },
      encoding: 'utf8',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('worker sandbox attestation', () => {
  it('accepts a current structured attestation with every required control', () => {
    expect(runProbe(valid)).toContain('structured attestation valid');
  });

  it('rejects arbitrary non-empty text and missing controls', () => {
    expect(() => runProbe('present')).toThrow();
    expect(() =>
      runProbe({ ...valid, controls: { ...valid.controls, scratch_mount: false } }),
    ).toThrow();
  });

  it('rejects expired, future-dated, and overlong attestations', () => {
    expect(() => runProbe({ ...valid, expires_at: '2026-08-08T18:00:00.000Z' })).toThrow();
    expect(() => runProbe({ ...valid, issued_at: '2026-08-09T19:00:00.000Z' })).toThrow();
    expect(() => runProbe({ ...valid, expires_at: '2027-08-11T17:00:00.000Z' })).toThrow();
  });
});
