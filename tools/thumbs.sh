#!/usr/bin/env bash
# thumbs.sh — regenerate landing-page thumbnails from the REAL scenes.
#
# Each scene is captured headlessly at 3x its native resolution with the
# UI hidden (?ui=0, see shared/scene-ui.js), then downscaled back to
# native pixels (nearest) into assets/thumbs/<scene>.png. The landing
# page shows these with object-fit: cover + image-rendering: pixelated,
# so thumbnails are true crops of the scenes — never redrawn by hand.
#
# The scene is loaded inside a fixed-pixel-size iframe: headless
# Chromium's layout viewport is smaller than --window-size, so vw-based
# scene wrappers don't fill the window exactly — an iframe with a fixed
# CSS size gives the scene an exact viewport regardless.
#
# Usage:  tools/thumbs.sh          # all scenes
#         tools/thumbs.sh seascape # one scene
#
# When adding a scene, append a line to the SCENES list below and run
# this script. ?t= freezes day-night scenes at a representative phase.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/assets/thumbs"
mkdir -p "$OUT"

# name | url (relative, with params) | native WxH
SCENES="
seascape|seascape.html?ui=0|320x200
campfire|campfire.html?ui=0|426x240
snowy-forest|snowy-forest.html?ui=0|320x180
rice-terrace|rice-terrace.html?t=0.3&ui=0|240x160
chill-mart|chill-mart.html?ui=0|256x192
"

ONLY="${1:-}"
CAP="$ROOT/.thumb-capture.html"
trap 'rm -f "$CAP"' EXIT

echo "$SCENES" | while IFS='|' read -r name url size; do
  [ -z "$name" ] && continue
  [ -n "$ONLY" ] && [ "$name" != "$ONLY" ] && continue
  W="${size%x*}"; H="${size#*x}"
  CW=$((W * 3)); CH=$((H * 3))
  cat > "$CAP" <<EOF
<!DOCTYPE html><html><head><style>*{margin:0;padding:0}iframe{display:block;border:0;width:${CW}px;height:${CH}px}</style></head>
<body><iframe src="/${url}"></iframe></body></html>
EOF
  TMP="$(mktemp /tmp/thumb-XXXXXX.png)"
  # window gets 1.5x slack: the layout viewport must still contain the iframe
  "$ROOT/tools/screenshot.sh" "$CAP" "$TMP" "$((CW * 3 / 2))x$((CH * 3 / 2))" 3000 >/dev/null
  node --input-type=module -e "
    import { readFileSync, writeFileSync } from 'node:fs';
    import { decodePNG, encodePNG } from '$ROOT/tools/lib/png.mjs';
    const img = decodePNG(readFileSync('$TMP'));
    const W = $W, H = $H, F = 3;
    const rgba = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * F + 1) * img.w + x * F + 1, o = (y * W + x) * 4;
        rgba[o] = img.R[i]; rgba[o + 1] = img.G[i]; rgba[o + 2] = img.B[i]; rgba[o + 3] = 255;
      }
    }
    writeFileSync('$OUT/$name.png', encodePNG(W, H, rgba));
  "
  rm -f "$TMP"
  echo "wrote assets/thumbs/$name.png (${W}x${H})"
done
