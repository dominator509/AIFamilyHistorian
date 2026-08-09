import { readFile } from 'node:fs/promises';
import { contentTypeMatchesSignature } from '../../packages/media/src/index.js';
import { issueSessionToken, verifySessionToken } from '../../packages/auth/src/index.js';

const [source, compose, dockerfile, flyWorker, workerSource, verifyWorkflow, releaseWorkflow] =
  await Promise.all([
    readFile('apps/api/src/app.ts', 'utf8'),
    readFile('compose.yaml', 'utf8'),
    readFile('Dockerfile', 'utf8'),
    readFile('fly.worker.toml', 'utf8'),
    readFile('apps/worker/src/index.ts', 'utf8'),
    readFile('.github/workflows/verify.yml', 'utf8'),
    readFile('.github/workflows/release.yml', 'utf8'),
  ]);
const requiredControls = ['redact', 'bodyLimit', 'helmet', 'corsOrigins', 'credentials: false'];
for (const control of requiredControls) {
  if (!source.includes(control)) throw new Error(`security control missing: ${control}`);
}
const sandboxControls = [
  "profiles: ['worker']",
  'read_only: true',
  "cap_drop: ['ALL']",
  'no-new-privileges:true',
  'pids_limit: 256',
  'mem_limit: 2g',
  'cpus: 2.0',
  '/tmp:rw,noexec,nosuid,size=1g',
];
for (const control of sandboxControls) {
  if (!compose.includes(control)) throw new Error(`worker sandbox control missing: ${control}`);
}
for (const match of compose.matchAll(/^\s*image:\s*([^\s]+)$/gim)) {
  const image = match[1] ?? '';
  if (!/@sha256:[0-9a-f]{64}/u.test(image))
    throw new Error(`Compose image is not pinned to an immutable digest: ${image}`);
}
if (
  !dockerfile.includes('FROM runtime-base AS worker-runtime') ||
  !dockerfile.includes('USER node')
)
  throw new Error('worker image must use the dedicated non-root runtime');
if (flyWorker.includes('[http_service]') || flyWorker.includes('[[services]]'))
  throw new Error('hosted worker must not declare public ingress');
if (!workerSource.includes("healthServer.listen(healthPort, '127.0.0.1'"))
  throw new Error('worker health server must bind loopback only');
for (const match of dockerfile.matchAll(/^FROM\s+node:[^\n]+$/gim)) {
  if (!/@sha256:[0-9a-f]{64}/u.test(match[0]))
    throw new Error(`Docker base image is not pinned to an immutable digest: ${match[0]}`);
}

for (const [name, workflow] of [
  ['verify', verifyWorkflow],
  ['release', releaseWorkflow],
] as const) {
  for (const match of workflow.matchAll(/^\s*- uses:\s*([^\s#]+)$/gim)) {
    const reference = match[1] ?? '';
    const at = reference.lastIndexOf('@');
    if (at < 1 || !/^[0-9a-f]{40}$/u.test(reference.slice(at + 1)))
      throw new Error(`${name} workflow action is not pinned to an immutable commit: ${reference}`);
  }
}

const validWav = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!contentTypeMatchesSignature('audio/wav', validWav))
  throw new Error('valid media signature was rejected');
if (contentTypeMatchesSignature('audio/wav', png))
  throw new Error('mismatched media signature was accepted');

const session = issueSessionToken('security-gate-secret-with-sufficient-entropy-000000', {
  userId: '01900000-0000-7000-8000-000000000061',
  organizationId: '01900000-0000-7000-8000-000000000062',
  archiveIds: ['01900000-0000-7000-8000-000000000063'],
  permissions: ['archive:*'],
  expiresAt: Math.floor(Date.now() / 1000) + 60,
});
if (!verifySessionToken('security-gate-secret-with-sufficient-entropy-000000', session).sessionId)
  throw new Error('session token did not carry a revocable identifier');

console.log('security baseline: ok (behavioral controls and worker sandbox declarations)');
