#!/usr/bin/env sh
set -eu
LOG_LEVEL=silent corepack pnpm exec tsx tests/performance/run.ts
