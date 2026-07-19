#!/usr/bin/env node
/**
 * cutout — Split a scene's reference material into a background + moving
 * parts (sprites) that share ONE unified palette, so motion can be
 * implemented structurally (real layers that move/swap/hide) instead of
 * faking it by nudging pixels of a flat image.
 *
 * Zero dependencies (PNG/quantization code lives in tools/lib/png.mjs).
 *
 * Input convention — refs/<scene>/ :
 *   base.png            REQUIRED  full composition, every part in its
 *                                 default ("base") state
 *   bg.png              optional  the background with moving parts removed;
 *                                 if absent, part regions are cut out of
 *                                 base.png and inpainted automatically
 *   parts/NN-name.png   optional  one moving part per file, SAME canvas size
 *                                 as base.png, transparent everywhere except
 *                                 the part drawn at its in-scene position.
 *                                 NN (number prefix) = z-order, low = far.
 *   parts/NN-name@state.png       extra states of a part (door open, wings
 *                                 up, ...) — become switchable frames
 *   mask-name.png       optional  fallback when no part image exists: opaque
 *                                 pixels mark a region to cut out of base.png
 *                                 (the cut pixels become the part's sprite)
 *
 * Output: one JS file defining
 *   <NAME>_PALETTE  — unified palette, index 0 = 'none' (transparent)
 *   <NAME>_BG       — { w, h, palette, data }  (PixelBuffer.fromImage-ready)
 *   <NAME>_PARTS    — { partName: { z, states: { base: {w,h,ox,oy,palette,data},
 *                                                open: {...}, ... } } }
 *   Every state object is blit()-compatible and carries its scene position
 *   (ox, oy) so runtime code never has to guess coordinates.
 *
 * With --preview <dir>, also writes upscaled PNGs (bg, each part state, and
 * a recomposited check image) for visual verification with the Read tool.
 *
 * Usage:
 *   node tools/cutout.mjs refs/<scene> -w 240 -h 160 [options]
 *
 * Options:
 *   -w / -h         target resolution (required; e.g. 240x160 GBA, 320x180)
 *   --colors <n>    max palette colours incl. 'none', 2-52 (default 32)
 *   --name <id>     JS constant prefix (default: dir name, uppercased)
 *   --preview <dir> write verification PNGs into <dir>
 *   -o <file>       write JS output to file (default: stdout)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  decodePNG, encodePNG, medianCut, nearestIndex, encodeRLE,
  downscaleIndices, toHex,
} from './lib/png.mjs';

/* ================= CLI ================= */

function parseArgs(argv) {
  const opts = { dir: null, w: null, h: null, colors: 32, name: null, preview: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-w') opts.w = parseInt(argv[++i], 10);
    else if (a === '-h') opts.h = parseInt(argv[++i], 10);
    else if (a === '--colors') opts.colors = parseInt(argv[++i], 10);
    else if (a === '--name') opts.name = argv[++i];
    else if (a === '--preview') opts.preview = argv[++i];
    else if (a === '-o') opts.out = argv[++i];
    else if (a === '--help') opts.help = true;
    else if (!a.startsWith('-') && !opts.dir) opts.dir = a;
    else throw new Error('unknown argument: ' + a);
  }
  return opts;
}

function usage(code) {
  console.error('Usage: node tools/cutout.mjs refs/<scene> -w N -h N [--colors N] [--name PREFIX] [--preview DIR] [-o out.js]');
  process.exit(code);
}

/* ================= Input discovery ================= */

/** parts/NN-name@state.png → { z, name, state } (z and @state optional) */
function parsePartFilename(file) {
  const m = /^(?:(\d+)-)?([a-zA-Z][a-zA-Z0-9_]*)(?:@([a-zA-Z][a-zA-Z0-9_]*))?\.png$/.exec(file);
  if (!m) {
    throw new Error(
      'parts/' + file + ": can't parse — expected NN-name.png or NN-name@state.png "
      + '(name: letters/digits/underscore, starting with a letter)');
  }
  return { z: m[1] !== undefined ? parseInt(m[1], 10) : null, name: m[2], state: m[3] || 'base' };
}

