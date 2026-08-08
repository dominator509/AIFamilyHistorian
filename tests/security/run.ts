import { readFile } from 'node:fs/promises';

const source = await readFile('apps/api/src/app.ts', 'utf8');
const requiredControls = ['redact', 'bodyLimit', 'helmet', 'corsOrigins', 'credentials: false'];
for (const control of requiredControls) {
  if (!source.includes(control)) throw new Error(`security control missing: ${control}`);
}
console.log('security baseline: ok');
