#!/usr/bin/env sh
set -eu

set -a
. ./.env
set +a

backup_dir="${BACKUP_DIR:-.artifacts/backups}"
mkdir -p "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_path="$backup_dir/family-historian-$stamp.dump"

docker compose exec -T -e PGPASSWORD="$LOCAL_POSTGRES_PASSWORD" postgres \
  pg_dump --format=custom --no-owner --no-acl -U family_historian family_historian >"$backup_path"

sha256sum "$backup_path" >"$backup_path.sha256"
test -s "$backup_path"
test -s "$backup_path.sha256"

printf 'backup: ok %s\n' "$backup_path"
