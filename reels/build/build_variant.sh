#!/bin/bash
# usage: build_variant.sh <voice_dir> <output.mp4>
set -e
cd "$(dirname "$0")"
python3 mkvoice.py "$1"
REEL=reel3.html NODE_PATH=/opt/node-tools/node_modules node render.js tl tl3.json
VDIR="$1" python3 audio3.py
rm -rf ../seq3
REEL=reel3.html SEQ=seq3 NODE_PATH=/opt/node-tools/node_modules node render.js full | tail -1
ffmpeg -v error -y -framerate 30 -i ../seq3/%05d.jpg -i audio3.wav -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest "$2"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$2"
