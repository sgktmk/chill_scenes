/**
 * Orchestra refs builder — turns the 1322x1190 reference render into the
 * native 160x144 base.png plus one transparent part PNG per musician
 * (and per bow), so every moving figure is a real cutout sprite.
 *
 * node refs/orchestra/split.mjs <source.png> refs/orchestra [viz.png]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decodePNG, encodePNG, medianCut, nearestIndex, downscaleIndices, toHex } from '../../tools/lib/png.mjs';

const SRC = process.argv[2];
const OUT = process.argv[3];
const VIZ = process.argv[4] || null;
const TW = 160, TH = 144, COLORS = 16;

/* ---------- 1. source -> native-resolution indexed image ---------- */
const img = decodePNG(readFileSync(SRC));
const opaque = [];
for (let i = 0; i < img.w * img.h; i++) opaque.push((img.R[i] << 16) | (img.G[i] << 8) | img.B[i]);
const pal = medianCut(opaque, COLORS);
const srcIdx = new Int16Array(img.w * img.h);
{
  const cache = new Map();
  for (let i = 0; i < img.w * img.h; i++) {
    const k = (img.R[i] << 16) | (img.G[i] << 8) | img.B[i];
    let v = cache.get(k);
    if (v === undefined) { v = nearestIndex(img.R[i], img.G[i], img.B[i], pal); cache.set(k, v); }
    srcIdx[i] = v;
  }
}
const base = downscaleIndices(srcIdx, img.w, img.h, TW, TH); // Int16Array
const lumOf = pal.map(([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b);
const L = (o) => lumOf[base[o]];

/* ---------- 2. musicians: seed (face centre) + clip box ----------
 * name, seed x, y, and the box the figure may occupy (x0,y0,x1,y1).
 * Boxes keep big stationary props (timpani, bass drum, harp) in the
 * background and stop the flood from leaking into the next player.
 *
 * `subs` splits a limb out of the figure into its own part so it can move
 * on its own: { name, rects | pixels, nondark, extend, axis }
 *   rects    x0,y0,x1,y1 boxes; `nondark` narrows them to the non-outline
 *            (mid/bright) pixels inside
 *   pixels   an explicit [x, y] list, for a part too tangled with the
 *            figure to box off — the trombone slides sit right against the
 *            player's chin and hands
 *   extend   refill the vacated pixels by copying along -axis rather than
 *            from the surrounding body (only worth it where the tube really
 *            does continue straight behind the part) */
const M = (name, sx, sy, x0, y0, x1, y1, o = {}) => ({ name, sx, sy, box: [x0, y0, x1, y1], ...o });
// The slide is the U-bend nearest the audience (the bell tube runs up-right
// behind it and stays put); pulling it out means moving it down-left.
const SLIDE = (pixels) => [{ name: 'slide', pixels, axis: [-1, 1] }];
const MUSICIANS = [
  // back row --------------------------------------------------------
  M('harpist',    27, 44,  20, 36,  33,  56,
    { subs: [{ name: 'hand', rects: [[19, 44, 22, 50]] }] }),
  M('timpanist',  78, 29,  70, 24,  87,  36,
    { subs: [{ name: 'mallets', rects: [[69, 27, 73, 33]] }] }),
  M('bassdrum',  103, 30,  95, 24, 112,  40,
    { subs: [{ name: 'beater', rects: [[98, 28, 102, 35]] }] }),
  M('tubist',    136, 37, 126, 27, 150,  56),
  // woodwinds / brass row -------------------------------------------
  M('wind1',      41, 55,  33, 45,  49,  70),
  M('wind2',      55, 55,  49, 45,  65,  70),
  M('wind3',      71, 56,  65, 46,  79,  70),
  M('wind4',      86, 56,  79, 46,  95,  70),
  // wind5 / wind6 are trombones. The slide is the U-bend on the near side,
  // between the player and the audience; the bell tube runs up-right behind
  // it and stays put. Pushing the slide out moves it down-left.
  M('wind5',     103, 55,  95, 44, 112,  70, { subs: SLIDE([
    [106, 58], [107, 59], [108, 59], [106, 60], [106, 61],
    [103, 61], [103, 62], [104, 62], [105, 62]]) }),
  M('wind6',     118, 55, 112, 44, 130,  70, { subs: SLIDE([
    [124, 58], [122, 59], [123, 59], [124, 60], [124, 61],
    [120, 60], [120, 61], [121, 61], [120, 62], [121, 62], [122, 62], [123, 62]]) }),
  // middle row ------------------------------------------------------
  M('mid1',       36, 76,  27, 66,  45,  90),
  M('mid2',       52, 76,  45, 66,  61,  90),
  M('mid3',       70, 76,  62, 66,  78,  92),
  M('mid4',       86, 76,  78, 66,  94,  92),
  M('mid5',      101, 77,  94, 66, 111,  92),
  M('mid6',      118, 77, 111, 66, 128,  92),
  M('bassist',   143, 79, 128, 62, 159, 118, { bow: 1 }),
  // front strings (left) --------------------------------------------
  M('vln1',       13, 85,   4, 76,  26, 100, { bow: 1 }),
  M('vln2',       30, 93,  21, 84,  42, 106, { bow: 1 }),
  M('vln3',       48, 97,  40, 88,  58, 112, { bow: 1 }),
  M('vln4',       62, 97,  55, 88,  72, 112, { bow: 1 }),
  M('vln5',       10, 101,  1, 94,  22, 118, { bow: 1 }),
  M('vln6',       29, 106, 20, 98,  40, 124, { bow: 1 }),
  M('vln7',       46, 108, 38, 100, 58, 126, { bow: 1 }),
  // cellos (right) --------------------------------------------------
  M('cello1',     94,  98, 84, 88, 104, 122, { bow: 1 }),
  M('cello2',    109,  98, 100, 88, 120, 122, { bow: 1 }),
  M('cello3',    124,  99, 116, 89, 136, 122, { bow: 1 }),
  M('cello4',    133,  94, 130, 84, 152, 120, { bow: 1 }),
];

/* ---------- 3. figure mask ---------- */
const DARK = 62, BRIGHT = 168, BOWTH = 156;
const N = TW * TH;
const inBox = new Uint8Array(N);
for (const m of MUSICIANS) {
  const [x0, y0, x1, y1] = m.box;
  for (let y = Math.max(0, y0); y <= Math.min(TH - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(TW - 1, x1); x++) inBox[y * TW + x] = 1;
  }
}
const fig = new Uint8Array(N);
for (let o = 0; o < N; o++) if (inBox[o] && L(o) < DARK) fig[o] = 1;
// bright pixels (faces, bows, brass) close to a dark figure pixel
for (let pass = 0; pass < 4; pass++) {
  const add = [];
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const o = y * TW + x;
      if (fig[o] || !inBox[o] || L(o) < BRIGHT) continue;
      let touch = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= TW || ny < 0 || ny >= TH) continue;
        if (fig[ny * TW + nx]) touch++;
      }
      if (touch) add.push(o);
    }
  }
  for (const o of add) fig[o] = 1;
}
// fill holes (faces, instrument bodies enclosed by the dark outline)
{
  const outside = new Uint8Array(N);
  const st = [];
  for (let x = 0; x < TW; x++) { st.push(x, (TH - 1) * TW + x); }
  for (let y = 0; y < TH; y++) { st.push(y * TW, y * TW + TW - 1); }
  while (st.length) {
    const o = st.pop();
    if (outside[o] || fig[o]) continue;
    outside[o] = 1;
    const x = o % TW, y = (o - x) / TW;
    if (x > 0) st.push(o - 1);
    if (x < TW - 1) st.push(o + 1);
    if (y > 0) st.push(o - TW);
    if (y < TH - 1) st.push(o + TW);
  }
  for (let o = 0; o < N; o++) if (!outside[o] && !fig[o] && inBox[o]) fig[o] = 1;
}

