#!/usr/bin/env node
/**
 * selftest — smoke test for the image-to-scene tooling.
 *
 * Zero dependencies; builds synthetic pixel-art material in a temp dir and
 * drives the real CLI tools end to end:
 *
 *   1. PNG encoder ↔ decoder round trip (lib/png.mjs)
 *   2. RLE round trip
 *   3. medianCut: exact palette for few-colour art, no duplicates, budget
 *   4. png2pixel.mjs: conversion + --mask + --palette fixed ordering
 *   5. cutout.mjs: parts/bg/mask conventions, unified palette, sprite
 *      bboxes & positions, inpainting, previews
 *   6. shared modules load in Node (pixel.js, sprite.js exports)
 *
 * Run before/after touching tools/ or shared/:  node tools/selftest.mjs
 * Exits non-zero on the first failure.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodePNG, encodePNG, medianCut, encodeRLE, decodeRLE,
} from './lib/png.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(TOOLS);

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ok  ' + name); }
  else { failures++; console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}
function section(name) { console.log('\n== ' + name); }

/* ---- synthetic material (hut with door + bird, as in the docs) ---- */

const W = 96, H = 64;
function canvas() { return new Uint8Array(W * H * 4); }
function rect(buf, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
}
function drawBG(buf, withDoorway) {
  rect(buf, 0, 40, W, 24, 60, 120, 60);           // grass
  rect(buf, 30, 24, 30, 24, 120, 80, 40);         // hut
  if (withDoorway) rect(buf, 40, 34, 8, 14, 30, 20, 15); // doorway interior
}
const drawDoor = (buf) => rect(buf, 40, 34, 8, 14, 200, 40, 40);
const drawDoorOpen = (buf) => rect(buf, 36, 34, 4, 14, 200, 40, 40);
const drawBird = (buf) => rect(buf, 70, 12, 6, 3, 240, 240, 240);

/* ================= 1. PNG round trip ================= */

section('PNG encode/decode round trip');
{
  const buf = canvas();
  drawBG(buf, true); drawDoor(buf); drawBird(buf);
  const png = encodePNG(W, H, buf);
  const dec = decodePNG(png);
  check('dimensions', dec.w === W && dec.h === H);
  let same = true;
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (dec.R[i] !== buf[o] || dec.G[i] !== buf[o + 1]
      || dec.B[i] !== buf[o + 2] || dec.A[i] !== buf[o + 3]) { same = false; break; }
  }
  check('pixel-exact RGBA', same);
}

/* ================= 2. RLE round trip ================= */

section('RLE round trip');
{
  const idx = Uint8Array.from({ length: 500 }, (_, i) => (i * 7) % 52);
  const back = decodeRLE(encodeRLE(idx));
  check('length', back.length === idx.length);
  check('content', back.every((v, i) => v === idx[i]));
}

/* ================= 3. medianCut ================= */

section('medianCut');
{
  const px = [];
  const colors = [0x3c783c, 0x785028, 0xc82828, 0x1e140f, 0xf0f0f0];
  for (const c of colors) for (let i = 0; i < 500; i++) px.push(c);
  const exact = medianCut(px.slice(), 31);
  check('few-colour art keeps exact colours', exact.length === 5,
    'got ' + exact.length);

  const noisy = [];
  for (let i = 0; i < 5000; i++) {
    noisy.push(((i * 13) % 256 << 16) | ((i * 29) % 256 << 8) | ((i * 7) % 256));
  }
  const pal = medianCut(noisy, 16);
  check('budget respected', pal.length <= 16, 'got ' + pal.length);
  const keys = new Set(pal.map(([r, g, b]) => (r << 16) | (g << 8) | b));
  check('no duplicate entries', keys.size === pal.length);
}

/* ================= 4 + 5. CLI tools on a synthetic refs dir ================= */

