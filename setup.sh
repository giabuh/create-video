#!/usr/bin/env bash
# One-shot, idempotent setup on a fresh clone: ./setup.sh
set -euo pipefail
cd "$(dirname "$0")"
ok() { echo "✓ $*"; }
warn() { echo "⚠ $*"; }

for t in git ffmpeg ffprobe uv node npm rclone python3; do
  if command -v "$t" >/dev/null; then ok "$t"; else warn "missing $t"; fi
done
command -v ffmpeg >/dev/null || warn "  install: sudo apt install ffmpeg"
command -v rclone >/dev/null || warn "  install: sudo apt install rclone"
command -v uv >/dev/null || warn "  install: curl -LsSf https://astral.sh/uv/install.sh | sh"

git submodule update --init
if command -v nvidia-smi >/dev/null && nvidia-smi >/dev/null 2>&1; then
  ok "NVIDIA GPU found -> VieNeu with CUDA"; (cd VieNeu-TTS && uv sync --extra cuda)
else
  warn "No NVIDIA GPU -> VieNeu runs on CPU (ONNX), slower"; (cd VieNeu-TTS && uv sync)
fi

npm ci
mkdir -p inbox library music reference voices/tries projects
[ -f library/media-index.json ] || echo '{}' > library/media-index.json
for d in library music brands projects; do
  [ -L "studio/public/$d" ] || { warn "studio/public/$d symlink missing, recreating"; ln -sfn "../../$d" "studio/public/$d"; }
done

REMOTE=$(python3 -c 'import json;print(json.load(open("config.json"))["sync"]["remote"].split(":")[0])')
if command -v rclone >/dev/null && rclone listremotes | grep -qx "$REMOTE:"; then
  ok "rclone remote $REMOTE: -> run: tools/sync.sh pull"
else
  warn "rclone remote '$REMOTE' not set up: run 'rclone config', create a Google Drive remote named $REMOTE"
fi
[ -x .whisper/whisper.cpp/build/bin/whisper-cli ] && ok "whisper.cpp ready" || warn "optional: node tools/whisper/setup.mjs  (word timings for motion \"at\"; builds whisper.cpp + downloads the model ~1.6 GB)"
ok "setup done"