function discover(dir) {
  const basePath = join(dir, 'base.png');
  if (!existsSync(basePath)) throw new Error(dir + '/base.png not found');

  const inputs = {
    base: basePath,
    bg: existsSync(join(dir, 'bg.png')) ? join(dir, 'bg.png') : null,
    parts: new Map(), // name → { z, states: Map(state → path) }
    masks: [],        // { name, z, path }
  };

  const partsDir = join(dir, 'parts');
  if (existsSync(partsDir) && statSync(partsDir).isDirectory()) {
    const files = readdirSync(partsDir).filter((f) => f.endsWith('.png')).sort();
    let autoZ = 100;
    for (const f of files) {
      const { z, name, state } = parsePartFilename(f);
      let part = inputs.parts.get(name);
      if (!part) { part = { z: z !== null ? z : autoZ++, states: new Map() }; inputs.parts.set(name, part); }
      else if (z !== null && part.z !== z && !part.zConflictOk) {
        // all files of one part should agree on z; take the base state's
        if (state === 'base') part.z = z;
      }
      if (part.states.has(state)) throw new Error('parts/: duplicate state "' + state + '" for part "' + name + '"');
      part.states.set(state, join(partsDir, f));
    }
    for (const [name, part] of inputs.parts) {
      if (!part.states.has('base')) {
        throw new Error('part "' + name + '" has @state files but no default file (NN-' + name + '.png) — '
          + 'the default state must exist because it is the one shown in base.png');
      }
    }
  }

  let autoZ = 500;
  for (const f of readdirSync(dir).filter((f) => /^mask-.*\.png$/.test(f)).sort()) {
    const m = /^mask-(?:(\d+)-)?([a-zA-Z][a-zA-Z0-9_]*)\.png$/.exec(f);
    if (!m) throw new Error(f + ": can't parse — expected mask-name.png or mask-NN-name.png");
    const name = m[2];
    if (inputs.parts.has(name)) {
      throw new Error('both parts/*-' + name + '.png and ' + f + ' exist — provide one or the other');
    }
    inputs.masks.push({ name, z: m[1] !== undefined ? parseInt(m[1], 10) : autoZ++, path: join(dir, f) });
  }

  return inputs;
}

/* ================= Quantize + downscale one image ================= */

function loadPNG(path, expectW, expectH, what) {
  const img = decodePNG(readFileSync(path));
  if (expectW && (img.w !== expectW || img.h !== expectH)) {
    throw new Error(what + ' (' + path + ') is ' + img.w + 'x' + img.h
      + ' but base.png is ' + expectW + 'x' + expectH
      + ' — every input must share base.png\'s canvas size so positions line up');
  }
  return img;
}

/** RGBA image → target-res Int16Array of palette indices (-1 = transparent) */
function toIndexed(img, palette, tw, th) {
  const n = img.w * img.h;
  const srcIdx = new Int16Array(n);
  const cache = new Map();
  for (let i = 0; i < n; i++) {
    if (img.A[i] < 128) { srcIdx[i] = -1; continue; }
    const key = (img.R[i] << 16) | (img.G[i] << 8) | img.B[i];
    let idx = cache.get(key);
    if (idx === undefined) {
      idx = nearestIndex(img.R[i], img.G[i], img.B[i], palette);
      cache.set(key, idx);
    }
    srcIdx[i] = idx;
  }
  return downscaleIndices(srcIdx, img.w, img.h, tw, th);
}

/* ================= Inpaint (fill cut-out holes) ================= */

/**
 * Fill `holes` (Set of buffer offsets) by iteratively assigning each hole
 * pixel the most common value among its non-hole 8-neighbours, eroding the
 * hole from its boundary inward. -1 (transparent) is a legitimate value —
 * a part floating in front of transparent sky is backed by sky.
 */
function inpaint(idx, w, h, holes) {
  const remaining = new Set(holes);
  while (remaining.size) {
    const updates = [];
    for (const o of remaining) {
      const x = o % w, y = (o - x) / w;
      const counts = new Map();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const no = ny * w + nx;
          if (remaining.has(no)) continue;
          counts.set(idx[no], (counts.get(idx[no]) || 0) + 1);
        }
      }
      if (!counts.size) continue; // interior pixel — wait for next pass
      let best = 0, bestC = -1;
      for (const [v, c] of counts) if (c > bestC) { bestC = c; best = v; }
      updates.push([o, best]);
    }
    if (!updates.length) { for (const o of remaining) idx[o] = -1; break; } // isolated (shouldn't happen)
    for (const [o, v] of updates) { idx[o] = v; remaining.delete(o); }
  }
}

/* ================= Sprite extraction ================= */

/** Crop an indexed image to its opaque bounding box → state object. */
function toState(idx, tw, th, what) {
  let x0 = tw, y0 = th, x1 = -1, y1 = -1;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      if (idx[y * tw + x] >= 0) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) {
    throw new Error(what + ' is entirely transparent after conversion — is the part drawn on the canvas?');
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = idx[(y0 + y) * tw + (x0 + x)];
      out[y * w + x] = v < 0 ? 0 : v + 1; // shift: palette index 0 = 'none'
    }
  }
  return { w, h, ox: x0, oy: y0, indices: out };
}

/* ================= Preview output ================= */

function writePreview(path, idx, w, h, palette, scale) {
  const s = scale || Math.max(1, Math.ceil(384 / Math.max(w, h)));
  const W = w * s, H = h * s;
  const rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = idx[Math.floor(y / s) * w + Math.floor(x / s)];
      const o = (y * W + x) * 4;
      if (v < 0) continue; // transparent
      const [r, g, b] = palette[v];
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  }
  writeFileSync(path, encodePNG(W, H, rgba));
}

