#!/usr/bin/env sh
set -eu

local_host=''
if [ -n "${DATABASE_URL:-}" ]; then
  local_host=$(DATABASE_URL="$DATABASE_URL" node --input-type=module -e "const u=new URL(process.env.DATABASE_URL); process.stdout.write(['127.0.0.1','localhost'].includes(u.hostname) ? 'yes' : 'no')")
fi

if [ "$local_host" = yes ] && docker compose exec -T postgres true </dev/null >/dev/null 2>&1; then
  docker compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atqc "select 1"' </dev/null | grep -qx 1
else
  exec node scripts/probes/database_url.mjs
fi
