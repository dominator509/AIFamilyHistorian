import type { Pool } from 'pg';

export const WORKER_DATABASE_ROLE = 'family_historian_worker';

/** Validate and apply the runtime-supplied password for the non-owner worker login. */
export async function provisionWorkerDatabaseRole(
  pool: Pool,
  workerDatabaseUrl: string,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(workerDatabaseUrl);
  } catch {
    throw new Error('WORKER_DATABASE_URL is invalid');
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    parsed.username !== WORKER_DATABASE_ROLE ||
    !parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error('WORKER_DATABASE_URL must use the family_historian_worker role');
  let password: string;
  try {
    password = decodeURIComponent(parsed.password);
  } catch {
    throw new Error('WORKER_DATABASE_URL password is invalid');
  }
  if (
    password.length < 32 ||
    password.length > 512 ||
    [...password].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    })
  )
    throw new Error('WORKER_DATABASE_URL password is invalid');
  const quoted = await pool.query<{ value: string }>('select quote_literal($1) as value', [
    password,
  ]);
  const literal = quoted.rows[0]?.value;
  if (!literal) throw new Error('worker database password could not be encoded');
  await pool.query(
    `alter role ${WORKER_DATABASE_ROLE}
       login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
       password ${literal}`,
  );
}
