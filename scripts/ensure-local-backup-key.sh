#!/usr/bin/env sh
set -eu

umask 077
[ -f .env ] || { echo 'local backup key: .env is missing' >&2; exit 1; }
if grep -q '^BACKUP_ENCRYPTION_KEY=' .env; then
  echo 'local backup key: present'
  exit 0
fi
key=$(openssl rand -base64 32 | tr -d '\r\n')
tmp=$(mktemp .env.backup.XXXXXX)
trap 'rm -f "$tmp"' EXIT
awk '!/^BACKUP_ENCRYPTION_KEY=/' .env >"$tmp"
printf 'BACKUP_ENCRYPTION_KEY=%s\n' "$key" >>"$tmp"
mv -f "$tmp" .env
trap - EXIT
echo 'local backup key: generated'
