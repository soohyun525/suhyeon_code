#!/usr/bin/env bash
# Build the DIY animated short: voices + music -> frames -> short_diy.mp4
set -euo pipefail
cd "$(dirname "$0")"
BUILD="${BUILD_DIR:-$(mktemp -d)}"
pip install -q gTTS numpy >/dev/null
python3 make_audio.py "$BUILD"
node render.mjs "$BUILD" ../short_diy.mp4
