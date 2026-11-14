#!/bin/bash
set -eu
umask 077
if ! grep -Eq '^[[:space:]]*hosts[[:space:]]*=[[:space:]]*\[[[:space:]]*"127\.0\.0\.1"[[:space:]]*\][[:space:]]*(#.*)?$' /data/ts3audiobot.toml; then
  echo 'The bot API must be bound to 127.0.0.1 in /data/ts3audiobot.toml.' >&2
  exit 1
fi
keyfile=/data/.panel-token-key
if [ ! -s "$keyfile" ]; then
  key=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
  [ "${#key}" -eq 64 ] || { echo 'Could not generate panel key.' >&2; exit 1; }
  tmp=$(mktemp /data/.panel-key.XXXXXX)
  trap 'rm -f "$tmp"' EXIT
  printf '%s\n' "$key" > "$tmp"
  mv "$tmp" "$keyfile"
  trap - EXIT
fi
export TOKEN_KEY="$(cat "$keyfile")"
PANEL_RADIO_SECRET=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
[ "${#PANEL_RADIO_SECRET}" -eq 64 ] || { echo 'Could not generate radio key.' >&2; exit 1; }
export PANEL_RADIO_SECRET

dotnet /opt/TS3AudioBot/TS3AudioBot.dll --non-interactive --stats-disabled &
bot_pid=$!
node /opt/panel/src/index.js &
panel_pid=$!
stop_children() {
  kill "$bot_pid" "$panel_pid" 2>/dev/null || true
  wait "$bot_pid" "$panel_pid" 2>/dev/null || true
}
trap 'stop_children; exit 0' TERM INT
set +e
wait -n "$bot_pid" "$panel_pid"
status=$?
set -e
stop_children
exit "$status"
