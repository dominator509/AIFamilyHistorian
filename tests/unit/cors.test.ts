import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';

const apps: Array<Awaited<ReturnType<typeof createApp>>> = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

describe('CORS boundary', () => {
  it('allows only an explicitly configured origin', async () => {
    const app = await createApp({
      service: { ready: () => Promise.resolve(true) } as never,
      sessionSecret: 's'.repeat(32),
      corsAllowedOrigins: ['https://app.example.com'],
    });
    apps.push(app);
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/health/live',
      headers: {
        origin: 'https://app.example.com',
        'access-control-request-method': 'GET',
      },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');
    const denied = await app.inject({
      method: 'OPTIONS',
      url: '/health/live',
      headers: {
        origin: 'https://evil.example.com',
        'access-control-request-method': 'GET',
      },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
