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
    rclone copy "$local_dir" "$REMOTE/$sub" --update "$@" "${EXTRA[@]}"
  else
    rclone copy "$REMOTE/$sub" "$local_dir" --update "$@" "${EXTRA[@]}"
  fi
  echo "✓ $mode $local_dir"
}

EXTRA=("$@")
copy library library
copy music music
copy reference reference
copy projects projects --include "*/reel-v*.mp4"