/* ---------- 4. geodesic split: every figure pixel -> nearest musician ---------- */
const lab = new Int32Array(N).fill(-1);
{
  let frontier = [];
  MUSICIANS.forEach((m, i) => {
    const o = m.sy * TW + m.sx;
    lab[o] = i; frontier.push(o);
  });
  while (frontier.length) {
    const next = [];
    for (const o of frontier) {
      const i = lab[o], x = o % TW, y = (o - x) / TW;
      const [bx0, by0, bx1, by1] = MUSICIANS[i].box;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < bx0 || nx > bx1 || ny < by0 || ny > by1) continue;
        if (nx < 0 || nx >= TW || ny < 0 || ny >= TH) continue;
        const no = ny * TW + nx;
        if (!fig[no] || lab[no] >= 0) continue;
        lab[no] = i; next.push(no);
      }
    }
    frontier = next;
  }
}

/* ---------- 5. bows: bright streaks that are not the face ---------- */
// face = bright blob containing the seed's neighbourhood; bow = any other
// bright run inside the musician, at least 3 px long.
const bowLab = new Int32Array(N).fill(-1);
MUSICIANS.forEach((m, i) => {
  if (!m.bow) return;
  const px = [];
  for (let o = 0; o < N; o++) if (lab[o] === i && L(o) >= BOWTH) px.push(o);
  if (!px.length) return;
  // flood the face component from the seed
  const face = new Set();
  {
    const st = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const o = (m.sy + dy) * TW + m.sx + dx;
      if (o >= 0 && o < N && lab[o] === i && L(o) >= BOWTH) st.push(o);
    }
    while (st.length) {
      const o = st.pop();
      if (face.has(o)) continue;
      face.add(o);
      const x = o % TW, y = (o - x) / TW;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, no = ny * TW + nx;
        if (nx < 0 || nx >= TW || ny < 0 || ny >= TH) continue;
        if (lab[no] === i && L(no) >= BOWTH && !face.has(no)) st.push(no);
      }
    }
  }
  // remaining bright components — the longest thin streak is the bow
  const rest = px.filter((o) => !face.has(o));
  const seen = new Set();
  let bestComp = null, bestLen = 0;
  for (const s of rest) {
    if (seen.has(s)) continue;
    const comp = [];
    const st = [s]; seen.add(s);
    while (st.length) {
      const o = st.pop(); comp.push(o);
      const x = o % TW, y = (o - x) / TW;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, no = ny * TW + nx;
        if (nx < 0 || nx >= TW || ny < 0 || ny >= TH) continue;
        if (lab[no] === i && L(no) >= BOWTH && !face.has(no) && !seen.has(no)) { seen.add(no); st.push(no); }
      }
    }
    if (comp.length < 3) continue;
    let x0 = TW, y0 = TH, x1 = -1, y1 = -1;
    for (const o of comp) {
      const x = o % TW, y = (o - x) / TW;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const len = Math.max(w, h);
    // elongated & thin => bow
    if (len >= 3 && comp.length <= len * 2.6 && len > bestLen) { bestLen = len; bestComp = comp; }
  }
  if (bestComp) for (const o of bestComp) bowLab[o] = i;
});