/* ================= Main ================= */

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) usage(0);
  if (!opts.dir || !opts.w || !opts.h) usage(1);
  if (opts.colors < 2 || opts.colors > 52) throw new Error('--colors must be 2-52');
  const tw = opts.w, th = opts.h;

  const inputs = discover(opts.dir);
  const warnings = [];

  /* ---- decode everything, enforce shared canvas size ---- */
  const baseImg = loadPNG(inputs.base, 0, 0, 'base');
  const bgImg = inputs.bg ? loadPNG(inputs.bg, baseImg.w, baseImg.h, 'bg') : null;
  const partImgs = new Map(); // name → { z, states: Map(state → rgba image) }
  for (const [name, part] of inputs.parts) {
    const states = new Map();
    for (const [state, path] of part.states) {
      states.set(state, loadPNG(path, baseImg.w, baseImg.h, 'part "' + name + '" state "' + state + '"'));
    }
    partImgs.set(name, { z: part.z, states });
  }
  const maskImgs = inputs.masks.map((m) => ({
    ...m, img: loadPNG(m.path, baseImg.w, baseImg.h, 'mask "' + m.name + '"'),
  }));

  /* ---- ONE unified palette from every opaque pixel of every input ---- */
  const opaque = [];
  const collect = (img) => {
    for (let i = 0; i < img.w * img.h; i++) {
      if (img.A[i] >= 128) opaque.push((img.R[i] << 16) | (img.G[i] << 8) | img.B[i]);
    }
  };
  collect(baseImg);
  if (bgImg) collect(bgImg);
  for (const { states } of partImgs.values()) for (const img of states.values()) collect(img);
  const palette = medianCut(opaque, opts.colors - 1); // slot 0 reserved for 'none'

  /* ---- quantize + downscale ---- */
  const baseIdx = toIndexed(baseImg, palette, tw, th);
  const partIdx = new Map(); // name → { z, states: Map(state → Int16Array) }
  for (const [name, { z, states }] of partImgs) {
    const s = new Map();
    for (const [state, img] of states) s.set(state, toIndexed(img, palette, tw, th));
    partIdx.set(name, { z, states: s });
  }

  /* ---- masks: cut the region straight out of base ---- */
  for (const m of maskImgs) {
    const maskDown = toIndexed(m.img, [[255, 0, 255]], tw, th); // ≥0 = selected
    const cut = new Int16Array(tw * th).fill(-1);
    let count = 0;
    for (let i = 0; i < tw * th; i++) {
      if (maskDown[i] >= 0 && baseIdx[i] >= 0) { cut[i] = baseIdx[i]; count++; }
    }
    if (!count) throw new Error('mask "' + m.name + '" selects nothing (or only transparent base pixels)');
    partIdx.set(m.name, { z: m.z, states: new Map([['base', cut]]) });
  }

  /* ---- background: bg.png, or base with part regions inpainted ---- */
  let bgIdx;
  if (bgImg) {
    bgIdx = toIndexed(bgImg, palette, tw, th);
  } else {
    bgIdx = Int16Array.from(baseIdx);
    const holes = new Set();
    for (const { states } of partIdx.values()) {
      const s = states.get('base');
      for (let i = 0; i < tw * th; i++) if (s[i] >= 0) holes.add(i);
    }
    if (holes.size) inpaint(bgIdx, tw, th, holes);
    if (holes.size > tw * th * 0.25) {
      warnings.push('parts cover ' + Math.round(holes.size * 100 / (tw * th))
        + '% of the scene — automatic inpainting will be rough; consider providing bg.png');
    }
  }

  /* ---- alignment check: base-state parts should match base.png pixels ---- */
  for (const [name, { states }] of partIdx) {
    const s = states.get('base');
    let total = 0, diff = 0;
    for (let i = 0; i < tw * th; i++) {
      if (s[i] >= 0) { total++; if (baseIdx[i] !== s[i]) diff++; }
    }
    if (total && diff / total > 0.4) {
      warnings.push('part "' + name + '": ' + Math.round(diff * 100 / total)
        + '% of its pixels differ from base.png at the same position — the part image may be misaligned');
    }
  }

  /* ---- build output objects ---- */
  const name = (opts.name || basename(opts.dir.replace(/\/+$/, ''))).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();

  const bgFinal = new Uint8Array(tw * th);
  for (let i = 0; i < tw * th; i++) bgFinal[i] = bgIdx[i] < 0 ? 0 : bgIdx[i] + 1;

  const sortedParts = [...partIdx.entries()].sort((a, b) => a[1].z - b[1].z);
  const partsOut = sortedParts.map(([pname, { z, states }]) => ({
    name: pname, z,
    states: [...states.entries()].map(([sname, idx]) => ({
      state: sname,
      ...toState(idx, tw, th, 'part "' + pname + '" state "' + sname + '"'),
    })),
  }));

  /* ---- compact the palette: drop unused entries, sort by luminance ---- */
  const used = new Set(bgFinal);
  for (const p of partsOut) for (const s of p.states) for (const v of s.indices) used.add(v);
  const kept = [...used].filter((v) => v > 0); // v-1 = index into `palette`
  kept.sort((a, b) => {
    const lum = ([r, g, bl]) => 0.299 * r + 0.587 * g + 0.114 * bl;
    return lum(palette[a - 1]) - lum(palette[b - 1]);
  });
  const remap = new Uint8Array(palette.length + 1);
  const hexPalette = ['none'];
  for (const old of kept) { remap[old] = hexPalette.length; hexPalette.push(toHex(palette[old - 1])); }
  if (hexPalette.length > 52) throw new Error('palette exceeds RLE alphabet (52) — reduce --colors');
  for (let i = 0; i < bgFinal.length; i++) bgFinal[i] = remap[bgFinal[i]];
  for (const p of partsOut) {
    for (const s of p.states) {
      for (let i = 0; i < s.indices.length; i++) s.indices[i] = remap[s.indices[i]];
    }
  }

  /* ---- emit JS ---- */
  const chunkRLE = (rle) => {
    const chunks = [];
    for (let i = 0; i < rle.length; i += 200) chunks.push(rle.slice(i, i + 200));
    return "'" + chunks.join("'\n    + '") + "'";
  };
  let js = '// Generated by tools/cutout.mjs from ' + opts.dir
    + ' (' + tw + 'x' + th + ', ' + hexPalette.length + ' colours, '
    + partsOut.length + ' part' + (partsOut.length === 1 ? '' : 's') + ')\n'
    + '// Regenerate: node tools/cutout.mjs ' + opts.dir + ' -w ' + tw + ' -h ' + th
    + (opts.out ? ' -o ' + opts.out : '') + '\n'
    + 'const ' + name + "_PALETTE = [" + hexPalette.map((c) => "'" + c + "'").join(', ') + '];\n\n'
    + 'const ' + name + '_BG = {\n'
    + '  w: ' + tw + ', h: ' + th + ', palette: ' + name + '_PALETTE,\n'
    + '  data: ' + chunkRLE(encodeRLE(bgFinal)) + '\n};\n\n'
    + 'const ' + name + '_PARTS = {\n';
  for (const p of partsOut) {
    js += '  ' + p.name + ': { z: ' + p.z + ', states: {\n';
    for (const s of p.states) {
      js += '    ' + s.state + ': { w: ' + s.w + ', h: ' + s.h
        + ', ox: ' + s.ox + ', oy: ' + s.oy + ', palette: ' + name + '_PALETTE,\n'
        + '      data: ' + chunkRLE(encodeRLE(s.indices)) + ' },\n';
    }
    js += '  } },\n';
  }
  js += '};\n';

  if (opts.out) { writeFileSync(opts.out, js); console.error('wrote ' + opts.out); }
  else process.stdout.write(js);

  /* ---- previews ---- */
  if (opts.preview) {
    mkdirSync(opts.preview, { recursive: true });
    writePreview(join(opts.preview, 'bg.png'), bgIdx, tw, th, palette);
    const composite = Int16Array.from(bgIdx);
    for (const [, { states }] of sortedParts) {
      const s = states.get('base');
      for (let i = 0; i < tw * th; i++) if (s[i] >= 0) composite[i] = s[i];
    }
    writePreview(join(opts.preview, 'composite.png'), composite, tw, th, palette);
    writePreview(join(opts.preview, 'reference.png'), baseIdx, tw, th, palette);
    for (const [pname, { states }] of sortedParts) {
      for (const [sname, idx] of states) {
        writePreview(join(opts.preview, 'part-' + pname + '@' + sname + '.png'), idx, tw, th, palette);
      }
    }
    console.error('previews written to ' + opts.preview
      + ' — check bg.png (no part remnants / clean inpaint) and composite.png vs reference.png');
  }

  /* ---- summary ---- */
  console.error('palette: ' + hexPalette.length + " colours (index 0 = 'none')"
    + (bgImg ? ', background from bg.png' : ', background inpainted from base.png'));
  for (const p of partsOut) {
    console.error('part ' + p.name + ' (z=' + p.z + '): '
      + p.states.map((s) => s.state + ' ' + s.w + 'x' + s.h + '@(' + s.ox + ',' + s.oy + ')').join(', '));
  }
  for (const w of warnings) console.error('WARNING: ' + w);
}

try {
  main();
} catch (e) {
  console.error('error: ' + e.message);
  process.exit(1);
}
