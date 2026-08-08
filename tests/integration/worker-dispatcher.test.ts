import { beforeAll, describe, expect, it } from 'vitest';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
  type DatabaseContext,
} from '../../packages/database/src/index.js';
import {
  OutboxDispatcher,
  WorkerJobError,
  type WorkerLogger,
} from '../../apps/worker/src/dispatcher.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const pool = createPool();
const logger: WorkerLogger = {
  info: () => undefined,
  error: () => undefined,
};

beforeAll(async () => {
  await migrate(pool);
});

describe('SQL outbox worker dispatcher', () => {
  it('claims a scoped job and records completion without losing tenant context', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Worker family', 'Worker archive');
    const jobId = uuidV7();
    const jobType = `test.complete.${jobId}`;
    await pool.query(
      'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
      [
        jobId,
        context.organizationId,
        context.familyArchiveId,
        jobType,
        { aggregateId: uuidV7(), payload: {} },
      ],
    );
    const dispatcher = new OutboxDispatcher({
      pool,
      logger,
      handlers: new Map([
        [
          jobType,
          async (jobContext) =>
            jobContext.withTenant(async (client) => {
              const result = await client.query<{ current_organization_id: string }>(
                "select current_setting('app.current_organization_id') as current_organization_id",
              );
              expect(result.rows[0]?.current_organization_id).toBe(context.organizationId);
            }),
        ],
      ]),
      jobTypes: [jobType],
      pollMilliseconds: 50,
    });

    expect(await dispatcher.processOne()).toBe(true);
    const result = await pool.query<{ status: string; attempt_count: number }>(
      'select status, attempt_count from job_outbox where id = $1',
      [jobId],
    );
    expect(result.rows[0]).toEqual({ status: 'completed', attempt_count: 1 });
  });

  it('backs off retryable failures and dead-letters after the configured attempts', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Retry family', 'Retry archive');
    const jobId = uuidV7();
    const jobType = `test.retry.${jobId}`;
    await pool.query(
      'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
      [
        jobId,
        context.organizationId,
        context.familyArchiveId,
        jobType,
        { aggregateId: uuidV7(), payload: {} },
      ],
    );
    const dispatcher = new OutboxDispatcher({
      pool,
      logger,
      maxAttempts: 2,
      handlers: new Map([
        [
          jobType,
          () => {
            throw new WorkerJobError('temporary dependency failure', 'DEPENDENCY_TEMPORARY', true);
          },
        ],
      ]),
      jobTypes: [jobType],
      pollMilliseconds: 50,
    });

    expect(await dispatcher.processOne()).toBe(true);
    let result = await pool.query<{
      status: string;
      attempt_count: number;
      last_error_code: string;
    }>('select status, attempt_count, last_error_code from job_outbox where id = $1', [jobId]);
    expect(result.rows[0]).toMatchObject({
      status: 'retryable_failed',
      attempt_count: 1,
      last_error_code: 'DEPENDENCY_TEMPORARY',
    });
    await pool.query('update job_outbox set available_at = now() where id = $1', [jobId]);
    expect(await dispatcher.processOne()).toBe(true);
    result = await pool.query(
      'select status, attempt_count, last_error_code from job_outbox where id = $1',
      [jobId],
    );
    expect(result.rows[0]).toMatchObject({
      status: 'terminal_failed',
      attempt_count: 2,
      last_error_code: 'DEPENDENCY_TEMPORARY',
    });
  });
});
