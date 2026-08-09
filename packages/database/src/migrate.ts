import { fileURLToPath } from 'node:url';

import { createPool } from './client.js';
import { migrate } from './migrations.js';
import { provisionWorkerDatabaseRole } from './worker-role.js';

if (!process.env.DATABASE_URL)
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
const pool = createPool();
try {
  await migrate(pool);
  if (!process.env.WORKER_DATABASE_URL)
    throw new Error('WORKER_DATABASE_URL is required to provision the worker database role');
  await provisionWorkerDatabaseRole(pool, process.env.WORKER_DATABASE_URL);
  console.log('database migrate: ok');
} finally {
  await pool.end();
}
