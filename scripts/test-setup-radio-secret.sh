#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
mkdir -p "$tmp/scripts"
cp "$root/scripts/setup-radio-secret.sh" "$tmp/scripts/"
printf 'OTHER=keep\nPANEL_RADIO_SECRET=\n' > "$tmp/.env"
sh "$tmp/scripts/setup-radio-secret.sh" > "$tmp/output"
key=$(sed -n 's/^PANEL_RADIO_SECRET=//p' "$tmp/.env")
[ "${#key}" -eq 64 ]
! grep -F "$key" "$tmp/output" > /dev/null
grep -q '^OTHER=keep$' "$tmp/.env"
sh "$tmp/scripts/setup-radio-secret.sh" > /dev/null
[ "$key" = "$(sed -n 's/^PANEL_RADIO_SECRET=//p' "$tmp/.env")" ]
printf 'PANEL_RADIO_SECRET=""\n' > "$tmp/.env"
sh "$tmp/scripts/setup-radio-secret.sh" > /dev/null
quoted_key=$(sed -n 's/^PANEL_RADIO_SECRET=//p' "$tmp/.env")
[ "${#quoted_key}" -eq 64 ]
printf 'PANEL_RADIO_SECRET="%s"\n' "$quoted_key" > "$tmp/.env"
sh "$tmp/scripts/setup-radio-secret.sh" > /dev/null
grep -q '^PANEL_RADIO_SECRET="' "$tmp/.env"
printf 'PANEL_RADIO_SECRET=short\n' > "$tmp/.env"
if sh "$tmp/scripts/setup-radio-secret.sh" > /dev/null 2>&1; then exit 1; fi
grep -q '^PANEL_RADIO_SECRET=short$' "$tmp/.env"
printf 'PANEL_RADIO_SECRET=\nPANEL_RADIO_SECRET=\n' > "$tmp/.env"
if sh "$tmp/scripts/setup-radio-secret.sh" > /dev/null 2>&1; then exit 1; fi
printf 'PANEL_RADIO_SECRET=\n' > "$tmp/.env"
if PANEL_RADIO_SECRET=override sh "$tmp/scripts/setup-radio-secret.sh" > /dev/null 2>&1; then exit 1; fi
grep -q '^PANEL_RADIO_SECRET=$' "$tmp/.env"
rm "$tmp/.env"
if sh "$tmp/scripts/setup-radio-secret.sh" > /dev/null 2>&1; then exit 1; fi
echo 'Radio secret setup tests passed.'
