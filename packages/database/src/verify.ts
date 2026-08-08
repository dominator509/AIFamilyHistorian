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
  const relations = await pool.query<{
    relname: string;
    relkind: string;
    reloptions: string[] | null;
  }>(
    'select relname, relkind, reloptions from pg_class where relnamespace = current_schema()::regnamespace and relname = any($1::text[])',
    [canonicalRelations],
  );
  if (relations.rowCount !== canonicalRelations.length) {
    const found = new Set(relations.rows.map((row) => row.relname));
    const missing = canonicalRelations.filter((name) => !found.has(name));
    throw new Error(`canonical relations missing: ${missing.join(', ')}`);
  }
  const tableRelations = relations.rows
    .filter((row) => row.relkind === 'r' || row.relkind === 'p')
    .map((row) => row.relname);
  const unsafeViews = relations.rows
    .filter((row) => row.relkind === 'v')
    .filter((row) => !row.reloptions?.includes('security_invoker=true'))
    .map((row) => row.relname);
  if (unsafeViews.length > 0)
    throw new Error(`canonical views must use security invoker: ${unsafeViews.join(', ')}`);
  const rls = await pool.query<{
    relname: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    policy_count: string;
  }>(
    `select c.relname,
            c.relrowsecurity,
            c.relforcerowsecurity,
            count(p.oid)::text as policy_count
       from pg_class c
       left join pg_policy p on p.polrelid = c.oid
      where c.relnamespace = current_schema()::regnamespace
        and c.relname = any($1::text[])
      group by c.relname, c.relrowsecurity, c.relforcerowsecurity`,
    [tableRelations],
  );
  if (
    rls.rowCount !== tableRelations.length ||
    rls.rows.some(
      (row) => !row.relrowsecurity || !row.relforcerowsecurity || Number(row.policy_count) < 1,
    )
  ) {
    const found = new Set(rls.rows.map((row) => row.relname));
    const missing = tableRelations.filter((name) => !found.has(name));
    const weak = rls.rows
      .filter(
        (row) => !row.relrowsecurity || !row.relforcerowsecurity || Number(row.policy_count) < 1,
      )
      .map((row) => row.relname);
    throw new Error(`required RLS enforcement missing: ${[...missing, ...weak].join(', ')}`);
  }
  const triggers = await pool.query<{ tgname: string }>(
    "select tgname from pg_trigger where not tgisinternal and tgname in ('audit_events_append_only','provenance_events_append_only','original_objects_immutable','provider_callback_events_append_only')",
  );
  if (triggers.rowCount !== 4) throw new Error('immutability triggers missing');
  const migrationPrivilege = await pool.query<{ has_privilege: boolean }>(
    "select has_table_privilege('family_historian_runtime', 'schema_migrations', 'INSERT,UPDATE,DELETE') as has_privilege",
  );
  if (migrationPrivilege.rows[0]?.has_privilege)
    throw new Error('runtime role can mutate migration history');
  console.log('database verify: ok');
} finally {
  await pool.end();
}
