#!/usr/bin/env sh
set -eu

: "${WORKER_SANDBOX_EVIDENCE_FILE:?WORKER_SANDBOX_EVIDENCE_FILE is required}"
: "${WORKER_SANDBOX_EVIDENCE_PUBLIC_KEY_FILE:?WORKER_SANDBOX_EVIDENCE_PUBLIC_KEY_FILE is required}"
if [ "${WORKER_SANDBOX_EVIDENCE_REQUIRE_BINDING:-0}" = 1 ]; then
  : "${WORKER_SANDBOX_EVIDENCE_EXPECTED_IMAGE_DIGEST:?WORKER_SANDBOX_EVIDENCE_EXPECTED_IMAGE_DIGEST is required when binding is enabled}"
  : "${WORKER_SANDBOX_EVIDENCE_EXPECTED_APP:?WORKER_SANDBOX_EVIDENCE_EXPECTED_APP is required when binding is enabled}"
  : "${WORKER_SANDBOX_EVIDENCE_EXPECTED_WORKER_ID:?WORKER_SANDBOX_EVIDENCE_EXPECTED_WORKER_ID is required when binding is enabled}"
fi
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
