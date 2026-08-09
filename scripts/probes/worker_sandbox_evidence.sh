#!/usr/bin/env sh
set -eu

: "${WORKER_SANDBOX_EVIDENCE_FILE:?WORKER_SANDBOX_EVIDENCE_FILE is required}"
[ -f "$WORKER_SANDBOX_EVIDENCE_FILE" ] || {
  echo "worker sandbox evidence: file does not exist" >&2
  exit 1
}
[ -s "$WORKER_SANDBOX_EVIDENCE_FILE" ] || {
  echo "worker sandbox evidence: file is empty" >&2
  exit 1
}
echo "worker sandbox evidence: present"
