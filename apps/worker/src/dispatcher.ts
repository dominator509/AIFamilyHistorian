import { uuidV7, type DatabaseClient, type DatabasePool } from '@family-historian/database';

export interface OutboxJob {
  readonly id: string;
  readonly organizationId: string;
  readonly familyArchiveId: string | null;
  readonly jobType: string;
  readonly payload: unknown;
  readonly attemptCount: number;
  readonly lockToken: string;
}

export interface WorkerLogger {
  info(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

export interface WorkerJobContext {
  readonly job: OutboxJob;
  withTenant<T>(operation: (client: DatabaseClient) => Promise<T>): Promise<T>;
}

export type WorkerJobHandler = (context: WorkerJobContext) => Promise<void>;

export class WorkerJobError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'WorkerJobError';
  }
}

export interface OutboxDispatcherOptions {
  readonly pool: DatabasePool;
  readonly handlers: ReadonlyMap<string, WorkerJobHandler>;
  readonly logger: WorkerLogger;
  readonly maxAttempts?: number;
  readonly leaseMilliseconds?: number;
  readonly pollMilliseconds?: number;
  /** Optional queue partitioning for independently scaled worker pools. */
  readonly jobTypes?: readonly string[];
}

/**
 * Claims database outbox rows with SKIP LOCKED and runs each handler at most
 * once per lease. Handler effects must be idempotent; failed rows retain a
 * bounded retry schedule and become terminal_failed instead of looping forever.
 */
export class OutboxDispatcher {
  readonly #pool: DatabasePool;
  readonly #handlers: ReadonlyMap<string, WorkerJobHandler>;
  readonly #logger: WorkerLogger;
  readonly #maxAttempts: number;
  readonly #leaseMilliseconds: number;
  readonly #pollMilliseconds: number;
  readonly #jobTypes: readonly string[];

  public constructor(options: OutboxDispatcherOptions) {
    if (
      !Number.isInteger(options.maxAttempts ?? 5) ||
      (options.maxAttempts ?? 5) < 1 ||
      (options.maxAttempts ?? 5) > 20
    )
      throw new Error('worker max attempts are invalid');
    if (
      !Number.isInteger(options.leaseMilliseconds ?? 300_000) ||
      (options.leaseMilliseconds ?? 300_000) < 1_000 ||
      (options.leaseMilliseconds ?? 300_000) > 3_600_000
    )
      throw new Error('worker lease duration is invalid');
    if (
      !Number.isInteger(options.pollMilliseconds ?? 1_000) ||
      (options.pollMilliseconds ?? 1_000) < 50 ||
      (options.pollMilliseconds ?? 1_000) > 60_000
    )
      throw new Error('worker poll duration is invalid');
    if (options.jobTypes?.some((jobType) => !jobType.trim()))
      throw new Error('worker job type partition is invalid');
    this.#pool = options.pool;
    this.#handlers = options.handlers;
    this.#logger = options.logger;
    this.#maxAttempts = options.maxAttempts ?? 5;
    this.#leaseMilliseconds = options.leaseMilliseconds ?? 300_000;
    this.#pollMilliseconds = options.pollMilliseconds ?? 1_000;
    this.#jobTypes = Object.freeze([...(options.jobTypes ?? [])]);
  }

