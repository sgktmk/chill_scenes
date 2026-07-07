#!/usr/bin/env node
/**
 * validate-refs — Check a refs/<scene>/ directory before porting.
 *
 * Zero dependencies. Catches authoring mistakes early so the port step
 * never has to guess: missing files, mask/src size mismatches, bad layer
 * ids, out-of-bounds pivots, interlaced PNGs, etc.
 *
 * Usage:
 *   node tools/validate-refs.mjs refs/<scene>
 *
 * Two valid shapes for a scene directory:
 *   single-image : base.png + spec.md            (whole frame, no manifest)
 *   layered      : layers.json + spec.md + PNGs  (partial animation)
 *
 * Exit code 0 = OK (warnings allowed), 1 = errors found.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const ROLES = ['background', 'static', 'movable', 'occluder'];
const KNOWN_KEYS = ['id', 'role', 'src', 'mask', 'at', 'pivot', 'anchor', 'motion', 'note'];

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/** Read just the PNG header — width, height, interlace flag. */
function pngInfo(path) {
  const buf = readFileSync(path);
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    w: buf.readUInt32BE(16),
    h: buf.readUInt32BE(20),
    interlace: buf[28],
  };
}

function checkPNG(dir, file, label) {
  const p = join(dir, file);
  if (!existsSync(p)) { err(label + ': file not found: ' + file); return null; }
  const info = pngInfo(p);
  if (!info) { err(label + ': ' + file + ' is not a valid PNG'); return null; }
  if (info.interlace !== 0) {
    err(label + ': ' + file + ' is interlaced (Adam7) — re-save without interlacing');
  }
  return info;
}

function isIntPair(v) {
  return Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));
}