/* ---------- 5b. hand-placed subparts (mallets, beater, slides) ---------- */
// overlays[] = { owner, name, z, pixels:Set, extend, axis } — same treatment
// as a bow: its own part image, erased from the body underneath.
const overlays = [];
MUSICIANS.forEach((m, i) => {
  for (const sub of m.subs || []) {
    const pixels = new Set();
    for (const [x0, y0, x1, y1] of sub.rects || []) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const o = y * TW + x;
          if (lab[o] !== i) continue;
          if (sub.nondark && L(o) < DARK) continue;   // leave the casing behind
          pixels.add(o);
        }
      }
    }
    for (const [x, y] of sub.pixels || []) {
      const o = y * TW + x;
      if (lab[o] !== i) {
        throw new Error(m.name + ' subpart "' + sub.name + '": pixel ' + x + ',' + y
          + ' is not part of that figure');
      }
      pixels.add(o);
    }
    if (!pixels.size) throw new Error(m.name + ' subpart "' + sub.name + '" selects nothing');
    overlays.push({ owner: i, name: m.name + '_' + sub.name, pixels, extend: sub.extend, axis: sub.axis });
  }
});

/* ---------- 6. emit ---------- */
mkdirSync(OUT, { recursive: true });
const partsDir = join(OUT, 'parts');
if (existsSync(partsDir)) rmSync(partsDir, { recursive: true });
mkdirSync(partsDir, { recursive: true });

const hex = pal.map(toHex);
function writeIdxPNG(path, get) {
  const rgba = new Uint8Array(TW * TH * 4);
  for (let o = 0; o < N; o++) {
    const v = get(o);
    if (v < 0) continue;
    const [r, g, b] = pal[v];
    rgba[o * 4] = r; rgba[o * 4 + 1] = g; rgba[o * 4 + 2] = b; rgba[o * 4 + 3] = 255;
  }
  writeFileSync(path, encodePNG(TW, TH, rgba));
}

writeIdxPNG(join(OUT, 'base.png'), (o) => base[o]);

// Background: figures removed. The stage is built from horizontal bands
// (floor planks, wall mouldings), so each hole pixel copies the nearest
// kept pixel on its own row — that keeps the banding continuous instead of
// smearing blobs across the boards.
const bg = Int16Array.from(base);
{
  const hole = new Uint8Array(N);
  for (let o = 0; o < N; o++) if (lab[o] >= 0) hole[o] = 1;
  for (let y = 0; y < TH; y++) {
    const row = y * TW;
    for (let x = 0; x < TW; x++) {
      if (!hole[row + x]) continue;
      let l = x - 1, r = x + 1;
      while (l >= 0 && hole[row + l]) l--;
      while (r < TW && hole[row + r]) r++;
      const dl = l >= 0 ? x - l : Infinity;
      const dr = r < TW ? r - x : Infinity;
      if (dl === Infinity && dr === Infinity) continue;
      let pick = dl <= dr ? l : r, other = dl <= dr ? r : l;
      // never smear an outline/shadow pixel across the boards
      if (other >= 0 && other < TW && lumOf[base[row + pick]] < DARK
          && lumOf[base[row + other]] >= DARK) pick = other;
      bg[row + x] = base[row + pick];
    }
  }
}
writeIdxPNG(join(OUT, 'bg.png'), (o) => bg[o]);

