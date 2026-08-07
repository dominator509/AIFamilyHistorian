#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive
[ -f package.json ] || { echo "live-fire: ERROR - package.json missing; complete EP-001" >&2; exit 1; }
failed=0
deferred=0
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
  if corepack pnpm exec tsx tests/live-fire/run.ts --proof "$proof"; then
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
