import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import * as schema from './schema.js';

export type DatabasePool = Pool;
export type DatabaseClient = PoolClient;

export interface DatabaseContext {
  readonly organizationId: string;
  readonly familyArchiveId: string;
}

export function createPool(databaseUrl = process.env.DATABASE_URL): Pool {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function createDatabase(pool: Pool): NodePgDatabase<typeof schema> {
  return drizzle(pool, { schema });
}

export async function withTenantTransaction<T>(
  pool: Pool,
  context: DatabaseContext,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('app.current_organization_id', $1, true)", [
      context.organizationId,
    ]);
    await client.query("select set_config('app.current_archive_id', $1, true)", [
      context.familyArchiveId,
    ]);
    await client.query('set local role family_historian_runtime');
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
