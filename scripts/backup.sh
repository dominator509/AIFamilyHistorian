#!/usr/bin/env sh
set -eu

set -a
. ./.env
set +a

backup_dir="${BACKUP_DIR:-.artifacts/backups}"
mkdir -p "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_path="$backup_dir/family-historian-$stamp.dump.enc"
plain_path="$backup_path.plain"
cleanup() { rm -f "$plain_path"; }
trap cleanup EXIT HUP INT TERM

docker compose exec -T postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB"' >"$plain_path"

corepack pnpm exec tsx scripts/backup-crypto.ts encrypt "$plain_path" "$backup_path"

sha256sum "$backup_path" >"$backup_path.sha256"
test -s "$backup_path"
test -s "$backup_path.sha256"

printf 'backup: ok %s\n' "$backup_path"