// per-musician parts (bow pixels replaced by the body behind them)
const zBase = 10;
const report = [];
MUSICIANS.forEach((m, i) => {
  const own = new Uint8Array(N);
  let count = 0;
  for (let o = 0; o < N; o++) if (lab[o] === i) { own[o] = 1; count++; }
  if (!count) throw new Error('musician ' + m.name + ' selected nothing');
  const mine = overlays.filter((ov) => ov.owner === i);
  if (mine.length && bowLab.includes(i)) {
    throw new Error(m.name + ': a bow and a subpart would claim the same z slot');
  }
  // body image with the bow / subparts erased from underneath
  const body = Int16Array.from(base);
  const holes = new Set();
  for (let o = 0; o < N; o++) if (own[o] && bowLab[o] === i) holes.add(o);
  // an `extend` subpart (a trombone slide) is backed by more tube, copied
  // inward along its axis, so pulling it out reveals a longer tube
  for (const ov of mine) {
    if (!ov.extend) { for (const o of ov.pixels) holes.add(o); continue; }
    const [ax, ay] = ov.axis;
    const key = (o) => { const x = o % TW; return x * ax + ((o - x) / TW) * ay; };
    for (const o of [...ov.pixels].sort((a, b) => key(a) - key(b))) {
      const x = o % TW, y = (o - x) / TW;
      const sx = x - ax, sy = y - ay;
      const so = sy * TW + sx;
      body[o] = (sx >= 0 && sx < TW && sy >= 0 && sy < TH && own[so]) ? body[so] : body[o];
    }
  }
  const remaining = new Set(holes);
  while (remaining.size) {
    const upd = [];
    for (const o of remaining) {
      const x = o % TW, y = (o - x) / TW;
      const counts = new Map();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= TW || ny < 0 || ny >= TH) continue;
        const no = ny * TW + nx;
        if (remaining.has(no) || !own[no]) continue;
        counts.set(body[no], (counts.get(body[no]) || 0) + 1);
      }
      if (!counts.size) continue;
      let best = 0, bc = -1;
      for (const [v, c] of counts) if (c > bc) { bc = c; best = v; }
      upd.push([o, best]);
    }
    if (!upd.length) { for (const o of remaining) body[o] = bg[o]; break; }
    for (const [o, v] of upd) { body[o] = v; remaining.delete(o); }
  }
  const z = zBase + i * 2;
  const nn = String(z).padStart(2, '0');
  writeIdxPNG(join(partsDir, nn + '-' + m.name + '.png'), (o) => (own[o] ? body[o] : -1));
  let bowN = 0;
  for (let o = 0; o < N; o++) if (bowLab[o] === i) bowN++;
  if (bowN) {
    writeIdxPNG(join(partsDir, String(z + 1).padStart(2, '0') + '-' + m.name + '_bow.png'),
      (o) => (bowLab[o] === i ? base[o] : -1));
  }
  for (const ov of mine) {
    writeIdxPNG(join(partsDir, String(z + 1).padStart(2, '0') + '-' + ov.name + '.png'),
      (o) => (ov.pixels.has(o) ? base[o] : -1));
  }
  report.push(m.name + ' px=' + count + (bowN ? ' bow=' + bowN : '')
    + mine.map((ov) => ' ' + ov.name.split('_')[1] + '=' + ov.pixels.size).join(''));
});

console.log('palette', hex.join(' '));
console.log(report.join('\n'));
let cov = 0;
for (let o = 0; o < N; o++) if (lab[o] >= 0) cov++;
console.log('figure coverage', (cov * 100 / N).toFixed(1) + '%');

/* ---------- 7. visualization ---------- */
if (VIZ) {
  const S = 6, IW = TW * S, IH = TH * S;
  const rgba = new Uint8Array(IW * IH * 4);
  const cols = [[255, 90, 90], [90, 255, 90], [90, 160, 255], [255, 255, 90], [255, 90, 255], [90, 255, 255], [255, 160, 60], [200, 200, 200]];
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    const o = Math.floor(y / S) * TW + Math.floor(x / S);
    const p = pal[base[o]];
    const q = (y * IW + x) * 4;
    let r = p[0], g = p[1], b = p[2];
    if (lab[o] >= 0) {
      const c = cols[lab[o] % cols.length];
      r = (r + c[0] * 2) / 3; g = (g + c[1] * 2) / 3; b = (b + c[2] * 2) / 3;
    }
    if (bowLab[o] >= 0) { r = 255; g = 255; b = 255; }
    if (overlays.some((ov) => ov.pixels.has(o))) { r = 255; g = 255; b = 255; }
    rgba[q] = r; rgba[q + 1] = g; rgba[q + 2] = b; rgba[q + 3] = 255;
  }
  writeFileSync(VIZ, encodePNG(IW, IH, rgba));
}
