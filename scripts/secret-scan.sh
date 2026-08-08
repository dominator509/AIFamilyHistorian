#!/usr/bin/env sh
set -eu
export CI=true GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat DEBIAN_FRONTEND=noninteractive

matches=$(git grep -n -I -E \
  '((^|[^A-Za-z0-9])sk-[A-Za-z0-9]{24,}([^A-Za-z0-9]|$)|(^|[^A-Za-z0-9])sk_(live|test)_[A-Za-z0-9]{20,}([^A-Za-z0-9]|$)|(^|[^A-Za-z0-9])re_[A-Za-z0-9_-]{24,}([^A-Za-z0-9]|$)|(^|[^A-Za-z0-9])whsec_[A-Za-z0-9]{24,}([^A-Za-z0-9]|$)|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----|DEEPGRAM_API_KEY[[:space:]]*=[[:space:]]*[A-Za-z0-9_-]{24,}|DEEPSEEK_API_KEY[[:space:]]*=[[:space:]]*sk-[A-Za-z0-9]{24,})' \
  -- . ':(exclude)pnpm-lock.yaml' 2>/dev/null || true)

if [ -n "$matches" ]; then
  files=$(printf '%s\n' "$matches" | cut -d: -f1 | sort -u | tr '\n' ' ')
  echo "secret scan: potential credential material in tracked files: $files" >&2
  exit 1
fi

echo "secret scan: ok"
