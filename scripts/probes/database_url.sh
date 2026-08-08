#!/usr/bin/env sh
set -eu

local_host=''
if [ -n "${DATABASE_URL:-}" ]; then
  local_host=$(DATABASE_URL="$DATABASE_URL" node --input-type=module -e "const u=new URL(process.env.DATABASE_URL); process.stdout.write(['127.0.0.1','localhost'].includes(u.hostname) ? 'yes' : 'no')")
fi

if [ "$local_host" = yes ] && docker compose exec -T postgres true </dev/null >/dev/null 2>&1; then
  internal_url=$(DATABASE_URL="$DATABASE_URL" node --input-type=module -e "const u=new URL(process.env.DATABASE_URL); u.hostname='postgres'; u.port='5432'; process.stdout.write(u.toString())")
  docker compose exec -T postgres psql "$internal_url" -v ON_ERROR_STOP=1 -Atqc "select 1" </dev/null | grep -qx 1
else
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "select 1" | grep -qx 1
fi
