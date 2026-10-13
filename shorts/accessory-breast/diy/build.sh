#!/usr/bin/env bash
# Build the animated shorts.
#   ./build.sh            → ../short_monologue.mp4 (talk-to-camera version)
#   ./build.sh mammal     → ../short_diy.mp4      (5-scene "포유류" story)
set -euo pipefail
cd "$(dirname "$0")"
BUILD="${BUILD_DIR:-$(mktemp -d)}"
pip install -q gTTS numpy >/dev/null
if [ "${1:-}" = "mammal" ]; then
  python3 make_audio.py "$BUILD"
  node render.mjs "$BUILD" ../short_diy.mp4
else
  python3 monologue_audio.py "$BUILD"
  SCENE_HTML=monologue.html node render.mjs "$BUILD" ../short_monologue.mp4
fi