function validateManifest(dir) {
  const mfPath = join(dir, 'layers.json');
  let mf;
  try {
    mf = JSON.parse(readFileSync(mfPath, 'utf8'));
  } catch (e) {
    err('layers.json: invalid JSON — ' + e.message);
    return;
  }

  // resolution
  let tw = 0, th = 0;
  if (!mf.resolution || !Number.isInteger(mf.resolution.w) || !Number.isInteger(mf.resolution.h)) {
    err('layers.json: "resolution": { "w": N, "h": N } is required');
  } else {
    tw = mf.resolution.w; th = mf.resolution.h;
    if (tw < 8 || tw > 512 || th < 8 || th > 512) err('layers.json: resolution must be 8-512 px');
  }
  if (mf.colors !== undefined && (!Number.isInteger(mf.colors) || mf.colors < 2 || mf.colors > 52)) {
    err('layers.json: "colors" must be an integer 2-52');
  }
  if (mf.name !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(mf.name)) {
    err('layers.json: "name" must be a valid JS identifier');
  }

  if (!Array.isArray(mf.layers) || mf.layers.length === 0) {
    err('layers.json: "layers" must be a non-empty array (back to front = paint order)');
    return;
  }

  const ids = new Set();
  const pngDims = new Map(); // file -> info
  const dims = (f, label) => {
    if (!pngDims.has(f)) pngDims.set(f, checkPNG(dir, f, label));
    return pngDims.get(f);
  };
  const fullFrameByFile = new Map(); // src -> used without `at`
  const partByFile = new Map();      // src -> used with `at`
  let movable = 0;

  mf.layers.forEach((L, i) => {
    const label = 'layer[' + i + ']' + (L && L.id ? ' (' + L.id + ')' : '');
    if (typeof L !== 'object' || L === null) { err(label + ': must be an object'); return; }

    for (const k of Object.keys(L)) {
      if (!KNOWN_KEYS.includes(k)) warn(label + ': unknown key "' + k + '" (ignored by the converter)');
    }
    if (!L.id || !/^[a-z][a-z0-9-]*$/.test(L.id)) {
      err(label + ': "id" is required and must match [a-z][a-z0-9-]*');
    } else if (ids.has(L.id)) {
      err(label + ': duplicate id "' + L.id + '"');
    } else ids.add(L.id);

    if (!L.role || !ROLES.includes(L.role)) {
      err(label + ': "role" must be one of ' + ROLES.join(' / '));
    }
    if (L.role === 'movable') movable++;

    if (L.role === 'background') {
      if (L.src || L.mask) err(label + ': background layers must not have src/mask');
      return;
    }
    if (!L.src) { err(label + ': "src" is required (or role: "background")'); return; }
    const s = dims(L.src, label);

    if (L.at !== undefined) {
      if (!isIntPair(L.at)) err(label + ': "at" must be [x, y] integers');
      else if (tw && (L.at[0] < -2048 || L.at[1] < -2048 || L.at[0] >= tw || L.at[1] >= th)) {
        err(label + ': "at" ' + JSON.stringify(L.at) + ' places the part outside the ' + tw + 'x' + th + ' frame');
      }
      if (L.mask) err(label + ': mask is only supported on full-frame layers (remove "at" or "mask")');
      if (s && tw && s.w <= tw && s.h <= th) {
        // fine — part sprite at target scale
      } else if (s && tw && s.h > th) {
        warn(label + ': part is taller than the frame (' + s.h + ' > ' + th + ') — intended?');
      }
      if (L.src && fullFrameByFile.has(L.src)) {
        err(label + ': ' + L.src + ' is used both full-frame and as a part ("at")');
      }
      partByFile.set(L.src, true);
    } else {
      if (partByFile.has(L.src)) {
        err(label + ': ' + L.src + ' is used both full-frame and as a part ("at")');
      }
      fullFrameByFile.set(L.src, true);
      if (s && tw && (s.w < tw || s.h < th)) {
        err(label + ': full-frame src ' + L.src + ' (' + s.w + 'x' + s.h + ') is smaller than the target '
          + tw + 'x' + th + ' — full-frame sources must cover the whole frame');
      }
      if (s && Math.abs(s.w / s.h - tw / th) > 0.02) {
        warn(label + ': ' + L.src + ' aspect ratio ' + (s.w / s.h).toFixed(3)
          + ' differs from target ' + (tw / th).toFixed(3) + ' — the image will be squashed');
      }
    }

    if (L.mask) {
      const m = dims(L.mask, label);
      if (m && s && (m.w !== s.w || m.h !== s.h)) {
        err(label + ': mask ' + L.mask + ' (' + m.w + 'x' + m.h + ') must exactly match src '
          + L.src + ' (' + s.w + 'x' + s.h + ')');
      }
      if (!/^mask-[a-z0-9-]+\.png$/.test(L.mask)) {
        warn(label + ': mask file should follow the mask-<part>.png naming convention (got ' + L.mask + ')');
      }
    }

    for (const k of ['pivot', 'anchor']) {
      if (L[k] === undefined) continue;
      if (!isIntPair(L[k])) err(label + ': "' + k + '" must be [x, y] integers in scene coordinates');
      else if (tw && (L[k][0] < 0 || L[k][0] > tw || L[k][1] < 0 || L[k][1] > th)) {
        err(label + ': "' + k + '" ' + JSON.stringify(L[k]) + ' is outside the ' + tw + 'x' + th + ' frame');
      }
    }
    if (L.role === 'movable' && typeof L.motion === 'string'
        && /swing|rotate|pendul/i.test(L.motion) && L.pivot === undefined) {
      warn(label + ': motion suggests rotation but no "pivot" is set — the implementer would have to guess one');
    }
    if (L.role === 'movable' && L.motion === undefined) {
      warn(label + ': movable layer has no "motion" description — say how it should move in a few words');
    }
  });

  if (movable === 0) warn('layers.json: no movable layers — a single base.png (no manifest) would be simpler');
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node tools/validate-refs.mjs refs/<scene>');
    process.exit(1);
  }
  const dir = resolve(arg);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error('error: not a directory: ' + arg);
    process.exit(1);
  }

  const hasManifest = existsSync(join(dir, 'layers.json'));
  const hasBase = existsSync(join(dir, 'base.png'));

  if (!existsSync(join(dir, 'spec.md'))) {
    warn('spec.md not found — motion/audio intent should be written down (copy refs/_template/spec.md)');
  }

  if (hasManifest) {
    validateManifest(dir);
  } else if (hasBase) {
    checkPNG(dir, 'base.png', 'base.png');
    console.error('single-image scene (no layers.json): partial animation of specific parts');
    console.error('(doors, straps, window views…) will NOT be reliable — add layers.json + masks/parts');
    console.error('if anything in the image must move independently.');
  } else {
    err('neither layers.json nor base.png found — nothing to port');
  }

  for (const w of warnings) console.error('warn:  ' + w);
  for (const e of errors) console.error('ERROR: ' + e);
  if (errors.length) {
    console.error('\n' + basename(dir) + ': ' + errors.length + ' error(s), ' + warnings.length + ' warning(s)');
    process.exit(1);
  }
  console.error(basename(dir) + ': OK (' + warnings.length + ' warning(s))');
}

main();
