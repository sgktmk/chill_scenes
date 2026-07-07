#!/usr/bin/env node
/**
 * png2pixel — Convert a PNG image into PixelBuffer-compatible pixel data.
 *
 * Zero dependencies (uses only node:zlib and node:fs).
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
 *   node tools/png2pixel.mjs input.png [options]           # single image
 *   node tools/png2pixel.mjs --manifest refs/<scene>/layers.json [options]
 *
 * Options (single-image mode):
 *   -w <n>          target width  (default: source width, must be ≤ 512)
 *   -h <n>          target height (default: derived from aspect ratio)
 *   --colors <n>    max palette colours, 2-52 (default 32)
 *   --name <id>     JS constant name (default: derived from file name)
 *   --mask          mask mode: opaque pixels → 1, transparent → 0
 *                   (paint the mask on a transparent background)
 *   -o <file>       write output to file (default: stdout)
 *
 * Options (manifest mode):
 *   --manifest <f>  convert every layer listed in a layers.json manifest
 *                   into ONE JS object with a single shared palette:
 *                   { w, h, palette, layers: [{ id, role, x, y, w, h,
 *                     data, pivot?, anchor?, motion? }, ...] }
 *                   Layer order in the manifest = paint order (first is
 *                   painted at the back). Mask cutouts automatically
 *                   punch holes in the un-masked layer of the same src,
 *                   so occlusion (door sliding behind a wall, scenery
 *                   behind a window frame) works by paint order alone.
 *                   Render with PixelBuffer.sceneToSVG (shared/pixel.js).
 *   --colors / --name / -o also apply (manifest may set name/colors too).
 *
 * Manifest format: see docs/scene-workflow.md and refs/_fixture-train/.
 *
 * Transparency: pixels with alpha < 128 map to palette entry 'none'
 * (reserved at index 0), matching the rice-terrace transparent-sky
 * convention. In manifest mode 'none' is always reserved.
 */

import { inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

/* ================= PNG decoding ================= */

function decodePNG(buf) {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIG[i]) throw new Error('not a PNG file');
  }

  let pos = 8;
  let ihdr = null;
  let plte = null;
  let trns = null;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0),
        h: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  if (!ihdr) throw new Error('missing IHDR chunk');
  if (ihdr.interlace !== 0) {
    throw new Error('interlaced (Adam7) PNG not supported — re-save without interlacing');
  }
  const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const ch = CHANNELS[ihdr.colorType];
  if (!ch) throw new Error('unsupported colour type ' + ihdr.colorType);
  if (![1, 2, 4, 8, 16].includes(ihdr.depth)) {
    throw new Error('unsupported bit depth ' + ihdr.depth);
  }
  if (ihdr.depth < 8 && ihdr.colorType !== 0 && ihdr.colorType !== 3) {
    throw new Error('bit depth ' + ihdr.depth + ' only valid for grayscale/indexed');
  }

  const raw = inflateSync(Buffer.concat(idat));
  const { w, h, depth, colorType } = ihdr;
  const rowBits = w * ch * depth;
  const rowBytes = Math.ceil(rowBits / 8);
  const bpp = Math.max(1, (ch * depth) >> 3); // filter step in bytes

  // Unfilter scanlines in place into `img`
  const img = Buffer.alloc(rowBytes * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (rowBytes + 1)];
    const rowIn = raw.subarray(y * (rowBytes + 1) + 1, y * (rowBytes + 1) + 1 + rowBytes);
    const out = y * rowBytes;
    const prev = (y - 1) * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const rawB = rowIn[x];
      const a = x >= bpp ? img[out + x - bpp] : 0;         // left
      const b = y > 0 ? img[prev + x] : 0;                 // up
      const c = y > 0 && x >= bpp ? img[prev + x - bpp] : 0; // up-left
      let v;
      switch (filter) {
        case 0: v = rawB; break;
        case 1: v = rawB + a; break;
        case 2: v = rawB + b; break;
        case 3: v = rawB + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = rawB + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error('bad filter type ' + filter + ' at row ' + y);
      }
      img[out + x] = v & 0xff;
    }
  }

  // Extract per-pixel samples (depth < 8 → unpack bits; depth 16 → high byte)
  const readSamples = (y) => {
    const base = y * rowBytes;
    const samples = new Array(w * ch);
    if (depth === 8) {
      for (let i = 0; i < w * ch; i++) samples[i] = img[base + i];
    } else if (depth === 16) {
      for (let i = 0; i < w * ch; i++) samples[i] = img[base + i * 2];
    } else {
      const per = 8 / depth;
      const max = (1 << depth) - 1;
      for (let i = 0; i < w * ch; i++) {
        const byte = img[base + Math.floor(i / per)];
        const shift = 8 - depth * ((i % per) + 1);
        samples[i] = (byte >> shift) & max;
      }
    }
    return samples;
  };

  // Produce RGBA arrays
  const R = new Uint8Array(w * h), G = new Uint8Array(w * h),
        B = new Uint8Array(w * h), A = new Uint8Array(w * h);
  const grayMax = (1 << Math.min(depth, 8)) - 1;

  for (let y = 0; y < h; y++) {
    const s = readSamples(y);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      switch (colorType) {
        case 0: { // grayscale
          const g = Math.round(s[x] * 255 / grayMax);
          R[i] = G[i] = B[i] = g; A[i] = 255;
          break;
        }
        case 2: // RGB
          R[i] = s[x * 3]; G[i] = s[x * 3 + 1]; B[i] = s[x * 3 + 2]; A[i] = 255;
          break;
        case 3: { // indexed
          const p = s[x];
          if (!plte || p * 3 + 2 >= plte.length) throw new Error('palette index out of range');
          R[i] = plte[p * 3]; G[i] = plte[p * 3 + 1]; B[i] = plte[p * 3 + 2];
          A[i] = trns && p < trns.length ? trns[p] : 255;
          break;
        }
        case 4: { // gray + alpha
          const g = Math.round(s[x * 2] * 255 / grayMax);
          R[i] = G[i] = B[i] = g; A[i] = s[x * 2 + 1];
          break;
        }
        case 6: // RGBA
          R[i] = s[x * 4]; G[i] = s[x * 4 + 1]; B[i] = s[x * 4 + 2]; A[i] = s[x * 4 + 3];
          break;
      }
    }
  }

  return { w, h, R, G, B, A };
}

/* ================= Median-cut quantization ================= */

function medianCut(pixels, maxColors) {
  // pixels: array of packed 0xRRGGBB ints (opaque pixels only)
  if (pixels.length === 0) return [];

  const boxes = [pixels];
  while (boxes.length < maxColors) {
    // Pick the box with the largest channel range
    let bestBox = -1, bestRange = 0, bestCh = 0;
    for (let bi = 0; bi < boxes.length; bi++) {
      const box = boxes[bi];
      if (box.length < 2) continue;
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const p of box) {
        const r = p >> 16, g = (p >> 8) & 0xff, b = p & 0xff;
        if (r < rMin) rMin = r; if (r > rMax) rMax = r;
        if (g < gMin) gMin = g; if (g > gMax) gMax = g;
        if (b < bMin) bMin = b; if (b > bMax) bMax = b;
      }
      const ranges = [rMax - rMin, gMax - gMin, bMax - bMin];
      const ch = ranges.indexOf(Math.max(...ranges));
      if (ranges[ch] > bestRange) { bestRange = ranges[ch]; bestBox = bi; bestCh = ch; }
    }
    if (bestBox < 0 || bestRange === 0) break; // nothing left to split

    const box = boxes[bestBox];
    const shift = bestCh === 0 ? 16 : bestCh === 1 ? 8 : 0;
    box.sort((a, b) => ((a >> shift) & 0xff) - ((b >> shift) & 0xff));
    const mid = box.length >> 1;
    boxes.splice(bestBox, 1, box.slice(0, mid), box.slice(mid));
  }

  // Average colour of each box
  return boxes.map((box) => {
    let r = 0, g = 0, b = 0;
    for (const p of box) { r += p >> 16; g += (p >> 8) & 0xff; b += p & 0xff; }
    const n = box.length;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function nearestIndex(r, g, b, palette) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const d = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/* ================= RLE encoding ================= */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function encodeRLE(indices) {
  let out = '';
  let i = 0;
  while (i < indices.length) {
    const c = indices[i];
    let run = 1;
    while (i + run < indices.length && indices[i + run] === c) run++;
    if (c >= ALPHABET.length) throw new Error('palette index ' + c + ' exceeds RLE alphabet');
    out += ALPHABET[c] + run;
    i += run;
  }
  return out;
}

/* ================= Shared helpers ================= */

// Downscale a per-pixel index map (-1 = transparent) to tw×th by taking
// the dominant index per target cell — preserves crisp edges.
function downscaleDominant(srcIdx, w, h, tw, th) {
  const outIdx = new Int16Array(tw * th);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor(ty * h / th), y1 = Math.max(y0 + 1, Math.floor((ty + 1) * h / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor(tx * w / tw), x1 = Math.max(x0 + 1, Math.floor((tx + 1) * w / tw));
      const counts = new Map();
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = srcIdx[y * w + x];
          counts.set(v, (counts.get(v) || 0) + 1);
        }
      }
      let best = -1, bestC = -1;
      for (const [v, c] of counts) if (c > bestC) { bestC = c; best = v; }
      outIdx[ty * tw + tx] = best;
    }
  }
  return outIdx;
}

