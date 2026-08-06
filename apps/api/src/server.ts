import { parseRuntimeEnvironment } from '@family-historian/config';
import { createApp } from './app.js';

const environment = parseRuntimeEnvironment(process.env);
const app = await createApp();

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutdown requested');
  await app.close();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
await app.listen({ host: environment.HOST, port: environment.PORT });
