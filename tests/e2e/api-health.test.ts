import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';

describe('API entry point', () => {
  it('serves a validated live status with hardened headers', async () => {
    const app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.json()).toMatchObject({ service: 'api', status: 'live' });
    await app.close();
  });
});
