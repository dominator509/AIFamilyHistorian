import { execFile } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('secret-safe provider probe transport', () => {
  let server: ReturnType<typeof createHttpServer>;
  let port: number;

  beforeEach(async () => {
    server = createHttpServer((request, response) => {
      if (request.headers.authorization !== 'Token test-secret') {
        response.writeHead(400);
        response.end();
        return;
      }
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('reads credentials from the environment and sends them only as request headers', async () => {
    const { stdout } = await execFileAsync(process.execPath, ['scripts/probes/http_request.mjs'], {
      env: {
        ...process.env,
        PROBE_URL: `http://127.0.0.1:${port}/probe`,
        PROBE_SECRET_ENV: 'PROBE_TEST_SECRET',
        PROBE_TEST_SECRET: 'test-secret',
        PROBE_HEADER_NAME: 'Authorization',
        PROBE_HEADER_PREFIX: 'Token ',
      },
      encoding: 'utf8',
    });
    expect(stdout).toContain('provider probe: ok');
  });
});
