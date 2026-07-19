/**
 * Shared PNG / palette toolkit for the tools/ scripts.
 *
 * Zero dependencies (node:zlib only). Extracted from tools/png2pixel.mjs so
 * that png2pixel.mjs and cutout.mjs share one implementation, plus a minimal
 * PNG *encoder* for writing verification previews.
 *
 * Exports:
 *   decodePNG(buf)                 → { w, h, R, G, B, A } (Uint8Arrays)
 *   encodePNG(w, h, rgba)          → Buffer (8-bit RGBA PNG)
 *   medianCut(pixels, maxColors)   → [[r,g,b], ...]
 *   nearestIndex(r, g, b, palette) → palette index
 *   encodeRLE(indices) / decodeRLE(str)
 *   downscaleIndices(srcIdx, w, h, tw, th) → Int16Array (dominant index/cell)
 *   parseHex('#rrggbb')            → [r, g, b]
 *   toHex([r, g, b])               → '#rrggbb'
 */

import { inflateSync, deflateSync } from 'node:zlib';

/* ================= PNG decoding ================= */

export function decodePNG(buf) {
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

/* ================= PNG encoding (8-bit RGBA, no filter) ================= */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * Encode an 8-bit RGBA image as a PNG buffer.
 * @param {number} w
 * @param {number} h
 * @param {Uint8Array|Buffer} rgba — length w*h*4
 */
export function encodePNG(w, h, rgba) {
  if (rgba.length !== w * h * 4) throw new Error('rgba length must be w*h*4');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  // compression 0, filter 0, interlace 0 already zeroed

  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    // filter byte 0 already zeroed
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4)
      .copy(raw, y * (1 + w * 4) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ================= Median-cut quantization ================= */

export function medianCut(pixels, maxColors) {
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

export function nearestIndex(r, g, b, palette) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const d = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/* ================= RLE (PixelBuffer.decodeRLE format) ================= */

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function encodeRLE(indices) {
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

export function decodeRLE(str) {
  const out = [];
  let i = 0;
  while (i < str.length) {
    const ch = str.charCodeAt(i++);
    const idx = ch >= 97 ? ch - 97 + 26 : ch - 65; // a-z | A-Z
    let run = 0;
    while (i < str.length && str[i] >= '0' && str[i] <= '9') {
      run = run * 10 + (str.charCodeAt(i++) - 48);
    }
    for (let k = 0; k < run; k++) out.push(idx);
  }
  return Uint8Array.from(out);
}

/* ================= Downscale (dominant index per cell) ================= */

/**
 * Downscale a palette-index image by picking the dominant index per target
 * cell — preserves crisp pixel-art edges, unlike box-filter averaging.
 * @param {Int16Array|Uint8Array} srcIdx — source indices (-1 = transparent)
 * @returns {Int16Array}
 */
export function downscaleIndices(srcIdx, w, h, tw, th) {
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

/* ================= Colour helpers ================= */

export function parseHex(s) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(s.trim());
  if (!m) throw new Error('bad hex colour: ' + s);
  const v = parseInt(m[1], 16);
  return [v >> 16, (v >> 8) & 0xff, v & 0xff];
}

export function toHex([r, g, b]) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