  public async processOne(): Promise<boolean> {
    const job = await this.claim();
    if (!job) return false;
    const handler = this.#handlers.get(job.jobType);
    try {
      if (!handler)
        throw new WorkerJobError('job handler is not configured', 'JOB_UNSUPPORTED', false);
      await handler({ job, withTenant: (operation) => this.withTenant(job, operation) });
      await this.complete(job);
      this.#logger.info({ jobId: job.id, jobType: job.jobType }, 'worker job completed');
    } catch (error) {
      const failure = this.failure(error);
      try {
        await this.fail(job, failure);
      } catch (failureUpdateError) {
        if (isLeaseLost(error) || isLeaseLost(failureUpdateError)) {
          this.#logger.error(
            { jobId: job.id, jobType: job.jobType, errorCode: 'WORKER_LEASE_LOST' },
            'worker lease was reclaimed before failure state could be recorded',
          );
          return true;
        }
        throw failureUpdateError;
      }
      this.#logger.error(
        {
          jobId: job.id,
          jobType: job.jobType,
          errorCode: failure.code,
          retryable: failure.retryable,
        },
        'worker job failed',
      );
    }
    return true;
  }

  public async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const processed = await this.processOne();
      if (!processed) await sleep(this.#pollMilliseconds);
    }
  }

  private async claim(): Promise<OutboxJob | null> {
    const client = await this.#pool.connect();
    try {
      await client.query('begin');
      const typeFilter = this.#jobTypes.length > 0 ? 'and job_type = any($2::text[])' : '';
      const queryValues =
        this.#jobTypes.length > 0
          ? [this.#leaseMilliseconds, this.#jobTypes]
          : [this.#leaseMilliseconds];
      const result = await client.query<{
        id: string;
        organization_id: string;
        family_archive_id: string | null;
        job_type: string;
        payload: unknown;
        attempt_count: number;
      }>(
        `select id, organization_id, family_archive_id, job_type, payload, attempt_count
           from job_outbox
          where status in ('queued', 'retryable_failed')
            and available_at <= now()
            and (locked_at is null or locked_at < now() - ($1 * interval '1 millisecond'))
          ${typeFilter}
          order by created_at, id
          for update skip locked
          limit 1`,
        queryValues,
      );
      const row = result.rows[0];
      if (!row) {
        await client.query('commit');
        return null;
      }
      const lockToken = uuidV7();
      const updated = await client.query(
        `update job_outbox
            set status = 'running', locked_at = now(), lock_token = $2, attempt_count = attempt_count + 1,
                last_error_code = null
          where id = $1
          returning id`,
        [row.id, lockToken],
      );
      if (updated.rowCount !== 1) throw new Error('worker job claim was lost');
      await client.query('commit');
      const claimedJob = Object.freeze({
        id: row.id,
        organizationId: row.organization_id,
        familyArchiveId: row.family_archive_id,
        jobType: row.job_type,
        payload: row.payload,
        attemptCount: row.attempt_count + 1,
        lockToken,
      });
      this.#logger.info(
        { jobId: claimedJob.id, jobType: claimedJob.jobType },
        'worker job claimed',
      );
      return claimedJob;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async withTenant<T>(
    job: OutboxJob,
    operation: (client: DatabaseClient) => Promise<T>,
  ): Promise<T> {
    if (!job.organizationId)
      throw new WorkerJobError('job organization scope is missing', 'JOB_SCOPE_INVALID', false);
    const client = await this.#pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('app.current_organization_id', $1, true)", [
        job.organizationId,
      ]);
      await client.query("select set_config('app.current_archive_id', $1, true)", [
        job.familyArchiveId ?? '',
      ]);
      await client.query('set local role family_historian_runtime');
      const result = await operation(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async complete(job: OutboxJob): Promise<void> {
    const result = await this.#pool.query(
      `update job_outbox
          set status = 'completed', completed_at = now(), locked_at = null, lock_token = null, last_error_code = null
        where id = $1 and status = 'running' and lock_token = $2`,
      [job.id, job.lockToken],
    );
    if (result.rowCount !== 1) throw new Error('worker completion update was lost');
  }

  private async fail(job: OutboxJob, failure: { code: string; retryable: boolean }): Promise<void> {
    const terminal = !failure.retryable || job.attemptCount >= this.#maxAttempts;
    const status = terminal ? 'terminal_failed' : 'retryable_failed';
    const delaySeconds = Math.min(300, 2 ** Math.max(0, job.attemptCount - 1));
    const result = await this.#pool.query(
      `update job_outbox
          set status = $2::job_status,
              available_at = now() + ($3 * interval '1 second'),
              locked_at = null,
              lock_token = null,
              last_error_code = $4
        where id = $1 and status = 'running' and lock_token = $5`,
      [job.id, status, delaySeconds, failure.code.slice(0, 120), job.lockToken],
    );
    if (result.rowCount !== 1) throw new Error('worker failure update was lost');
  }

  private failure(error: unknown): { code: string; retryable: boolean } {
    if (error instanceof WorkerJobError) return { code: error.code, retryable: error.retryable };
    if (error instanceof Error) return { code: 'WORKER_JOB_FAILED', retryable: true };
    return { code: 'WORKER_JOB_FAILED', retryable: true };
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isLeaseLost(error: unknown): boolean {
  return (
    error instanceof Error && /worker (?:completion|failure) update was lost/u.test(error.message)
  );
}
