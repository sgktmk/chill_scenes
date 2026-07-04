#!/usr/bin/env bash
# screenshot.sh — capture a scene with headless Chromium (no dependencies).
#
# Usage:
#   tools/screenshot.sh <url-or-html-file> <out.png> [WxH] [budget-ms]
#
# Examples:
#   tools/screenshot.sh rice-terrace.html shot.png                # default 960x600
#   tools/screenshot.sh "rice-terrace.html?t=0.3" shot.png 960x600 3000
#   tools/screenshot.sh "http://localhost:8000/seascape" shot.png
#
# Local files are served through a temporary http server rooted at the
# repo root (scenes load shared JS via root-absolute /shared/... paths,
# so plain file:// does not work).
#
# Scenes freeze their day-night phase with the ?t= URL param (see
# shared/cycle.js), so pass e.g. "?t=0.3" for reproducible captures.
# The virtual-time budget fast-forwards timers/rAF so animations settle
# before the shot is taken.
set -euo pipefail

if [ $# -lt 2 ]; then
  grep '^#' "$0" | sed 's/^# \{0,1\}//' | tail -n +2
  exit 1
fi

TARGET="$1"
OUT="$2"
SIZE="${3:-960x600}"
BUDGET="${4:-3000}"

# Find a Chromium binary
CHROME="${CHROMIUM_BIN:-}"
for cand in /opt/pw-browsers/chromium chromium chromium-browser google-chrome; do
  [ -n "$CHROME" ] && break
  if command -v "$cand" >/dev/null 2>&1; then CHROME="$cand"; fi
done
if [ -z "$CHROME" ]; then
  echo "error: no Chromium found (set CHROMIUM_BIN)" >&2
  exit 1
fi

SRV_PID=""
cleanup() { [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null || true; }
trap cleanup EXIT

# Local files → serve repo root over a temporary http server
if [[ "$TARGET" != http://* && "$TARGET" != https://* ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  PATH_PART="${TARGET%%\?*}"
  QUERY=""
  [[ "$TARGET" == *\?* ]] && QUERY="?${TARGET#*\?}"
  ABS="$(cd "$(dirname "$PATH_PART")" && pwd)/$(basename "$PATH_PART")"
  REL="${ABS#"$ROOT"/}"
  if [[ "$REL" == /* ]]; then
    echo "error: $ABS is outside the repo root $ROOT" >&2
    exit 1
  fi

  PORT=$(( (RANDOM % 2000) + 8100 ))
  python3 -m http.server "$PORT" --directory "$ROOT" --bind 127.0.0.1 >/dev/null 2>&1 &
  SRV_PID=$!
  for _ in $(seq 1 50); do
    curl --noproxy '*' -s -o /dev/null "http://127.0.0.1:$PORT/" && break
    sleep 0.1
  done
  TARGET="http://127.0.0.1:${PORT}/${REL}${QUERY}"
fi

"$CHROME" \
  --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size="${SIZE/x/,}" \
  --virtual-time-budget="$BUDGET" \
  --screenshot="$OUT" \
  "$TARGET" 2>/dev/null

echo "wrote $OUT (${SIZE}, ${BUDGET}ms budget, $TARGET)"
