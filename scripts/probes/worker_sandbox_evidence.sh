#!/usr/bin/env sh
set -eu

: "${WORKER_SANDBOX_EVIDENCE_FILE:?WORKER_SANDBOX_EVIDENCE_FILE is required}"
: "${WORKER_SANDBOX_EVIDENCE_PUBLIC_KEY_FILE:?WORKER_SANDBOX_EVIDENCE_PUBLIC_KEY_FILE is required}"
[ -f "$WORKER_SANDBOX_EVIDENCE_FILE" ] || {
  echo "worker sandbox evidence: file does not exist" >&2
  exit 1
}
[ -s "$WORKER_SANDBOX_EVIDENCE_FILE" ] || {
  echo "worker sandbox evidence: file is empty" >&2
  exit 1
}
[ -f "$WORKER_SANDBOX_EVIDENCE_PUBLIC_KEY_FILE" ] || {
  echo "worker sandbox evidence: public key file does not exist" >&2
  exit 1
}
[ -s "$WORKER_SANDBOX_EVIDENCE_PUBLIC_KEY_FILE" ] || {
  echo "worker sandbox evidence: public key file is empty" >&2
  exit 1
}
node scripts/probes/worker-sandbox-evidence.mjs "$WORKER_SANDBOX_EVIDENCE_FILE"
