#!/usr/bin/env sh
set -eu
fail() { echo "preflight: FAIL - $1" >&2; exit 1; }
[ -f AGENTS.md ] && [ -d .agent ] || fail "run from repository root"
for f in AGENTS.md COMMANDS.md PREFLIGHT.md .env.example .agent/GRAPH.md .agent/LOOPS.md .agent/state/LEDGER.md .agent/reality-patterns .agent/reality-allow; do [ -f "$f" ] || fail "missing required file: $f"; done
for t in git awk grep sed curl jq openssl node corepack pnpm docker; do command -v "$t" >/dev/null 2>&1 || fail "missing required tool: $t"; done
[ -f .env ] || fail "missing .env (copy .env.example, fill every REQUIRED value, rerun)"
set -a; . ./.env; set +a
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
awk '/^PREFLIGHT-TABLE-BEGIN$/{t=1;next} /^PREFLIGHT-TABLE-END$/{t=0} t && NF' PREFLIGHT.md > "$TMP"
[ -s "$TMP" ] || fail "PREFLIGHT-TABLE missing or empty"
if [ -x /usr/bin/timeout ]; then
  TCMD="/usr/bin/timeout 30"
elif timeout --version 2>/dev/null | grep -q 'GNU coreutils'; then
  TCMD="timeout 30"
else
  fail "GNU timeout is required for bounded credential probes"
fi
failures=0
while IFS='|' read -r var req probe; do
  eval "val=\${$var:-}"
  if [ -z "$val" ]; then
    [ "$req" = OPTIONAL ] && continue
    echo "preflight: unresolved $var (value is not set)" >&2
    failures=$((failures + 1))
    continue
  fi
  if [ "$probe" != "-" ]; then
    if [ ! -f "$probe" ]; then
      echo "preflight: unresolved $var (missing probe: $probe)" >&2
      failures=$((failures + 1))
      continue
    fi
    if ! $TCMD sh "$probe" >/dev/null 2>&1; then
      echo "preflight: unresolved $var (credential probe failed)" >&2
      failures=$((failures + 1))
    fi
  fi
done < "$TMP"
if [ "${WORKER_SANDBOX_EVIDENCE_REQUIRE_BINDING:-0}" = 1 ]; then
  for var in \
    WORKER_SANDBOX_EVIDENCE_EXPECTED_IMAGE_DIGEST \
    WORKER_SANDBOX_EVIDENCE_EXPECTED_APP \
    WORKER_SANDBOX_EVIDENCE_EXPECTED_WORKER_ID \
    WORKER_SANDBOX_EVIDENCE_EXPECTED_PUBLIC_KEY_SHA256; do
    eval "val=\${$var:-}"
    if [ -z "$val" ]; then
      echo "preflight: unresolved $var (required when sandbox binding is enabled)" >&2
      failures=$((failures + 1))
    fi
  done
fi
[ "$failures" -eq 0 ] || { echo "preflight: FAIL - $failures unresolved requirements" >&2; exit 1; }
echo "preflight: ok"
