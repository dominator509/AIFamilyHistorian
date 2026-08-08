import { Redis } from 'ioredis';
import pino from 'pino';
import { parseRuntimeEnvironment } from '@family-historian/config';
import { createPool } from '@family-historian/database';
import { ObjectStorage, parseStorageConfig } from '@family-historian/storage';
import { OutboxDispatcher } from './dispatcher.js';
import { createDefaultHandlers } from './handlers.js';

const environment = parseRuntimeEnvironment(process.env);
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['database_url', 'redis_url', 'req.headers.authorization', 'req.headers.cookie'],
});
const pool = createPool(environment.DATABASE_URL);
const storage = new ObjectStorage(parseStorageConfig(process.env));
const redis = new Redis(environment.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});
const controller = new AbortController();

await redis.connect();
await redis.ping();
const dispatcher = new OutboxDispatcher({
  pool,
  logger,
  handlers: createDefaultHandlers({ storage }),
});
logger.info({ service: 'worker', status: 'ready' }, 'worker dependency check passed');

const requestShutdown = (signal: string): void => {
  logger.info({ signal }, 'shutdown requested');
  controller.abort();
};

process.once('SIGINT', () => requestShutdown('SIGINT'));
process.once('SIGTERM', () => requestShutdown('SIGTERM'));
await dispatcher.run(controller.signal);
await redis.quit();
storage.destroy();
await pool.end();