function toHex(r, g, b) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function chunkString(s, n) {
  const chunks = [];
  for (let i = 0; i < s.length; i += n) chunks.push(s.slice(i, i + n));
  return chunks;
}

/* ================= Main ================= */

function parseArgs(argv) {
  const opts = { input: null, w: null, h: null, colors: null, name: null, mask: false, out: null, manifest: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-w') opts.w = parseInt(argv[++i], 10);
    else if (a === '-h') opts.h = parseInt(argv[++i], 10);
    else if (a === '--colors') opts.colors = parseInt(argv[++i], 10);
    else if (a === '--name') opts.name = argv[++i];
    else if (a === '--mask') opts.mask = true;
    else if (a === '--manifest') opts.manifest = argv[++i];
    else if (a === '-o') opts.out = argv[++i];
    else if (a === '--help') { opts.help = true; }
    else if (!a.startsWith('-') && !opts.input) opts.input = a;
    else throw new Error('unknown argument: ' + a);
  }
  return opts;
}

/* ================= Manifest (layered) mode ================= */

/**
 * Convert every layer in a layers.json manifest into one JS object with a
 * single shared palette, so all layers compose without index remapping.
 *
 * Manifest layer kinds:
 *   { id, role: 'background' }                    — empty dynamic group
 *   { id, role, src }                             — full-frame PNG, downscaled
 *   { id, role, src, mask }                       — cutout: pixels of src under
 *       the mask become this layer; the un-masked layer sharing the same src
 *       gets a transparent hole there (paint-order occlusion)
 *   { id, role, src, at: [x,y] }                  — part sprite, converted 1:1
 *       at target scale and placed at (x,y)
 *
 * Passthrough fields kept in the output: role, motion, pivot, anchor.
 */
