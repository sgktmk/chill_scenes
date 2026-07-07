#!/usr/bin/env node
/**
 * make-fixture — regenerate the _fixture-train reference PNGs.
 *
 * This fixture is the living example for the layered image-to-scene
 * pipeline (layers.json + masks + part sprites). It draws, procedurally,
 * exactly what a human would normally paint by hand:
 *
 *   base.png       120x80 tram interior; the window aperture is transparent
 *                  (dynamic layers show through), the door is painted in
 *                  (it gets cut out via mask-door.png)
 *   mask-door.png  the door region, opaque on transparent background
 *   part-strap.png 11x24 hanging strap sprite (transparent background)
 *   scenery.png    240x80 scroll strip, pattern repeats every 120px
 *
 * Run from the repo root:
 *   node refs/_fixture-train/make-fixture.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));

/* ---- minimal PNG writer (RGBA8, no filter) ---- */

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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function writePNG(path, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.error('wrote ' + path + ' (' + w + 'x' + h + ')');
}

/* ---- drawing helpers ---- */

function canvas(w, h) {
  const buf = Buffer.alloc(w * h * 4); // all transparent
  const px = (x, y, [r, g, b]) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  };
  const clearPx = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    buf[(y * w + x) * 4 + 3] = 0;
  };
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, c);
  };
  const clearRect = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) clearPx(x, y);
  };
  return { buf, px, rect, clearRect };
}

/* ---- base.png : tram interior 120x80 ---- */
{
  const { buf, rect, clearRect } = canvas(120, 80);
  const WALL = [200, 190, 172], CEIL = [178, 170, 154], RAIL = [104, 104, 112];
  const FLOOR = [124, 108, 94], FLOORE = [96, 82, 72], FRAME = [90, 86, 82];
  const DOOR = [152, 160, 172], DOORB = [90, 96, 108], GLASS = [180, 198, 212];
  const GLASSF = [110, 118, 130], HANDLE = [70, 74, 84], SEAM = [184, 174, 156];

  rect(0, 0, 119, 11, CEIL);          // ceiling
  rect(0, 12, 119, 65, WALL);         // wall
  rect(4, 8, 115, 9, RAIL);           // strap rail
  rect(0, 66, 119, 79, FLOOR);        // floor
  rect(0, 66, 119, 66, FLOORE);
  rect(6, 12, 6, 65, SEAM);           // panel seams
  rect(70, 12, 70, 65, SEAM);

  // window: frame + transparent aperture (dynamic layers show through)
  rect(12, 12, 51, 47, FRAME);
  clearRect(14, 14, 49, 45);

  // door (cut out later by mask-door.png)
  rect(78, 12, 107, 72, DOOR);
  rect(78, 12, 107, 12, DOORB); rect(78, 72, 107, 72, DOORB);
  rect(78, 12, 78, 72, DOORB); rect(107, 12, 107, 72, DOORB);
  rect(83, 17, 102, 35, GLASSF);      // door glass frame
  rect(84, 18, 101, 34, GLASS);
  rect(80, 40, 81, 48, HANDLE);       // handle bar
  writePNG(join(OUT, 'base.png'), 120, 80, buf);
}

/* ---- mask-door.png : exactly the painted door region ---- */
{
  const { buf, rect } = canvas(120, 80);
  rect(78, 12, 107, 72, [255, 0, 255]);
  writePNG(join(OUT, 'mask-door.png'), 120, 80, buf);
}

/* ---- part-strap.png : 11x24 hanging strap ---- */
{
  const W = 11, H = 24;
  const { buf, px, rect } = canvas(W, H);
  const STRAP = [232, 230, 224], EDGE = [176, 172, 162];
  rect(5, 0, 6, 12, STRAP);           // band
  rect(4, 0, 4, 1, EDGE);             // rail clip
  rect(7, 0, 7, 1, EDGE);
  const cx = 5.5, cy = 17.5;          // handle ring
  for (let y = 12; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= 3.2 && d <= 5.4) px(x, y, d > 4.9 ? EDGE : STRAP);
    }
  }
  writePNG(join(OUT, 'part-strap.png'), W, H, buf);
}

/* ---- scenery.png : 240x80 scroll strip, period 120 ---- */
{
  const W = 240, H = 80;
  const { buf, px, rect } = canvas(W, H);
  const SKY = [150, 202, 235], CLOUD = [240, 248, 252];
  const HILL = [96, 142, 92], GROUND = [120, 168, 96], GEDGE = [96, 142, 76];
  const POLE = [94, 74, 58];

  rect(0, 0, W - 1, 47, SKY);
  // clouds — repeat every 120px so the strip tiles seamlessly
  for (const ox of [0, 120]) {
    rect(ox + 20, 8, ox + 40, 12, CLOUD);
    rect(ox + 26, 6, ox + 34, 7, CLOUD);
    rect(ox + 78, 16, ox + 92, 19, CLOUD);
  }
  // hills — sine with period 60 (divides 120)
  for (let x = 0; x < W; x++) {
    const top = Math.round(40 + 5 * Math.sin((x * Math.PI * 2) / 60));
    for (let y = top; y <= 47; y++) px(x, y, HILL);
  }
  rect(0, 48, W - 1, 79, GROUND);
  rect(0, 48, W - 1, 49, GEDGE);
  // telephone poles every 40px
  for (let ox = 8; ox < W; ox += 40) {
    rect(ox, 18, ox + 1, 48, POLE);
    rect(ox - 4, 20, ox + 5, 21, POLE);
  }
  writePNG(join(OUT, 'scenery.png'), W, H, buf);
}
