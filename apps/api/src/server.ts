import { parseRuntimeEnvironment } from '@family-historian/config';
import { createPool } from '@family-historian/database';
import { ObjectStorage, parseStorageConfig } from '@family-historian/storage';
import { ArchiveService } from './archive-service.js';
import { createApp } from './app.js';

const environment = parseRuntimeEnvironment(process.env);
const pool = createPool(environment.DATABASE_URL);
const storage = new ObjectStorage(parseStorageConfig(process.env));
const app = await createApp({
  service: new ArchiveService(pool, environment.FIELD_ENCRYPTION_MASTER_KEY, storage),
  sessionSecret: environment.SESSION_SECRET,
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutdown requested');
  await app.close();
  storage.destroy();
  await pool.end();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
await app.listen({ host: environment.HOST, port: environment.PORT });
