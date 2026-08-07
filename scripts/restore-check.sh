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
container_dump="/tmp/$restore_db.dump"
cleanup() {
  docker compose exec -T postgres sh -c "rm -f $container_dump" >/dev/null 2>&1 || true
  docker compose exec -T -e PGPASSWORD="$LOCAL_POSTGRES_PASSWORD" postgres \
    dropdb --if-exists -U family_historian "$restore_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

docker compose exec -T -e PGPASSWORD="$LOCAL_POSTGRES_PASSWORD" postgres \
  createdb -U family_historian "$restore_db"
corepack pnpm exec tsx scripts/backup-crypto.ts decrypt "$backup_path" - | docker compose exec -T postgres sh -c "cat > $container_dump"
docker compose exec -T -e PGPASSWORD="$LOCAL_POSTGRES_PASSWORD" postgres sh -c \
  "pg_restore --exit-on-error --no-owner --no-acl -U family_historian -d $restore_db $container_dump"

count=$(docker compose exec -T -e PGPASSWORD="$LOCAL_POSTGRES_PASSWORD" postgres \
  psql -U family_historian -d "$restore_db" -Atqc "select count(*) from schema_migrations")
test "$count" -ge 1

printf 'restore-check: ok %s schema_migrations=%s\n' "$restore_db" "$count"
