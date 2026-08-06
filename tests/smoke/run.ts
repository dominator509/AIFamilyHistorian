import { createApp } from '../../apps/api/src/app.js';

const app = await createApp();
const response = await app.inject({ method: 'GET', url: '/health/live' });
await app.close();
if (response.statusCode !== 200) throw new Error(`health smoke failed: ${response.statusCode}`);
console.log('smoke: ok');
