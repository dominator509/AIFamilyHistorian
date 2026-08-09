import { spawn } from 'node:child_process';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('database probe: DATABASE_URL is required');
const parsed = new URL(url);
if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.username === '')
  throw new Error('database probe: DATABASE_URL is invalid');
const database = decodeURIComponent(parsed.pathname.replace(/^\//u, ''));
if (!database) throw new Error('database probe: database name is required');
const child = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '-Atqc', 'select 1'], {
  env: {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: database,
    ...(parsed.searchParams.get('sslmode')
      ? { PGSSLMODE: parsed.searchParams.get('sslmode') }
      : {}),
  },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const exitCode = await new Promise((resolve) => {
  child.once('error', () => resolve(1));
  child.once('exit', (code) => resolve(code ?? 1));
});
if (exitCode !== 0) process.exit(exitCode);
console.log('database probe: ok');
