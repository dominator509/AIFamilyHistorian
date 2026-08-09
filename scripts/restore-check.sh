#!/usr/bin/env sh
set -eu

set -a
. ./.env
set +a

backup_path="${1:?usage: sh scripts/restore-check.sh <backup.dump.enc>}"
test -f "$backup_path"
test -f "$backup_path.sha256"

expected=$(awk '{print $1}' "$backup_path.sha256")
actual=$(sha256sum "$backup_path" | awk '{print $1}')
test "$expected" = "$actual"

suffix=$(date -u +%Y%m%d%H%M%S)
restore_db="family_historian_restore_check_$suffix"
container_dump_name="$restore_db.dump"
container_dump="/tmp/$container_dump_name"
cleanup() {
  docker compose exec -T -e CONTAINER_DUMP_NAME="$container_dump_name" postgres sh -c \
    'rm -f "/tmp/$CONTAINER_DUMP_NAME"' >/dev/null 2>&1 || true
  docker compose exec -T -e RESTORE_DB="$restore_db" postgres sh -c \
    'PGPASSWORD="$POSTGRES_PASSWORD" dropdb --if-exists -U "$POSTGRES_USER" "$RESTORE_DB"' >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

docker compose exec -T -e RESTORE_DB="$restore_db" postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" createdb -U "$POSTGRES_USER" "$RESTORE_DB"'
corepack pnpm exec tsx scripts/backup-crypto.ts decrypt "$backup_path" - | docker compose exec -T -e CONTAINER_DUMP_NAME="$container_dump_name" postgres sh -c \
  'cat > "/tmp/$CONTAINER_DUMP_NAME"'
docker compose exec -T -e RESTORE_DB="$restore_db" -e CONTAINER_DUMP_NAME="$container_dump_name" postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$RESTORE_DB" "/tmp/$CONTAINER_DUMP_NAME"'

count=$(docker compose exec -T -e RESTORE_DB="$restore_db" postgres sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$RESTORE_DB" -Atqc "select count(*) from schema_migrations"')
test "$count" -ge 1

printf 'restore-check: ok %s schema_migrations=%s\n' "$restore_db" "$count"
