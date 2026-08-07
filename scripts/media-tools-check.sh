#!/usr/bin/env sh
set -eu

missing=""
for tool in ffmpeg ffprobe exiftool magick clamscan ocrmypdf python; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing="$missing $tool"
  fi
done

if [ -n "$missing" ]; then
  printf 'media-tools: deferred - missing:%s\n' "$missing"
  exit 3
fi

echo 'media-tools: ok'
