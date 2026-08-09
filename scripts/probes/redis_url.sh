#!/usr/bin/env sh
set -eu
: "${REDIS_URL:?}"

local_host=$(REDIS_URL="$REDIS_URL" node --input-type=module -e "const u=new URL(process.env.REDIS_URL); process.stdout.write(['127.0.0.1','localhost'].includes(u.hostname) ? 'yes' : 'no')")
if [ "$local_host" = yes ] && docker compose exec -T redis true </dev/null >/dev/null 2>&1; then
  redis_password=$(REDIS_URL="$REDIS_URL" node --input-type=module -e "const u=new URL(process.env.REDIS_URL); process.stdout.write(decodeURIComponent(u.password))")
  docker compose exec -T -e REDISCLI_AUTH="$redis_password" redis redis-cli ping </dev/null | grep -qx PONG
  exit 0
fi

REDIS_URL="$REDIS_URL" node - <<'NODE'
import net from 'node:net';
import tls from 'node:tls';

const url = new URL(process.env.REDIS_URL);
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
