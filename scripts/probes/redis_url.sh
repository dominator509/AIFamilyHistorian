#!/usr/bin/env sh
set -eu
: "${REDIS_URL:?}"
node - "$REDIS_URL" <<'NODE'
import net from 'node:net';
import tls from 'node:tls';

const url = new URL(process.argv[2]);
if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('REDIS_URL must use redis or rediss');
const secure = url.protocol === 'rediss:';
const port = Number(url.port || (secure ? 6380 : 6379));
const socket = secure
  ? tls.connect({ host: url.hostname, port, servername: url.hostname })
  : net.connect({ host: url.hostname, port });
socket.setTimeout(20_000);
const commands = [];
if (url.password) commands.push(`*2\r\n$4\r\nAUTH\r\n$${Buffer.byteLength(decodeURIComponent(url.password))}\r\n${decodeURIComponent(url.password)}\r\n`);
commands.push('*1\r\n$4\r\nPING\r\n');
let received = '';
socket.on('connect', () => socket.write(commands.join('')));
socket.on('data', (chunk) => {
  received += chunk.toString('utf8');
  if (received.includes('+PONG\r\n')) { socket.end(); process.exit(0); }
  if (received.startsWith('-')) { console.error('redis probe rejected'); process.exit(1); }
});
socket.on('timeout', () => { console.error('redis probe timeout'); socket.destroy(); process.exit(1); });
socket.on('error', () => { console.error('redis probe connection failed'); process.exit(1); });
NODE
