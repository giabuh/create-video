#!/usr/bin/env bash
# Copy media between this machine and Google Drive. Never deletes; never overwrites a newer file.
# Usage: tools/sync.sh push|pull [extra rclone flags, e.g. --dry-run]
set -euo pipefail
cd "$(dirname "$0")/.."
mode=${1:-}
case "$mode" in push|pull) shift ;; *) echo "Usage: tools/sync.sh push|pull [--dry-run]"; exit 2 ;; esac

REMOTE=$(python3 -c 'import json;print(json.load(open("config.json"))["sync"]["remote"])')
rclone listremotes | grep -qx "${REMOTE%%:*}:" || { echo "rclone remote '${REMOTE%%:*}' not configured. Run: rclone config"; exit 1; }

copy() { # copy <local> <remote-subpath> [filters...]
  local local_dir=$1 sub=$2; shift 2
  mkdir -p "$local_dir"
  if [ "$mode" = push ]; then
    rclone copy "$local_dir" "$REMOTE/$sub" --update "$@" ${EXTRA[@]+"${EXTRA[@]}"}
  else
    local rc=0
    rclone copy "$REMOTE/$sub" "$local_dir" --update "$@" ${EXTRA[@]+"${EXTRA[@]}"} || rc=$?
    # exit 3 = remote dir not found: nothing to pull yet (e.g. empty reference/ never pushed)
    if [ "$rc" = 3 ]; then echo "- skip pull $local_dir (not on Drive yet)"; return 0; fi
    [ "$rc" = 0 ] || return "$rc"
  fi
  echo "✓ $mode $local_dir"
}

EXTRA=("$@")
copy library library
copy music music
copy sfx sfx
copy reference reference
