#!/bin/sh
# Isolated, disposable PostgreSQL only. Never reads DATABASE_URL or connects to production.
set -eu
gateway_db_root=$(mktemp -d /private/tmp/huji-gateway-check.XXXXXX)
trap 'pg_ctl -D "$gateway_db_root/data" -m immediate -w stop >/dev/null 2>&1 || true' EXIT
initdb -D "$gateway_db_root/data" -U gateway_test -A trust --no-locale -E UTF8 >/dev/null
pg_ctl -D "$gateway_db_root/data" -l "$gateway_db_root/postgres.log" -o "-F -k $gateway_db_root -h ''" -w start >/dev/null
psql -h "$gateway_db_root" -U gateway_test -d postgres -v ON_ERROR_STOP=1 -c 'create role anon; create role authenticated; create role service_role;'
for migration in supabase/migrations/*.sql; do
  psql -h "$gateway_db_root" -U gateway_test -d postgres -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done
for checks in tests/*.sql; do
  psql -h "$gateway_db_root" -U gateway_test -d postgres -v ON_ERROR_STOP=1 -f "$checks"
done
printf 'Database checks passed in disposable instance: %s\n' "$gateway_db_root"
