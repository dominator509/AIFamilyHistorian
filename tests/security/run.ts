import { readFile } from 'node:fs/promises';
import { contentTypeMatchesSignature } from '../../packages/media/src/index.js';
import { issueSessionToken, verifySessionToken } from '../../packages/auth/src/index.js';

const [source, compose, dockerfile] = await Promise.all([
  readFile('apps/api/src/app.ts', 'utf8'),
  readFile('compose.yaml', 'utf8'),
  readFile('Dockerfile', 'utf8'),
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
if (
  !dockerfile.includes('FROM runtime-base AS worker-runtime') ||
  !dockerfile.includes('USER node')
)
  throw new Error('worker image must use the dedicated non-root runtime');

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
