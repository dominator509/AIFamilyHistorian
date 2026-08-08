import { Redis } from 'ioredis';
import { parseCorsOrigins, parseRuntimeEnvironment } from '@family-historian/config';
import { RedisFixedWindowRateLimiter, RedisSessionRevocationStore } from '@family-historian/auth';
import { createPool } from '@family-historian/database';
import { ObjectStorage, parseStorageConfig } from '@family-historian/storage';
import { ArchiveService } from './archive-service.js';
import { createApp } from './app.js';
import { PostgresSessionStore } from './session-store.js';

const environment = parseRuntimeEnvironment(process.env);
const pool = createPool(environment.DATABASE_URL);
const storage = new ObjectStorage(parseStorageConfig(process.env));
const redis = new Redis(environment.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});
await redis.connect();
await redis.ping();
const service = new ArchiveService(pool, environment.FIELD_ENCRYPTION_MASTER_KEY, storage);
const app = await createApp({
  service,
  sessionSecret: environment.SESSION_SECRET,
  corsAllowedOrigins: parseCorsOrigins(environment.CORS_ALLOWED_ORIGINS),
  stripeWebhookSecret: environment.STRIPE_WEBHOOK_SECRET,
  rateLimiter: new RedisFixedWindowRateLimiter(redis, {
    limit: 120,
    windowMilliseconds: 60_000,
  }),
  sessionRevocationStore: new RedisSessionRevocationStore(redis),
  sessionStore: new PostgresSessionStore(pool),
  sessionMembershipChecker: (context, userId) => service.isArchiveMember(context, userId),
});

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutdown requested');
  await app.close();
  await redis.quit();
  storage.destroy();
  await pool.end();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
await app.listen({ host: environment.HOST, port: environment.PORT });
