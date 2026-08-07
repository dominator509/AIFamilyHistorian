import { createConnection, type Socket } from 'node:net';
import { connect, type TLSSocket } from 'node:tls';
import { describe, expect, it } from 'vitest';
import { createPool } from '../../packages/database/src/index.js';

type RedisSocket = Socket | TLSSocket;

describe('local infrastructure', () => {
  it('passes the repository connectivity sentinel', async () => {
    if (process.loadEnvFile) process.loadEnvFile('.env');
    const pool = createPool();
    try {
      const result = await pool.query('select 1');
      expect(result.rowCount).toBe(1);
      await redisProbe(process.env.REDIS_URL ?? '');
      await Promise.all([
        checkHttp(`${process.env.R2_ENDPOINT ?? 'http://127.0.0.1:39000'}/minio/health/ready`),
        checkHttp(`${process.env.MAILPIT_HTTP_URL ?? 'http://127.0.0.1:18025'}/api/v1/info`),
        checkHttp('http://127.0.0.1:13134/'),
      ]);
    } finally {
      await pool.end();
    }
  });
});

function checkHttp(url: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  return fetch(url, { signal: controller.signal }).then((response) => {
    clearTimeout(timeout);
    expect(response.ok).toBe(true);
  });
}

function redisProbe(rawUrl: string): Promise<void> {
  if (!rawUrl) throw new Error('REDIS_URL missing');
  const redisUrl = new URL(rawUrl);
  const protocol = redisUrl.protocol;
  if (!['redis:', 'rediss:'].includes(protocol)) throw new Error('REDIS_URL must use redis or rediss');
  const secure = protocol === 'rediss:';
  const port = Number(redisUrl.port || (secure ? 6380 : 6379));
  const socket: RedisSocket = secure
    ? connect({
      host: redisUrl.hostname,
      port,
      servername: redisUrl.hostname,
    })
    : createConnection({
      host: redisUrl.hostname,
      port,
    });
  socket.setTimeout(20_000);

  return new Promise((resolve, reject) => {
    const buffer: Buffer[] = [];
    const commands: Buffer[] = [];
    const auth = redisUrl.password;
    if (auth) {
      const bytes = Buffer.from(decodeURIComponent(auth));
      commands.push(
        Buffer.from(`*2\r\n$4\r\nAUTH\r\n$${bytes.length}\r\n${bytes.toString('utf8')}\r\n`),
      );
    }
    commands.push(Buffer.from('*1\r\n$4\r\nPING\r\n'));
    socket.on('connect', () => {
      for (const command of commands) socket.write(command);
    });
    socket.on('data', (chunk: Buffer) => {
      buffer.push(chunk);
      const message = Buffer.concat(buffer).toString('utf8');
      if (message.includes('+PONG\r\n')) return resolve(close(socket));
      if (message.startsWith('-')) return reject(new Error('redis probe rejected'));
    });
    socket.on('timeout', () => reject(new Error('redis probe timeout')));
    socket.on('error', (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function close(socket: RedisSocket): void {
  socket.end();
  socket.destroy();
}
