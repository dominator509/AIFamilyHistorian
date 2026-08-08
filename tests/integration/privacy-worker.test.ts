import { beforeAll, describe, expect, it } from 'vitest';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
} from '../../packages/database/src/index.js';
import type { DatabaseContext } from '../../packages/database/src/index.js';
import type { ObjectStorage } from '../../packages/storage/src/service.js';
import { OutboxDispatcher, type WorkerLogger } from '../../apps/worker/src/dispatcher.js';
import { createDefaultHandlers } from '../../apps/worker/src/handlers.js';

if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
const pool = createPool();
const logger: WorkerLogger = { info: () => undefined, error: () => undefined };

beforeAll(async () => {
  await migrate(pool);
});

describe('privacy request worker intake', () => {
  it('records review evidence and creates a deletion hold without claiming fulfillment', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Privacy family', 'Privacy archive');
    const requestId = uuidV7();
    const jobId = uuidV7();
    const requesterReference = 'subject@example.invalid';
    await pool.query(
      `insert into privacy_requests(
         id, organization_id, family_archive_id, request_type, status, requester_reference, due_at
       ) values ($1, $2, $3, 'deletion', 'queued', $4, now() + interval '30 days')`,
      [requestId, context.organizationId, context.familyArchiveId, requesterReference],
    );
    await pool.query(
      'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
      [
        jobId,
        context.organizationId,
        context.familyArchiveId,
        'privacy.request',
        {
          aggregateId: requestId,
          payload: {
            archiveId: context.familyArchiveId,
            requestType: 'deletion',
            requesterReference,
          },
        },
      ],
    );

    const dispatcher = new OutboxDispatcher({
      pool,
      logger,
      handlers: createDefaultHandlers({ storage: {} as ObjectStorage }),
      jobTypes: ['privacy.request'],
      pollMilliseconds: 50,
    });
    let targetProcessed = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await dispatcher.processOne();
      const state = await pool.query<{ status: string }>(
        'select status from job_outbox where id = $1',
        [jobId],
      );
      if (state.rows[0]?.status !== 'queued') {
        targetProcessed = true;
        break;
      }
    }
    expect(targetProcessed).toBe(true);

    const request = await pool.query<{ status: string }>(
      'select status from privacy_requests where id = $1',
      [requestId],
    );
    expect(request.rows[0]).toEqual({ status: 'running' });
    const deletion = await pool.query<{ status: string; evidence: unknown[] }>(
      'select status, evidence from deletion_jobs where organization_id = $1 and idempotency_key = $2',
      [context.organizationId, `privacy-request:${requestId}`],
    );
    expect(deletion.rows[0]?.status).toBe('queued');
    expect(deletion.rows[0]?.evidence).toEqual([
      { source: 'privacy_request', privacyRequestId: requestId, state: 'review_required' },
    ]);
    const audit = await pool.query<{ action: string; outcome: string }>(
      'select action, outcome from audit_events where organization_id = $1 and family_archive_id = $2 and action = $3',
      [context.organizationId, context.familyArchiveId, 'privacy_request.accepted'],
    );
    expect(audit.rows[0]).toEqual({
      action: 'privacy_request.accepted',
      outcome: 'review_required',
    });
    const outbox = await pool.query<{ status: string }>(
      'select status from job_outbox where id = $1',
      [jobId],
    );
    expect(outbox.rows[0]).toEqual({ status: 'completed' });
  });
});
