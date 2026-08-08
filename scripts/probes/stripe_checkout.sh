#!/usr/bin/env sh
set -eu
corepack pnpm exec tsx scripts/probes/stripe_checkout.ts
