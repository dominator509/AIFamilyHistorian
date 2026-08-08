#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "live-fire: ERROR - package.json missing; complete EP-001" >&2; exit 1; }
failed=0
deferred=0
internal_runner=0
worker_image="${WORKER_IMAGE:-family-historian-worker:local}"
repo_root=$(pwd -W 2>/dev/null || pwd)
internal_network=''
internal_db=''
if [ -f .env ] && docker image inspect "$worker_image" >/dev/null 2>&1 && docker compose exec -T postgres true </dev/null >/dev/null 2>&1; then
  internal_network=$(docker network ls --filter label=com.docker.compose.network=family_historian_internal --format '{{.Name}}' | awk 'NR == 1 { print; exit }')
fi
if [ -n "$internal_network" ]; then
  internal_runner=1
  set -a
  . ./.env
  set +a
  internal_db=$(DATABASE_URL="$DATABASE_URL" node --input-type=module -e "const u=new URL(process.env.DATABASE_URL); u.hostname='postgres'; u.port='5432'; process.stdout.write(u.toString())")
  echo "live-fire: internal runner enabled for archive-membership and multipart-media-ingestion"
fi

run_proof() {
  proof="$1"
  case "$proof" in
    archive-membership|multipart-media-ingestion)
      if [ "$internal_runner" -eq 1 ]; then
        MSYS_NO_PATHCONV=1 docker run --rm \
          --network "$internal_network" \
          --env-file .env \
          -v "$repo_root/.env:/app/.env:ro" \
          -v "$repo_root/drizzle:/app/drizzle:ro" \
          -e NODE_ENV=test \
          -e DATABASE_URL="$internal_db" \
          -e R2_ENDPOINT=http://object-storage:9000 \
          "$worker_image" \
          /app/node_modules/.bin/tsx /app/tests/live-fire/run.ts --proof "$proof"
        return
      fi
      ;;
  esac
  corepack pnpm exec tsx tests/live-fire/run.ts --proof "$proof"
}

for proof in \
  archive-membership \
  consented-interview \
  multipart-media-ingestion \
  evidence-extraction \
  timeline-disputes \
  cited-memoir-draft \
  book-pdf-epub \
  authorized-narration \
  private-family-portal \
  portable-export \
  verified-deletion \
  rights-and-consent \
  sensitive-claim-gate \
  ai-cache-telemetry \
  billing-and-quotas \
  annual-preservation-review; do
  if run_proof "$proof"; then
    :
  else
    code=$?
    if [ "$code" -eq 3 ]; then
      deferred=1
    else
      failed=1
    fi
  fi
done

[ "$failed" -eq 0 ] || { echo "live-fire: failed proofs remain" >&2; exit 1; }
[ "$deferred" -eq 0 ] || { echo "live-fire: deferred proofs remain; no synthetic success was reported" >&2; exit 3; }
echo "live-fire: ok"
