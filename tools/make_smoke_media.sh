#!/usr/bin/env bash
# Generates throwaway test media for tests and the _smoke project. Safe to rerun.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p library music projects/_smoke/audio
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
ff -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440 -t 6 \
   -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest library/_smoke-landscape.mp4
ff -f lavfi -i testsrc=size=1080x1920:rate=30 -t 6 -c:v libx264 -pix_fmt yuv420p library/_smoke-portrait.mp4
ff -f lavfi -i gradients=size=1600x1200:seed=7 -frames:v 1 library/_smoke.jpg
ff -f lavfi -i sine=frequency=220:duration=20 -c:a libmp3lame -q:a 4 music/_smoke.mp3
ff -f lavfi -i sine=frequency=660:duration=2.5 projects/_smoke/audio/_fixture-voice.wav
echo "smoke media ready"
