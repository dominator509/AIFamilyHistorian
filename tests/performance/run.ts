import { performance } from 'node:perf_hooks';
import { createApp } from '../../apps/api/src/app.js';

const app = await createApp();
try {
  const samples: number[] = [];
  for (let index = 0; index < 100; index += 1) {
    const started = performance.now();
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    if (response.statusCode !== 200)
      throw new Error(`performance smoke health status ${response.statusCode}`);
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? 0;
  if (p95 >= 400) throw new Error(`performance: FAIL p95=${p95.toFixed(2)}ms`);
  console.log(`performance: ok requests=${samples.length} p95=${p95.toFixed(2)}ms`);
} finally {
  await app.close();
}
