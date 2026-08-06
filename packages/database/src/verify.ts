import { fileURLToPath } from 'node:url';

import { canonicalRelations } from './canonical-schema.js';
import { createPool } from './client.js';

if (!process.env.DATABASE_URL)
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
const pool = createPool();
try {
  const extension = await pool.query<{ extname: string }>(
    "select extname from pg_extension where extname = 'vector'",
  );
  if (extension.rowCount !== 1) throw new Error('pgvector extension missing');
  const relations = await pool.query<{ relname: string }>(
    'select relname from pg_class where relnamespace = current_schema()::regnamespace and relname = any($1::text[])',
    [canonicalRelations],
  );
  if (relations.rowCount !== canonicalRelations.length) {
    const found = new Set(relations.rows.map((row) => row.relname));
    const missing = canonicalRelations.filter((name) => !found.has(name));
    throw new Error(`canonical relations missing: ${missing.join(', ')}`);
  }
  const rls = await pool.query<{
    relname: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(
    "select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('organizations','family_archives','confirmed_facts','original_objects','audit_events','provenance_events')",
  );
  if (rls.rowCount !== 6 || rls.rows.some((row) => !row.relrowsecurity || !row.relforcerowsecurity))
    throw new Error('required RLS enforcement missing');
  const triggers = await pool.query<{ tgname: string }>(
    "select tgname from pg_trigger where not tgisinternal and tgname in ('audit_events_append_only','provenance_events_append_only','original_objects_immutable')",
  );
  if (triggers.rowCount !== 3) throw new Error('immutability triggers missing');
  const migrationPrivilege = await pool.query<{ has_privilege: boolean }>(
    "select has_table_privilege('family_historian_runtime', 'schema_migrations', 'INSERT,UPDATE,DELETE') as has_privilege",
  );
  if (migrationPrivilege.rows[0]?.has_privilege)
    throw new Error('runtime role can mutate migration history');
  console.log('database verify: ok');
} finally {
  await pool.end();
}
