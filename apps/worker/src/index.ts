import { Redis } from 'ioredis';
import pino from 'pino';
import { parseRuntimeEnvironment } from '@family-historian/config';

const environment = parseRuntimeEnvironment(process.env);
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['database_url', 'redis_url'],
});
const redis = new Redis(environment.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

await redis.connect();
await redis.ping();
logger.info({ service: 'worker', status: 'ready' }, 'worker dependency check passed');

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutdown requested');
  await redis.quit();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
