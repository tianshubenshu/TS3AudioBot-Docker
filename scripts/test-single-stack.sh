#!/bin/sh
set -eu
export PANEL_ADMIN_PASSWORD=ci-only-password
compose='docker compose -p ts3-single-ci -f docker-compose.single.yml'
cleanup() { $compose down || true; }
trap cleanup EXIT HUP INT TERM
$compose up -d --build
i=0
until curl -fsS http://127.0.0.1:8080/healthz >/dev/null; do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then $compose logs; exit 1; fi
  sleep 2
done
$compose exec -T ts3audiobot node - < scripts/check-single-stack.mjs
$compose restart ts3audiobot
i=0
until curl -fsS http://127.0.0.1:8080/healthz >/dev/null; do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then $compose logs; exit 1; fi
  sleep 2
done
$compose exec -T ts3audiobot node - < scripts/check-single-stack.mjs
