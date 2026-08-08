#!/usr/bin/env sh
set -eu
pnpm --filter @family-historian/storage exec tsx scripts/r2-probe.ts
