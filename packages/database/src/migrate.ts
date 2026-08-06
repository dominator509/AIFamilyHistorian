import { fileURLToPath } from 'node:url';

import { createPool } from './client.js';
import { migrate } from './migrations.js';

if (!process.env.DATABASE_URL)
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
const pool = createPool();
try {
  await migrate(pool);
  console.log('database migrate: ok');
} finally {
  await pool.end();
}
