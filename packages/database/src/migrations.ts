import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

export async function migrate(
  pool: Pool,
  migrationsDirectory = fileURLToPath(new URL('../../../drizzle/', import.meta.url)),
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [902_106_001]);
    await client.query(
      'create table if not exists schema_migrations (name text primary key, sha256 text not null, applied_at timestamptz not null default now())',
    );
    const files = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    for (const name of files) {
      const sql = await readFile(resolve(migrationsDirectory, name), 'utf8');
      const sha256 = createHash('sha256').update(sql, 'utf8').digest('hex');
      const existing = await client.query<{ sha256: string }>(
        'select sha256 from schema_migrations where name = $1',
        [name],
      );
      if (existing.rowCount === 1) {
        if (existing.rows[0]?.sha256 !== sha256)
          throw new Error(`applied migration changed: ${name}`);
        continue;
      }
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations(name, sha256) values ($1, $2)', [
          name,
          sha256,
        ]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [902_106_001]).catch(() => undefined);
    client.release();
  }
}