const tmp = mkdtempSync(join(tmpdir(), 'chill-selftest-'));
try {
  const refs = join(tmp, 'hut');
  mkdirSync(join(refs, 'parts'), { recursive: true });

  let b = canvas(); drawBG(b, false); drawDoor(b); drawBird(b);
  writeFileSync(join(refs, 'base.png'), encodePNG(W, H, b));
  b = canvas(); drawDoor(b); writeFileSync(join(refs, 'parts', '20-door.png'), encodePNG(W, H, b));
  b = canvas(); drawDoorOpen(b); writeFileSync(join(refs, 'parts', '20-door@open.png'), encodePNG(W, H, b));
  b = canvas(); drawBird(b); writeFileSync(join(refs, 'parts', '30-bird.png'), encodePNG(W, H, b));

  const run = (script, args) =>
    execFileSync(process.execPath, [join(TOOLS, script), ...args], { encoding: 'utf8' });
  const evalJS = (js, names) =>
    new Function(js + '; return [' + names.join(',') + '];')();

  section('png2pixel.mjs');
  {
    const js = run('png2pixel.mjs', [join(refs, 'base.png'), '-w', '48', '-h', '32', '--name', 'T']);
    const [img] = evalJS(js, ['T']);
    check('converts', img.w === 48 && img.h === 32 && img.palette.length >= 4);
    check("transparent sky → 'none' at 0", img.palette[0] === 'none');
    check('RLE decodes to w*h', decodeRLE(img.data).length === 48 * 32);

    const fixed = run('png2pixel.mjs', [join(refs, 'base.png'), '-w', '48', '-h', '32',
      '--name', 'T', '--palette', 'none,#3c783c,#785028,#c82828,#f0f0f0']);
    const [fimg] = evalJS(fixed, ['T']);
    check('--palette keeps caller order',
      JSON.stringify(fimg.palette) === JSON.stringify(['none', '#3c783c', '#785028', '#c82828', '#f0f0f0']),
      JSON.stringify(fimg.palette));

    const mb = canvas(); rect(mb, 40, 34, 8, 14, 255, 0, 255);
    writeFileSync(join(tmp, 'mask.png'), encodePNG(W, H, mb));
    const mjs = run('png2pixel.mjs', [join(tmp, 'mask.png'), '-w', '48', '-h', '32', '--name', 'M', '--mask']);
    const [mimg] = evalJS(mjs, ['M']);
    const mdec = decodeRLE(mimg.data);
    check('--mask selects region', mimg.palette[0] === 'none'
      && mdec.some((v) => v === 1) && mdec[0] === 0);
  }

  section('cutout.mjs (inpainted background)');
  {
    const prev = join(tmp, 'prev');
    run('cutout.mjs', [refs, '-w', W + '', '-h', H + '', '--name', 'HUT', '-o', join(tmp, 'hut.js'), '--preview', prev]);
    const js = readFileSync(join(tmp, 'hut.js'), 'utf8');
    const [pal, bg, parts] = evalJS(js, ['HUT_PALETTE', 'HUT_BG', 'HUT_PARTS']);

    check('unified palette, exact colours', pal.length === 5 && pal[0] === 'none',
      JSON.stringify(pal));
    check('bg dimensions', bg.w === W && bg.h === H);
    check('two parts', Object.keys(parts).sort().join(',') === 'bird,door');
    check('z from filename prefix', parts.door.z === 20 && parts.bird.z === 30);

    const door = parts.door.states;
    check('door states', 'base' in door && 'open' in door);
    check('door base bbox 8x14@(40,34)',
      door.base.w === 8 && door.base.h === 14 && door.base.ox === 40 && door.base.oy === 34,
      JSON.stringify(door.base));
    check('door open bbox 4x14@(36,34)',
      door.open.w === 4 && door.open.h === 14 && door.open.ox === 36 && door.open.oy === 34,
      JSON.stringify(door.open));
    check('states share the palette', door.base.palette === pal && parts.bird.states.base.palette === pal);

    // Door region of the inpainted bg must contain no door-red pixels
    const bgIdx = decodeRLE(bg.data);
    const red = pal.indexOf('#c82828');
    let redInHole = 0;
    for (let y = 34; y < 48; y++) for (let x = 40; x < 48; x++) {
      if (bgIdx[y * W + x] === red) redInHole++;
    }
    check('door cut out of bg (inpainted, no red left)', redInHole === 0, redInHole + ' red px');
    // Bird floated over transparent sky → its hole must be transparent again
    check('bird hole restored to transparent sky', bgIdx[13 * W + 72] === 0,
      'idx ' + bgIdx[13 * W + 72]);

    for (const f of ['bg.png', 'composite.png', 'reference.png', 'part-door@base.png', 'part-door@open.png', 'part-bird@base.png']) {
      check('preview ' + f, existsSync(join(prev, f)));
    }
  }

  section('cutout.mjs (bg.png + mask fallback)');
  {
    b = canvas(); drawBG(b, true);
    writeFileSync(join(refs, 'bg.png'), encodePNG(W, H, b));
    run('cutout.mjs', [refs, '-w', W + '', '-h', H + '', '--name', 'HUT', '-o', join(tmp, 'hut2.js')]);
    const [pal2, bg2] = evalJS(readFileSync(join(tmp, 'hut2.js'), 'utf8'), ['HUT_PALETTE', 'HUT_BG']);
    const bgIdx2 = decodeRLE(bg2.data);
    const dark = pal2.indexOf('#1e140f');
    check('authored bg.png used (doorway interior visible)',
      dark > 0 && bgIdx2[40 * W + 44] === dark);

    // mask fallback: a refs dir with base + mask only
    const refs2 = join(tmp, 'hut-mask');
    mkdirSync(refs2, { recursive: true });
    b = canvas(); drawBG(b, false); drawDoor(b);
    writeFileSync(join(refs2, 'base.png'), encodePNG(W, H, b));
    const mb = canvas(); rect(mb, 40, 34, 8, 14, 255, 0, 255);
    writeFileSync(join(refs2, 'mask-door.png'), encodePNG(W, H, mb));
    run('cutout.mjs', [refs2, '-w', W + '', '-h', H + '', '--name', 'HM', '-o', join(tmp, 'hm.js')]);
    const [, parts3] = evalJS(readFileSync(join(tmp, 'hm.js'), 'utf8'), ['HM_BG', 'HM_PARTS']);
    check('mask cuts part from base', parts3.door
      && parts3.door.states.base.w === 8 && parts3.door.states.base.ox === 40);
  }

  section('cutout.mjs (validation errors)');
  {
    const bad = join(tmp, 'bad');
    mkdirSync(join(bad, 'parts'), { recursive: true });
    b = canvas(); drawBG(b, false);
    writeFileSync(join(bad, 'base.png'), encodePNG(W, H, b));
    const small = new Uint8Array(48 * 32 * 4);
    writeFileSync(join(bad, 'parts', '10-thing.png'), encodePNG(48, 32, small));
    let threw = '';
    try { run('cutout.mjs', [bad, '-w', W + '', '-h', H + '']); }
    catch (e) { threw = String(e.stderr || e.message); }
    check('canvas-size mismatch rejected', threw.includes('canvas size'), threw.slice(0, 120));
  }

  section('shared modules load in Node');
  {
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const { PixelBuffer } = req(join(ROOT, 'shared', 'pixel.js'));
    check('pixel.js exports PixelBuffer', typeof PixelBuffer === 'function');
    globalThis.PixelBuffer = PixelBuffer; // sprite.js resolves it at call time
    const sprite = req(join(ROOT, 'shared', 'sprite.js'));
    check('sprite.js exports createSprite(s)',
      typeof sprite.createSprite === 'function' && typeof sprite.createSprites === 'function');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
if (failures) { console.error(failures + ' FAILURE(S)'); process.exit(1); }
console.log('ALL PASS');
