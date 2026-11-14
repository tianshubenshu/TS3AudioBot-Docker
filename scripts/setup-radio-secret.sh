#!/bin/sh
# Generate the radio bridge secret locally without displaying it or replacing an existing one.
set -eu
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo 'Create .env from panel/.env.example and configure your panel and database first.' >&2
  exit 1
fi
if [ "${PANEL_RADIO_SECRET+x}" = x ]; then
  echo 'Unset PANEL_RADIO_SECRET in the shell before running this script; it overrides .env in Compose.' >&2
  exit 1
fi

count=$(awk '/^[[:space:]]*(export[[:space:]]+)?PANEL_RADIO_SECRET[[:space:]]*=/ { n++ } END { print n+0 }' .env)
if [ "$count" -gt 1 ]; then
  echo 'More than one PANEL_RADIO_SECRET entry exists in .env; resolve the duplicates first.' >&2
  exit 1
fi
if [ "$count" -eq 1 ] && ! grep -q '^PANEL_RADIO_SECRET=' .env; then
  echo 'Use the standard PANEL_RADIO_SECRET=value form in .env before running this script.' >&2
  exit 1
fi
value=$(sed -n 's/^PANEL_RADIO_SECRET=//p' .env | tr -d '\r')
case "$value" in
  \"*\") value=${value#\"}; value=${value%\"} ;;
  \'*\') value=${value#\'}; value=${value%\'} ;;
esac
if [ -n "$value" ]; then
  if [ "${#value}" -lt 32 ]; then
    echo 'The existing PANEL_RADIO_SECRET is too short; it was not changed.' >&2
    exit 1
  fi
  echo 'An existing radio secret is present; it was not changed.'
  exit 0
fi

umask 077
tmp=$(mktemp .env.radio.XXXXXX)
trap 'rm -f "$tmp"' EXIT HUP INT TERM
secret=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
if [ "${#secret}" -ne 64 ]; then
  echo 'Could not generate the radio secret.' >&2
  exit 1
fi
awk '!/^PANEL_RADIO_SECRET=/' .env > "$tmp"
printf 'PANEL_RADIO_SECRET=%s\n' "$secret" >> "$tmp"
mv -f "$tmp" .env
trap - EXIT HUP INT TERM
echo 'Radio secret generated in .env. Recreate the bot and panel to use it.'
