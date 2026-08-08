#!/usr/bin/env sh
set -eu

local_host=$(R2_ENDPOINT="${R2_ENDPOINT:-}" node --input-type=module -e "const u=new URL(process.env.R2_ENDPOINT); process.stdout.write(['127.0.0.1','localhost'].includes(u.hostname) ? 'yes' : 'no')")
if [ "$local_host" = yes ] && docker compose exec -T object-storage-init true </dev/null >/dev/null 2>&1; then
  docker compose exec -T -e R2_BUCKET="${R2_BUCKET:?}" object-storage-init sh -ec 'mc stat "local/$R2_BUCKET" >/dev/null' </dev/null
else
  pnpm --filter @family-historian/storage exec tsx scripts/r2-probe.ts
fi
