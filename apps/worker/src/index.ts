import { createServer } from 'node:http';
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
let ready = false;
const healthServer = createServer((request, response) => {
  if (request.url === '/health/live') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"status":"ok"}');
    return;
  }
  if (request.url === '/health/ready') {
    response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: ready ? 'ready' : 'starting' }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const healthPort = Number.parseInt(process.env.PORT ?? '8080', 10);
if (!Number.isInteger(healthPort) || healthPort < 1 || healthPort > 65_535)
  throw new Error('worker health port is invalid');
await new Promise<void>((resolve, reject) => {
  healthServer.once('error', reject);
  healthServer.listen(healthPort, '127.0.0.1', () => resolve());
});

await redis.connect();
await redis.ping();
ready = true;
const dispatcher = new OutboxDispatcher({
  pool,
  logger,
  handlers: createDefaultHandlers({ storage }),
});
logger.info({ service: 'worker', status: 'ready' }, 'worker dependency check passed');

const requestShutdown = (signal: string): void => {
  logger.info({ signal }, 'shutdown requested');
  ready = false;
  controller.abort();
  healthServer.close();
};

process.once('SIGINT', () => requestShutdown('SIGINT'));
process.once('SIGTERM', () => requestShutdown('SIGTERM'));
await dispatcher.run(controller.signal);
healthServer.close();
await redis.quit();
storage.destroy();
await pool.end();
