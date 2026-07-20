#!/usr/bin/env node
/**
 * png2pixel — Convert a PNG image into PixelBuffer-compatible pixel data.
 *
 * Zero dependencies (PNG decode / quantization / RLE live in tools/lib/png.mjs).
 *
 * Pipeline:
 *   1. Decode PNG (colour types 0/2/3/4/6, bit depths 1/2/4/8/16, no interlace)
 *   2. Quantize opaque pixels to a limited palette (median cut, default 32)
 *   3. Downscale to the target resolution (dominant palette index per cell —
 *      preserves crisp edges, unlike box-filter averaging)
 *   4. Emit a JS snippet: { w, h, palette, data } with RLE-encoded indices
 *
 * The RLE format is decoded by PixelBuffer.decodeRLE (shared/pixel.js):
 *   each run is one letter (palette index: A-Z = 0-25, a-z = 26-51)
 *   followed by decimal digits (run length).
 *
 * Usage:
 *   node tools/png2pixel.mjs input.png [options]
 *
 * Options:
 *   -w <n>          target width  (default: source width, must be ≤ 512)
 *   -h <n>          target height (default: derived from aspect ratio)
 *   --colors <n>    max palette colours, 2-52 (default 32)
 *   --name <id>     JS constant name (default: derived from file name)
 *   --mask          mask mode: opaque pixels → 1, transparent → 0
 *                   (paint the mask on a transparent background)
 *   --palette <p>   quantize to a FIXED palette instead of median cut.
 *                   <p> is either a comma list ('none,#112233,#445566') or a
 *                   path to a JSON array of hex strings ('none' allowed at
 *                   index 0). Use this to convert extra sprite frames with
 *                   the same palette as an already-converted scene, so the
 *                   frames can be blitted / swapped without remapping.
 *   -o <file>       write output to file (default: stdout)
 *
 * Transparency: pixels with alpha < 128 map to palette entry 'none'
 * (reserved at index 0), matching the rice-terrace transparent-sky
 * convention.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  decodePNG, medianCut, nearestIndex, encodeRLE,
  downscaleIndices, parseHex, toHex,
} from './lib/png.mjs';

function parseArgs(argv) {
  const opts = { input: null, w: null, h: null, colors: 32, name: null, mask: false, palette: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-w') opts.w = parseInt(argv[++i], 10);
    else if (a === '-h') opts.h = parseInt(argv[++i], 10);
    else if (a === '--colors') opts.colors = parseInt(argv[++i], 10);
    else if (a === '--name') opts.name = argv[++i];
    else if (a === '--mask') opts.mask = true;
    else if (a === '--palette') opts.palette = argv[++i];
    else if (a === '-o') opts.out = argv[++i];
    else if (a === '--help') { opts.help = true; }
    else if (!a.startsWith('-') && !opts.input) opts.input = a;
    else throw new Error('unknown argument: ' + a);
  }
  return opts;
}

/** Parse --palette (comma list or JSON file) → { rgb: [[r,g,b],...], hex: ['#..',...], hasNone } */
function loadFixedPalette(spec) {
  let entries;
  if (spec.includes('#') || spec.split(',').every((s) => s.trim() === 'none' || /^[0-9a-fA-F]{6}$/.test(s.trim()))) {
    entries = spec.split(',').map((s) => s.trim());
  } else {
    entries = JSON.parse(readFileSync(spec, 'utf8'));
    if (!Array.isArray(entries)) throw new Error('--palette file must be a JSON array');
  }
  const hasNone = entries[0] === 'none';
  const hex = entries.filter((e) => e !== 'none');
  if (entries.slice(1).includes('none')) throw new Error("--palette: 'none' only allowed at index 0");
  return { rgb: hex.map(parseHex), hex: hex.map((c) => toHex(parseHex(c))), hasNone };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.input) {
    console.error('Usage: node tools/png2pixel.mjs input.png [-w N] [-h N] [--colors N] [--name ID] [--mask] [--palette LIST|file.json] [-o out.js]');
    process.exit(opts.help ? 0 : 1);
  }
  if (opts.colors < 2 || opts.colors > 52) throw new Error('--colors must be 2-52');

  const src = decodePNG(readFileSync(opts.input));

  // Resolve target size
  let tw = opts.w, th = opts.h;
  if (!tw && !th) {
    if (src.w > 512) {
      throw new Error(
        'source is ' + src.w + 'px wide — pass a target size, e.g. -w 320 -h 180 (or -w 240 -h 160 for GBA)');
    }
    tw = src.w; th = src.h;
  } else if (tw && !th) th = Math.round(src.h * tw / src.w);
  else if (th && !tw) tw = Math.round(src.w * th / src.h);

  const { w, h, R, G, B, A } = src;
  const n = w * h;

  // Per-source-pixel palette index (-1 = transparent)
  const srcIdx = new Int16Array(n);
  let palette; // array of [r,g,b]
  const fixed = opts.palette && !opts.mask ? loadFixedPalette(opts.palette) : null;

  if (opts.mask) {
    palette = [[255, 0, 255]]; // single "on" colour; index 0 in output is 'none'
    for (let i = 0; i < n; i++) srcIdx[i] = A[i] >= 128 ? 0 : -1;
  } else {
    if (fixed) {
      palette = fixed.rgb;
    } else {
      const opaque = [];
      for (let i = 0; i < n; i++) {
        if (A[i] >= 128) opaque.push((R[i] << 16) | (G[i] << 8) | B[i]);
      }
      const hasAlpha = opaque.length < n;
      const maxC = hasAlpha ? opts.colors - 1 : opts.colors; // reserve slot 0 for 'none'
      palette = medianCut(opaque, Math.max(1, maxC));
    }

    const cache = new Map();
    for (let i = 0; i < n; i++) {
      if (A[i] < 128) { srcIdx[i] = -1; continue; }
      const key = (R[i] << 16) | (G[i] << 8) | B[i];
      let idx = cache.get(key);
      if (idx === undefined) {
        idx = nearestIndex(R[i], G[i], B[i], palette);
        cache.set(key, idx);
      }
      srcIdx[i] = idx;
    }
  }

  // Downscale: dominant palette index per target cell
  const outIdx = downscaleIndices(srcIdx, w, h, tw, th);

  const used = new Set(outIdx);
  const hasTransparent = used.has(-1);
  let finalPalette;
  const finalIdx = new Uint8Array(tw * th);

  if (fixed) {
    // Fixed palette: keep the caller's ordering exactly (no drop/sort/remap),
    // so indices line up with the already-converted scene.
    if (hasTransparent && !fixed.hasNone) {
      throw new Error("image has transparency but --palette has no 'none' at index 0");
    }
    const shift = fixed.hasNone ? 1 : 0;
    finalPalette = (fixed.hasNone ? ['none'] : []).concat(fixed.hex);
    for (let i = 0; i < tw * th; i++) {
      finalIdx[i] = outIdx[i] < 0 ? 0 : outIdx[i] + shift;
    }
  } else {
    // Build final palette: drop unused entries, sort by luminance, remap.
    // Transparent pixels (or none at all) decide whether 'none' occupies slot 0.
    const kept = [...used].filter((v) => v >= 0);
    kept.sort((a, b) => {
      const lum = ([r, g, bl]) => 0.299 * r + 0.587 * g + 0.114 * bl;
      return lum(palette[a]) - lum(palette[b]);
    });

    const remap = new Map();
    finalPalette = [];
    if (hasTransparent) { finalPalette.push('none'); remap.set(-1, 0); }
    for (const old of kept) {
      remap.set(old, finalPalette.length);
      finalPalette.push(toHex(palette[old]));
    }
    for (let i = 0; i < tw * th; i++) finalIdx[i] = remap.get(outIdx[i]);
  }

  const rle = encodeRLE(finalIdx);

  // Emit JS snippet
  const name = opts.name
    || basename(opts.input).replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase() + '_IMG';
  const chunks = [];
  for (let i = 0; i < rle.length; i += 200) chunks.push(rle.slice(i, i + 200));

  const js =
    '// Generated by tools/png2pixel.mjs from ' + basename(opts.input)
    + ' (' + w + 'x' + h + ' -> ' + tw + 'x' + th + ', ' + finalPalette.length + ' colours'
    + (fixed ? ', fixed palette' : '') + ')\n'
    + 'const ' + name + ' = {\n'
    + '  w: ' + tw + ', h: ' + th + ',\n'
    + '  palette: [' + finalPalette.map((c) => "'" + c + "'").join(', ') + '],\n'
    + "  data: '" + chunks.join("'\n    + '") + "'\n"
    + '};\n';

  if (opts.out) {
    writeFileSync(opts.out, js);
    console.error('wrote ' + opts.out);
  } else {
    process.stdout.write(js);
  }
  console.error(
    'size ' + tw + 'x' + th + ', ' + finalPalette.length + ' colours'
    + (hasTransparent ? " (index 0 = 'none')" : '')
    + ', RLE ' + rle.length + ' chars');
}

main();
