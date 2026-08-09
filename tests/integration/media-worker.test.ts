import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bootstrapArchive,
  createPool,
  migrate,
  uuidV7,
  type DatabaseContext,
} from '../../packages/database/src/index.js';
import {
  ObjectStorage,
  originalObjectKey,
  parseStorageConfig,
} from '../../packages/storage/src/index.js';
import { OutboxDispatcher, type WorkerLogger } from '../../apps/worker/src/dispatcher.js';
import { createDefaultHandlers } from '../../apps/worker/src/handlers.js';

if (!process.env.DATABASE_URL || !process.env.R2_ENDPOINT) process.loadEnvFile('.env');
const pool = createPool();
const storage = new ObjectStorage(parseStorageConfig(process.env));
const logger: WorkerLogger = { info: () => undefined, error: () => undefined };

function wavFixture(): Uint8Array {
  const sampleRate = 16_000;
  const sampleCount = sampleRate;
  const dataSize = sampleCount * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1)
      bytes[offset + index] = value.charCodeAt(index);
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < sampleCount; index += 1) {
    const amplitude = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 8_000);
    view.setInt16(44 + index * 2, amplitude, true);
  }
  return bytes;
}

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  storage.destroy();
  await pool.end();
});

describe('real media worker fixture', () => {
  it('scans an audio original and persists fixity plus a waveform derivative', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Media fixture family', 'Media fixture archive');
    const mediaAssetId = uuidV7();
    const originalObjectId = uuidV7();
    const outboxId = uuidV7();
    const objectKey = originalObjectKey(context.organizationId, context.familyArchiveId);
    const bytes = wavFixture();
    const digest = createHash('sha256').update(bytes).digest('hex');
    await storage.putOriginal(
      objectKey,
      bytes,
      'audio/wav',
      Buffer.from(digest, 'hex').toString('base64'),
    );
    await pool.query(
      "insert into media_assets(id, organization_id, family_archive_id, media_type, rights_status) values ($1,$2,$3,'audio','verified')",
      [mediaAssetId, context.organizationId, context.familyArchiveId],
    );
    await pool.query(
      "insert into original_objects(id, organization_id, family_archive_id, media_asset_id, object_key, content_type, byte_size, sha256, quarantine_status) values ($1,$2,$3,$4,$5,'audio/wav',$6,$7,'pending')",
      [
        originalObjectId,
        context.organizationId,
        context.familyArchiveId,
        mediaAssetId,
        objectKey,
        bytes.byteLength,
        digest,
      ],
    );
    await pool.query(
      'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
      [
        outboxId,
        context.organizationId,
        context.familyArchiveId,
        'media.scan',
        { aggregateId: originalObjectId, payload: { objectKey } },
      ],
    );

    const dispatcher = new OutboxDispatcher({
      pool,
      logger,
      handlers: createDefaultHandlers({ storage }),
      jobTypes: ['media.scan'],
      archiveIds: [context.familyArchiveId],
      pollMilliseconds: 50,
    });
    expect(await dispatcher.processOne()).toBe(true);

    const state = await pool.query<{ quarantine_status: string }>(
      'select quarantine_status from original_objects where id = $1',
      [originalObjectId],
    );
    expect(state.rows[0]).toEqual({ quarantine_status: 'clean' });
    const derivatives = await pool.query<{ recipe_version: string; byte_size: number }>(
      `select d.recipe_version, f.byte_size
         from derivative_objects d
         join fixity_records f on f.object_id = d.id and f.object_kind = 'derivative'
        where d.original_object_id = $1`,
      [originalObjectId],
    );
    expect(derivatives.rows).toHaveLength(1);
    expect(derivatives.rows[0]?.recipe_version).toBe('waveform-derivative');
    expect(Number(derivatives.rows[0]?.byte_size)).toBeGreaterThan(44);
    const fixity = await pool.query<{ digest: string; byte_size: number }>(
      `select digest, byte_size::int as byte_size
         from fixity_records
        where object_kind = 'original' and object_id = $1`,
      [originalObjectId],
    );
    expect(fixity.rows[0]).toEqual({ digest, byte_size: bytes.byteLength });
    const outbox = await pool.query<{ status: string }>(
      'select status from job_outbox where id = $1',
      [outboxId],
    );
    expect(outbox.rows[0]).toEqual({ status: 'completed' });
  }, 120_000);

  it('scopes quarantine errors to the authoritative organization and archive', async () => {
    const context: DatabaseContext = { organizationId: uuidV7(), familyArchiveId: uuidV7() };
    await bootstrapArchive(pool, context, 'Media error family', 'Media error archive');
    const mediaAssetId = uuidV7();
    const originalObjectId = uuidV7();
    const outboxId = uuidV7();
    const objectKey = originalObjectKey(context.organizationId, context.familyArchiveId);
    const bytes = wavFixture();
    await storage.putOriginal(
      objectKey,
      bytes,
      'audio/wav',
      Buffer.from(createHash('sha256').update(bytes).digest('hex'), 'hex').toString('base64'),
    );
    await pool.query(
      "insert into media_assets(id, organization_id, family_archive_id, media_type, rights_status) values ($1,$2,$3,'audio','verified')",
      [mediaAssetId, context.organizationId, context.familyArchiveId],
    );
    await pool.query(
      "insert into original_objects(id, organization_id, family_archive_id, media_asset_id, object_key, content_type, byte_size, sha256, quarantine_status) values ($1,$2,$3,$4,$5,'audio/wav',$6,$7,'pending')",
      [
        originalObjectId,
        context.organizationId,
        context.familyArchiveId,
        mediaAssetId,
        objectKey,
        bytes.byteLength,
        '00'.repeat(32),
      ],
    );
    await pool.query(
      'insert into job_outbox(id, organization_id, family_archive_id, job_type, payload) values ($1,$2,$3,$4,$5)',
      [
        outboxId,
        context.organizationId,
        context.familyArchiveId,
        'media.scan',
        { aggregateId: originalObjectId, payload: { objectKey } },
      ],
    );

    const dispatcher = new OutboxDispatcher({
      pool,
      logger,
      handlers: createDefaultHandlers({ storage }),
      jobTypes: ['media.scan'],
      archiveIds: [context.familyArchiveId],
      pollMilliseconds: 50,
    });
    expect(await dispatcher.processOne()).toBe(true);

    const state = await pool.query<{ quarantine_status: string }>(
      'select quarantine_status from original_objects where id = $1',
      [originalObjectId],
    );
    expect(state.rows[0]).toEqual({ quarantine_status: 'error' });
    const outbox = await pool.query<{ status: string; last_error_code: string }>(
      'select status, last_error_code from job_outbox where id = $1',
      [outboxId],
    );
    expect(outbox.rows[0]).toEqual({
      status: 'terminal_failed',
      last_error_code: 'CHECKSUM_MISMATCH',
    });
  }, 120_000);
});
