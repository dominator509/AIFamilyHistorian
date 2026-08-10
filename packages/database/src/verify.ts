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
    "select tgname from pg_trigger where not tgisinternal and tgname in ('audit_events_append_only','provenance_events_append_only','original_objects_immutable','provider_callback_events_append_only','job_outbox_scope_immutable','job_outbox_status_transition')",
  );
  if (triggers.rowCount !== 6) throw new Error('immutability triggers missing');
  const migrationPrivilege = await pool.query<{ has_privilege: boolean }>(
    "select has_table_privilege('family_historian_runtime', 'schema_migrations', 'INSERT,UPDATE,DELETE') as has_privilege",
  );
  if (migrationPrivilege.rows[0]?.has_privilege)
    throw new Error('runtime role can mutate migration history');
  const workerRole = await pool.query<{
    rolcanlogin: boolean;
    rolsuper: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
    rolinherit: boolean;
    rolbypassrls: boolean;
  }>(
    `select rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolinherit, rolbypassrls
       from pg_roles
      where rolname = 'family_historian_worker'`,
  );
  const worker = workerRole.rows[0];
  if (
    !worker ||
    !worker.rolcanlogin ||
    worker.rolsuper ||
    worker.rolcreaterole ||
    worker.rolcreatedb ||
    worker.rolinherit ||
    worker.rolbypassrls
  )
    throw new Error('worker database role is not least privileged');
  const workerQueuePrivilege = await pool.query<{
    can_read: boolean;
    can_update: boolean;
  }>(
    `select has_table_privilege('family_historian_worker', 'job_outbox', 'SELECT') as can_read,
            has_table_privilege('family_historian_worker', 'job_outbox', 'UPDATE') as can_update`,
  );
  if (!workerQueuePrivilege.rows[0]?.can_read)
    throw new Error('worker database role lacks scoped queue read access');
  if (workerQueuePrivilege.rows[0]?.can_update)
    throw new Error('worker database role has direct queue privileges');
  const workerProcedurePrivilege = await pool.query<{ has_privilege: boolean }>(
    `select has_function_privilege(
       'family_historian_worker',
       'worker_claim_job(integer,text[],uuid[],uuid)',
       'EXECUTE'
     ) and has_function_privilege(
       'family_historian_worker',
       'worker_set_scope(uuid,uuid)',
       'EXECUTE'
     ) and has_function_privilege(
       'family_historian_worker',
       'worker_complete_job(uuid,uuid)',
       'EXECUTE'
     ) as has_privilege`,
  );
  if (!workerProcedurePrivilege.rows[0]?.has_privilege)
    throw new Error('worker database role lacks scoped queue procedures');
  const workerDataPrivilege = await pool.query<{ has_privilege: boolean }>(
    "select has_table_privilege('family_historian_worker', 'people', 'SELECT') as has_privilege",
  );
  if (workerDataPrivilege.rows[0]?.has_privilege)
    throw new Error('worker database role directly accesses tenant tables');
  const workerRuntimeMembership = await pool.query<{ member: boolean }>(
    `select exists (
       select 1
         from pg_auth_members membership
         join pg_roles member_role on member_role.oid = membership.member
         join pg_roles granted_role on granted_role.oid = membership.roleid
        where member_role.rolname = 'family_historian_worker'
          and granted_role.rolname = 'family_historian_runtime'
     ) as member`,
  );
  if (workerRuntimeMembership.rows[0]?.member)
    throw new Error('worker database role can activate the broad runtime role');
  const workerSessionPrivilege = await pool.query<{ has_privilege: boolean }>(
    "select has_table_privilege('family_historian_worker', 'auth_sessions', 'SELECT,INSERT,UPDATE,DELETE') as has_privilege",
  );
  if (workerSessionPrivilege.rows[0]?.has_privilege)
    throw new Error('worker database role can access server-side sessions');
  console.log('database verify: ok');
} finally {
  await pool.end();
}
