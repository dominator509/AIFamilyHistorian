#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "live-fire: ERROR - package.json missing; complete EP-001" >&2; exit 1; }
corepack pnpm exec tsx tests/live-fire/run.ts --proof archive-membership
corepack pnpm exec tsx tests/live-fire/run.ts --proof consented-interview
corepack pnpm exec tsx tests/live-fire/run.ts --proof multipart-media-ingestion
corepack pnpm exec tsx tests/live-fire/run.ts --proof evidence-extraction
corepack pnpm exec tsx tests/live-fire/run.ts --proof timeline-disputes
corepack pnpm exec tsx tests/live-fire/run.ts --proof cited-memoir-draft
corepack pnpm exec tsx tests/live-fire/run.ts --proof book-pdf-epub
corepack pnpm exec tsx tests/live-fire/run.ts --proof authorized-narration
corepack pnpm exec tsx tests/live-fire/run.ts --proof private-family-portal
corepack pnpm exec tsx tests/live-fire/run.ts --proof portable-export
corepack pnpm exec tsx tests/live-fire/run.ts --proof verified-deletion
corepack pnpm exec tsx tests/live-fire/run.ts --proof rights-and-consent
corepack pnpm exec tsx tests/live-fire/run.ts --proof sensitive-claim-gate
corepack pnpm exec tsx tests/live-fire/run.ts --proof ai-cache-telemetry
corepack pnpm exec tsx tests/live-fire/run.ts --proof billing-and-quotas
corepack pnpm exec tsx tests/live-fire/run.ts --proof annual-preservation-review
echo "live-fire: ok"
