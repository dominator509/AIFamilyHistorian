import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthStatusSchema } from '@family-historian/contracts';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
    bodyLimit: 1_048_576,
    requestIdHeader: 'x-request-id',
  });

  await app.register(helmet, { global: true });
  await app.register(cors, { origin: false, credentials: false });

  app.get('/health/live', () =>
    healthStatusSchema.parse({
      service: 'api',
      status: 'live',
      timestamp: new Date().toISOString(),
    }),
  );
  app.get('/health/ready', () =>
    healthStatusSchema.parse({
      service: 'api',
      status: 'ready',
      timestamp: new Date().toISOString(),
    }),
  );

  return app;
}
