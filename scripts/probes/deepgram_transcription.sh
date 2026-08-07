#!/usr/bin/env sh
set -eu
corepack pnpm exec tsx scripts/probes/deepgram_transcription.ts
