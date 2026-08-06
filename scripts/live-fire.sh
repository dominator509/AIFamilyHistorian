#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "live-fire: ERROR - package.json missing; complete EP-001" >&2; exit 1; }
pnpm exec tsx tests/live-fire/run.ts --proof archive-membership
pnpm exec tsx tests/live-fire/run.ts --proof consented-interview
pnpm exec tsx tests/live-fire/run.ts --proof multipart-media-ingestion
pnpm exec tsx tests/live-fire/run.ts --proof evidence-extraction
pnpm exec tsx tests/live-fire/run.ts --proof timeline-disputes
pnpm exec tsx tests/live-fire/run.ts --proof cited-memoir-draft
pnpm exec tsx tests/live-fire/run.ts --proof book-pdf-epub
pnpm exec tsx tests/live-fire/run.ts --proof authorized-narration
pnpm exec tsx tests/live-fire/run.ts --proof private-family-portal
pnpm exec tsx tests/live-fire/run.ts --proof portable-export
pnpm exec tsx tests/live-fire/run.ts --proof verified-deletion
pnpm exec tsx tests/live-fire/run.ts --proof rights-and-consent
pnpm exec tsx tests/live-fire/run.ts --proof sensitive-claim-gate
pnpm exec tsx tests/live-fire/run.ts --proof ai-cache-telemetry
pnpm exec tsx tests/live-fire/run.ts --proof billing-and-quotas
pnpm exec tsx tests/live-fire/run.ts --proof annual-preservation-review
echo "live-fire: ok"
