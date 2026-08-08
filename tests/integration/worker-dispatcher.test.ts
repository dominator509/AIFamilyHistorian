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
      archiveIds: [context.familyArchiveId],
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
      archiveIds: [context.familyArchiveId],
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

  it('dead-letters an unsupported job without claiming success', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Unsupported family', 'Unsupported archive');
    const jobId = uuidV7();
    const jobType = `unsupported.${jobId}`;
    await pool.query(
      'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
      [jobId, context.organizationId, context.familyArchiveId, jobType, { aggregateId: uuidV7() }],
    );
    const dispatcher = new OutboxDispatcher({
      pool,
      logger,
      handlers: new Map(),
      jobTypes: [jobType],
      archiveIds: [context.familyArchiveId],
      pollMilliseconds: 50,
    });

    expect(await dispatcher.processOne()).toBe(true);
    const result = await pool.query<{
      status: string;
      attempt_count: number;
      last_error_code: string;
    }>('select status, attempt_count, last_error_code from job_outbox where id = $1', [jobId]);
    expect(result.rows[0]).toEqual({
      status: 'terminal_failed',
      attempt_count: 1,
      last_error_code: 'JOB_UNSUPPORTED',
    });
  });

  it('fences a stale worker after another worker reclaims its lease', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Fenced family', 'Fenced archive');
    const jobId = uuidV7();
    const jobType = `fenced.${jobId}`;
    await pool.query(
      'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
      [jobId, context.organizationId, context.familyArchiveId, jobType, { aggregateId: uuidV7() }],
    );
    let entered!: () => void;
    let release!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const dispatcher = new OutboxDispatcher({
      pool,
      logger,
      handlers: new Map([
        [
          jobType,
          async () => {
            entered();
            await releasePromise;
          },
        ],
      ]),
      jobTypes: [jobType],
      archiveIds: [context.familyArchiveId],
      pollMilliseconds: 50,
    });

    const processing = dispatcher.processOne();
    await enteredPromise;
    await pool.query('update job_outbox set locked_at = now(), lock_token = $2 where id = $1', [
      jobId,
      uuidV7(),
    ]);
    release();
    await expect(processing).resolves.toBe(true);
    const result = await pool.query<{ status: string; attempt_count: number }>(
      'select status, attempt_count from job_outbox where id = $1',
      [jobId],
    );
    expect(result.rows[0]).toEqual({ status: 'running', attempt_count: 1 });
  });

  it('reclaims an expired running lease after a worker exits unexpectedly', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Reclaimed family', 'Reclaimed archive');
    const jobId = uuidV7();
    const jobType = `reclaim.${jobId}`;
    const firstLockToken = uuidV7();
    await pool.query(
      `insert into job_outbox(
         id, organization_id, family_archive_id, job_type, payload, status,
         attempt_count, locked_at, lock_token
       ) values ($1,$2,$3,$4,$5,'running',1,now() - interval '2 seconds',$6)`,
      [jobId, context.organizationId, context.familyArchiveId, jobType, {}, firstLockToken],
    );
    const observedTokens: string[] = [];
    const dispatcher = new OutboxDispatcher({
      pool,
      handlers: new Map([
        [
          jobType,
          ({ job }) => {
            observedTokens.push(job.lockToken);
          },
        ],
      ]),
      logger,
      leaseMilliseconds: 1_000,
      jobTypes: [jobType],
      archiveIds: [context.familyArchiveId],
      pollMilliseconds: 50,
    });

    expect(await dispatcher.processOne()).toBe(true);
    expect(observedTokens).toHaveLength(1);
    expect(observedTokens[0]).not.toBe(firstLockToken);
    const result = await pool.query<{
      status: string;
      attempt_count: number;
      lock_token: string | null;
    }>('select status, attempt_count, lock_token from job_outbox where id = $1', [jobId]);
    expect(result.rows[0]).toEqual({ status: 'completed', attempt_count: 2, lock_token: null });
  });

  it('claims only jobs from an archive partition', async () => {
    const first: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    const second: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, first, 'Partition first', 'Partition first archive');
    await bootstrapArchive(pool, second, 'Partition second', 'Partition second archive');
    const jobType = `partition.${uuidV7()}`;
    const firstJob = uuidV7();
    const secondJob = uuidV7();
    for (const [jobId, context] of [
      [firstJob, first],
      [secondJob, second],
    ] as const)
      await pool.query(
        'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
        [
          jobId,
          context.organizationId,
          context.familyArchiveId,
          jobType,
          { aggregateId: uuidV7() },
        ],
      );
    const dispatcher = new OutboxDispatcher({
      pool,
      logger,
      handlers: new Map([[jobType, () => Promise.resolve()]]),
      jobTypes: [jobType],
      archiveIds: [first.familyArchiveId],
      pollMilliseconds: 50,
    });
    expect(await dispatcher.processOne()).toBe(true);
    const states = await pool.query<{ id: string; status: string }>(
      'select id, status from job_outbox where id = any($1::uuid[]) order by id',
      [[firstJob, secondJob]],
    );
    expect(states.rows).toContainEqual({ id: firstJob, status: 'completed' });
    expect(states.rows).toContainEqual({ id: secondJob, status: 'queued' });
  });
});
