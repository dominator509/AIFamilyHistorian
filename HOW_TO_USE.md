# How to Use This Blueprint Pack

1. Save BLUEPRINT_PACK.md in an empty repository and use the splitter below, or use the materialized ZIP.

```sh
#!/usr/bin/env sh
set -eu
pack="${1:-BLUEPRINT_PACK.md}"
[ -f "$pack" ] || { echo "unpack: missing $pack" >&2; exit 1; }
awk '
  /^=== FILE: /{
    path=substr($0, 11)
    sub(/ ===$/, "", path)
    cmd="mkdir -p \"$(dirname \"" path "\")\""
    system(cmd)
    printf "" > path
    out=1
    next
  }
  /^=== END FILE ===$/{ out=0; close(path); next }
  out { print >> path }
' "$pack"
echo "unpack: ok"
```

2. Initialize git, commit the pack, obtain every PREFLIGHT.md item, copy .env.example to .env, and run `sh scripts/preflight.sh` until `preflight: ok`.
3. Give any supported agent `.agent/prompts/run-graph.md`.
4. Observe `.agent/state/LEDGER.md` and git history without using chat as state.
5. Relay between agents through the same prompt and lease protocol.
6. On BLOCKED, read the structured report in the active ExecPlan, make only the named decision, reset as instructed, and relaunch.
7. Use the single-node prompts only for bounded maintenance. Never implement from ROADMAP.md.
8. RUN_COMPLETE plus fresh verify and production-readiness sentinels is the ship decision. Production deployment remains manual.
