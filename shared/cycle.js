/**
 * Shared Day-Night Cycle — keyframe interpolation engine
 *
 * Extracted from the pattern used by seascape.html and rice-terrace.html:
 * a looping phase 0.0-1.0 drives interpolation between keyframes, where
 * each keyframe carries arbitrary named channels (colours, numbers, or
 * arrays of either — e.g. sky gradient stop lists).
 *
 * Usage:
 *   const cycle = createCycle({
 *     cycle: 180,             // seconds per full loop
 *     startOffset: 0.10,      // phase at page load (begin in the morning)
 *     keyframes: [
 *       { p: 0.00, top: '#3a4878', hor: '#f8c078', br: 0.72, night: 0.2 },
 *       { p: 0.22, top: '#3f83dc', hor: '#c8e4f6', br: 1.05, night: 0.0 },
 *       { p: 0.76, top: '#0b1126', hor: '#2a3c5e', br: 0.40, night: 1.0 },
 *       // p: 1.0 wraps back to the first keyframe automatically
 *     ],
 *   });
 *
 *   function tick() {
 *     const p = cycle.phase();       // 0.0-1.0 (frozen if ?t= is in the URL)
 *     const K = cycle.sample(p);     // { top: 'rgb(..)', hor: 'rgb(..)', br: 0.9, ... }
 *     ...
 *     requestAnimationFrame(tick);
 *   }
 *
 * Channel types (detected per value):
 *   '#rrggbb' hex string → interpolated, returned as 'rgb(r,g,b)'
 *   number               → linear interpolation
 *   array                → element-wise (recursive), e.g. 8 sky-band colours
 *
 * Debug: `?t=0.25` in the URL freezes phase() at 0.25 (override the param
 * name with opts.debugParam, or disable with debugParam: null).
 */

function createCycle(opts) {
  const CYCLE = opts.cycle || 180;
  const startOffset = (opts.startOffset || 0) * CYCLE;

  // Close the loop: last keyframe at p=1.0 mirrors the first
  const KF = opts.keyframes.slice();
  if (KF[KF.length - 1].p < 1) {
    KF.push(Object.assign({}, KF[0], { p: 1.0 }));
  }

  // Debug freeze via URL param (?t=0.25)
  const paramName = opts.debugParam === undefined ? 't' : opts.debugParam;
  let fixedT = null;
  if (paramName && typeof location !== 'undefined') {
    const qp = new URLSearchParams(location.search);
    if (qp.has(paramName)) {
      fixedT = Math.min(0.999, Math.max(0, parseFloat(qp.get(paramName)) || 0));
    }
  }

  function phase() {
    if (fixedT !== null) return fixedT;
    return ((performance.now() / 1000 + startOffset) % CYCLE) / CYCLE;
  }

  /* ---- interpolation helpers ---- */
  function hx(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  function lerpHex(a, b, t) {
    const A = hx(a), B = hx(b);
    const r = [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t));
    return 'rgb(' + r[0] + ',' + r[1] + ',' + r[2] + ')';
  }
  function lerpN(a, b, t) { return a + (b - a) * t; }
  function lerpVal(a, b, t) {
    if (typeof a === 'number') return lerpN(a, b, t);
    if (Array.isArray(a)) return a.map((v, i) => lerpVal(v, b[i], t));
    if (typeof a === 'string' && a[0] === '#') return lerpHex(a, b, t);
    return t < 0.5 ? a : b; // non-interpolable channel: step
  }

  /** Interpolate all channels at phase p. */
  function sample(p) {
    let a = KF[0], b = KF[KF.length - 1];
    for (let i = 0; i < KF.length - 1; i++) {
      if (p >= KF[i].p && p <= KF[i + 1].p) { a = KF[i]; b = KF[i + 1]; break; }
    }
    const t = (p - a.p) / ((b.p - a.p) || 1);
    const out = {};
    for (const k in a) {
      if (k === 'p') continue;
      out[k] = lerpVal(a[k], b[k], t);
    }
    return out;
  }

  /** Mix two already-sampled 'rgb(..)' strings (e.g. for band gradients). */
  function mixRgb(a, b, t) {
    const A = a.match(/\d+/g).map(Number), B = b.match(/\d+/g).map(Number);
    return 'rgb('
      + Math.round(A[0] + (B[0] - A[0]) * t) + ','
      + Math.round(A[1] + (B[1] - A[1]) * t) + ','
      + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }

  return { phase, sample, mixRgb, lerpHex, lerpN, fixedT, CYCLE };
}

// Node (tooling/tests) — no effect in the browser
if (typeof module !== 'undefined' && module.exports) module.exports = { createCycle };