function runManifest(opts) {
  const manifestPath = opts.manifest;
  const mfDir = dirname(resolve(manifestPath));
  const mf = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (!mf.resolution || !Number.isInteger(mf.resolution.w) || !Number.isInteger(mf.resolution.h)) {
    throw new Error('manifest: "resolution": { "w": N, "h": N } is required');
  }
  const tw = mf.resolution.w, th = mf.resolution.h;
  if (tw < 8 || tw > 512 || th < 8 || th > 512) throw new Error('manifest: resolution must be 8-512');
  if (!Array.isArray(mf.layers) || mf.layers.length === 0) {
    throw new Error('manifest: "layers" must be a non-empty array (back to front)');
  }
  const colors = opts.colors ?? mf.colors ?? 32;
  if (colors < 2 || colors > 52) throw new Error('colors must be 2-52');

  // ---- decode every distinct PNG once ----
  const pngCache = new Map(); // filename -> decoded {w,h,R,G,B,A}
  const loadPNG = (f) => {
    if (!pngCache.has(f)) pngCache.set(f, decodePNG(readFileSync(resolve(mfDir, f))));
    return pngCache.get(f);
  };
  for (const L of mf.layers) {
    if (!L.id || !/^[a-z][a-z0-9-]*$/.test(L.id)) {
      throw new Error('manifest: every layer needs an id matching [a-z][a-z0-9-]* (got ' + JSON.stringify(L.id) + ')');
    }
    if (L.role === 'background') {
      if (L.src) throw new Error('layer ' + L.id + ': background layers must not have src');
      continue;
    }
    if (!L.src) throw new Error('layer ' + L.id + ': src is required (or role: "background")');
    if (L.mask && L.at) throw new Error('layer ' + L.id + ': mask is only supported on full-frame layers (no "at")');
    loadPNG(L.src);
    if (L.mask) {
      const m = loadPNG(L.mask);
      const s = pngCache.get(L.src);
      if (m.w !== s.w || m.h !== s.h) {
        throw new Error('layer ' + L.id + ': mask ' + L.mask + ' is ' + m.w + 'x' + m.h
          + ' but src ' + L.src + ' is ' + s.w + 'x' + s.h + ' — masks must match their src exactly');
      }
    }
  }

  // ---- one global palette from ALL src pixels (masks are not colour sources) ----
  const srcFiles = [...new Set(mf.layers.filter((L) => L.src).map((L) => L.src))];
  const maskFiles = new Set(mf.layers.filter((L) => L.mask).map((L) => L.mask));
  const opaque = [];
  for (const f of srcFiles) {
    const img = pngCache.get(f);
    for (let i = 0; i < img.w * img.h; i++) {
      if (img.A[i] >= 128) opaque.push((img.R[i] << 16) | (img.G[i] << 8) | img.B[i]);
    }
  }
  // 'none' is always reserved at index 0 in layered mode (cutouts create holes)
  const palette = medianCut(opaque, Math.max(1, colors - 1));

  // ---- per-src index map at target resolution ----
  const srcMaps = new Map(); // filename -> Int16Array(tw*th), -1 = transparent
  for (const f of srcFiles) {
    const img = pngCache.get(f);
    const isPart = mf.layers.some((L) => L.src === f && L.at);
    const isFull = mf.layers.some((L) => L.src === f && !L.at);
    if (isPart && isFull) throw new Error(f + ' is used both as a full-frame src and a part ("at") src');

    const n = img.w * img.h;
    const idx = new Int16Array(n);
    const cache = new Map();
    for (let i = 0; i < n; i++) {
      if (img.A[i] < 128) { idx[i] = -1; continue; }
      const key = (img.R[i] << 16) | (img.G[i] << 8) | img.B[i];
      let v = cache.get(key);
      if (v === undefined) { v = nearestIndex(img.R[i], img.G[i], img.B[i], palette); cache.set(key, v); }
      idx[i] = v;
    }
    if (isPart) {
      // Part sprites are authored at target scale and converted 1:1.
      // Width may exceed the frame (scroll strips), so no size clamp here.
      srcMaps.set(f, { idx, w: img.w, h: img.h });
    } else {
      srcMaps.set(f, { idx: downscaleDominant(idx, img.w, img.h, tw, th), w: tw, h: th });
    }
  }

  // ---- masks at target resolution ----
  const maskMaps = new Map(); // filename -> Uint8Array(tw*th)
  for (const f of maskFiles) {
    const img = pngCache.get(f);
    const n = img.w * img.h;
    const bin = new Int16Array(n);
    for (let i = 0; i < n; i++) bin[i] = img.A[i] >= 128 ? 1 : -1;
    const scaled = downscaleDominant(bin, img.w, img.h, tw, th);
    const out = new Uint8Array(tw * th);
    for (let i = 0; i < tw * th; i++) out[i] = scaled[i] === 1 ? 1 : 0;
    maskMaps.set(f, out);
  }

  // ---- build each layer's pixel map (cutouts punch holes in plain layers) ----
  const cutBySrc = new Map(); // src filename -> Uint8Array(tw*th) union of masks
  for (const L of mf.layers) {
    if (!L.mask) continue;
    let cut = cutBySrc.get(L.src);
    if (!cut) { cut = new Uint8Array(tw * th); cutBySrc.set(L.src, cut); }
    const m = maskMaps.get(L.mask);
    for (let i = 0; i < tw * th; i++) if (m[i]) cut[i] = 1;
  }

  const layerMaps = []; // { L, map: Int16Array, w, h, ox, oy } | { L } for background
  for (const L of mf.layers) {
    if (L.role === 'background') { layerMaps.push({ L }); continue; }
    const sm = srcMaps.get(L.src);
    let map;
    if (L.mask) {
      const m = maskMaps.get(L.mask);
      map = new Int16Array(tw * th).fill(-1);
      for (let i = 0; i < tw * th; i++) if (m[i]) map[i] = sm.idx[i];
      layerMaps.push({ L, map, w: tw, h: th, ox: 0, oy: 0 });
    } else if (L.at) {
      layerMaps.push({ L, map: sm.idx, w: sm.w, h: sm.h, ox: L.at[0], oy: L.at[1] });
    } else {
      const cut = cutBySrc.get(L.src);
      if (cut) {
        map = Int16Array.from(sm.idx);
        for (let i = 0; i < tw * th; i++) if (cut[i]) map[i] = -1;
      } else {
        map = sm.idx;
      }
      layerMaps.push({ L, map, w: tw, h: th, ox: 0, oy: 0 });
    }
  }

  // ---- shared final palette: used indices across all layers, luminance-sorted ----
  const used = new Set();
  for (const lm of layerMaps) {
    if (!lm.map) continue;
    for (const v of lm.map) if (v >= 0) used.add(v);
  }
  const kept = [...used].sort((a, b) => {
    const lum = ([r, g, bl]) => 0.299 * r + 0.587 * g + 0.114 * bl;
    return lum(palette[a]) - lum(palette[b]);
  });
  const remap = new Map([[-1, 0]]);
  const finalPalette = ['none'];
  for (const old of kept) {
    remap.set(old, finalPalette.length);
    finalPalette.push(toHex(...palette[old]));
  }

  // ---- crop each layer to its bounding box and RLE-encode ----
  const outLayers = [];
  for (const lm of layerMaps) {
    const L = lm.L;
    const entry = { id: L.id };
    for (const k of ['role', 'motion', 'pivot', 'anchor']) if (L[k] !== undefined) entry[k] = L[k];
    if (!lm.map) { outLayers.push(entry); continue; }

    let x0 = lm.w, y0 = lm.h, x1 = -1, y1 = -1;
    for (let y = 0; y < lm.h; y++) {
      for (let x = 0; x < lm.w; x++) {
        if (lm.map[y * lm.w + x] >= 0) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) {
      throw new Error('layer ' + L.id + ' has no visible pixels after conversion'
        + (L.mask ? ' — check that ' + L.mask + ' actually covers opaque pixels of ' + L.src : ''));
    }
    const cw = x1 - x0 + 1, chh = y1 - y0 + 1;
    const cropped = new Uint8Array(cw * chh);
    for (let y = 0; y < chh; y++) {
      for (let x = 0; x < cw; x++) {
        cropped[y * cw + x] = remap.get(lm.map[(y0 + y) * lm.w + (x0 + x)]) ?? 0;
      }
    }
    entry.x = lm.ox + x0; entry.y = lm.oy + y0; entry.w = cw; entry.h = chh;
    entry.data = encodeRLE(cropped);
    outLayers.push(entry);
  }

  // ---- emit ----
  const name = opts.name || mf.name
    || basename(mfDir).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase() + '_SCENE';
  let js = '// Generated by tools/png2pixel.mjs --manifest from ' + basename(mfDir) + '/'
    + ' (' + tw + 'x' + th + ', ' + finalPalette.length + ' colours, '
    + outLayers.length + ' layers)\n'
    + '// Layer order = paint order (first is the back). Render with\n'
    + '// PixelBuffer.sceneToSVG(svgEl, ' + name + ') — see shared/pixel.js.\n'
    + 'const ' + name + ' = {\n'
    + '  w: ' + tw + ', h: ' + th + ',\n'
    + '  palette: [' + finalPalette.map((c) => "'" + c + "'").join(', ') + '],\n'
    + '  layers: [\n';
  for (const e of outLayers) {
    js += '    { id: ' + JSON.stringify(e.id);
    for (const k of ['role', 'motion']) if (e[k] !== undefined) js += ', ' + k + ': ' + JSON.stringify(e[k]);
    for (const k of ['x', 'y', 'w', 'h']) if (e[k] !== undefined) js += ', ' + k + ': ' + e[k];
    for (const k of ['pivot', 'anchor']) if (e[k] !== undefined) js += ', ' + k + ': ' + JSON.stringify(e[k]);
    if (e.data !== undefined) {
      js += ',\n      data: ' + chunkString(e.data, 190).map((c) => "'" + c + "'").join('\n        + ');
    }
    js += ' },\n';
  }
  js += '  ]\n};\n';

  if (opts.out) {
    writeFileSync(opts.out, js);
    console.error('wrote ' + opts.out);
  } else {
    process.stdout.write(js);
  }
  for (const e of outLayers) {
    console.error('  layer ' + e.id.padEnd(12) + (e.data
      ? 'at (' + e.x + ',' + e.y + ') ' + e.w + 'x' + e.h + ', RLE ' + e.data.length + ' chars'
      : '(background — empty dynamic group)'));
  }
  console.error('scene ' + tw + 'x' + th + ', ' + finalPalette.length + " colours (index 0 = 'none')");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.input && !opts.manifest)) {
    console.error('Usage: node tools/png2pixel.mjs input.png [-w N] [-h N] [--colors N] [--name ID] [--mask] [-o out.js]');
    console.error('       node tools/png2pixel.mjs --manifest refs/<scene>/layers.json [--colors N] [--name ID] [-o out.js]');
    process.exit(opts.help ? 0 : 1);
  }
  if (opts.manifest) {
    if (opts.input || opts.mask || opts.w || opts.h) {
      throw new Error('--manifest cannot be combined with an input file, --mask, -w or -h');
    }
    runManifest(opts);
    return;
  }
  if (opts.colors === null) opts.colors = 32;
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

  if (opts.mask) {
    palette = [[255, 0, 255]]; // single "on" colour; index 0 in output is 'none'
    for (let i = 0; i < n; i++) srcIdx[i] = A[i] >= 128 ? 0 : -1;
  } else {
    const opaque = [];
    for (let i = 0; i < n; i++) {
      if (A[i] >= 128) opaque.push((R[i] << 16) | (G[i] << 8) | B[i]);
    }
    const hasAlpha = opaque.length < n;
    const maxC = hasAlpha ? opts.colors - 1 : opts.colors; // reserve slot 0 for 'none'
    palette = medianCut(opaque, Math.max(1, maxC));

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
  const outIdx = downscaleDominant(srcIdx, w, h, tw, th);

  // Build final palette: drop unused entries, sort by luminance, remap.
  // Transparent pixels (or none at all) decide whether 'none' occupies slot 0.
  const used = new Set(outIdx);
  const hasTransparent = used.has(-1);
  const kept = [...used].filter((v) => v >= 0);
  kept.sort((a, b) => {
    const lum = ([r, g, bl]) => 0.299 * r + 0.587 * g + 0.114 * bl;
    return lum(palette[a]) - lum(palette[b]);
  });

  const remap = new Map();
  const finalPalette = [];
  if (hasTransparent) { finalPalette.push('none'); remap.set(-1, 0); }
  for (const old of kept) {
    remap.set(old, finalPalette.length);
    const [r, g, b] = palette[old];
    finalPalette.push(toHex(r, g, b));
  }

  const finalIdx = new Uint8Array(tw * th);
  for (let i = 0; i < tw * th; i++) finalIdx[i] = remap.get(outIdx[i]);

  const rle = encodeRLE(finalIdx);

  // Emit JS snippet
  const name = opts.name
    || basename(opts.input).replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase() + '_IMG';
  const chunks = [];
  for (let i = 0; i < rle.length; i += 200) chunks.push(rle.slice(i, i + 200));

  const js =
    '// Generated by tools/png2pixel.mjs from ' + basename(opts.input)
    + ' (' + w + 'x' + h + ' -> ' + tw + 'x' + th + ', ' + finalPalette.length + ' colours)\n'
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
