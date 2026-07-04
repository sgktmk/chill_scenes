/**
 * Shared Pixel Buffer — Low-res pixel-art rendering toolkit
 *
 * Provides a palette-indexed pixel buffer with drawing primitives,
 * a seeded PRNG for reproducible scenes, and RLE-compressed SVG output
 * with optional named layers for independent animation.
 *
 * Usage:
 *   const pb = new PixelBuffer(320, 180, ['#060610', '#0a0e1c', ...]);
 *   pb.seed(12345);
 *   pb.clear(0);
 *   pb.fr(10, 20, 50, 30, 5);          // filled rect
 *   pb.fe(160, 90, 20, 15, 3);         // filled ellipse
 *   pb.ft(100, 10, 80, 50, 120, 50, 2); // filled triangle
 *   pb.toSVG(svgEl);                   // flush to SVG
 *
 * Layered rendering (for animatable groups):
 *   pb.toSVG(svgEl, {
 *     layers: ['moon', 'stars'],
 *     classify(x, y, idx) {
 *       if (moonSet.has(idx)) return 'moon';
 *       if (starSet.has(idx)) return 'stars';
 *       return null; // default layer
 *     }
 *   });
 *   // Produces: <g>...</g><g id="moon">...</g><g id="stars">...</g>
 *
 * Loading converted images (see tools/png2pixel.mjs):
 *   const pb = PixelBuffer.fromImage(SCENE_IMG);       // whole image
 *   pb.blit(SPRITE_IMG, 40, 100);                      // paste at (40,100)
 *   const mask = PixelBuffer.decodeRLE(MASK_IMG.data); // raw index array
 */
class PixelBuffer {
  /**
   * @param {number} w — buffer width in pixels
   * @param {number} h — buffer height in pixels
   * @param {string[]} palette — array of hex colour strings (e.g. '#0a0e1c')
   */
  constructor(w, h, palette) {
    this.W = w;
    this.H = h;
    this.P = palette;
    this.buf = new Uint8Array(w * h);
    this._s = 77;
  }

  /* ---- PRNG (linear congruential) ---- */

  /** Seed the PRNG for reproducible output. */
  seed(v) { this._s = v; }

  /** Return a pseudo-random float in [0, 1). */
  rn() {
    this._s = (this._s * 1103515245 + 12345) & 0x7fffffff;
    return this._s / 0x7fffffff;
  }

  /** Return a pseudo-random integer in [a, b] (inclusive). */
  ri(a, b) { return Math.floor(a + this.rn() * (b - a + 1)); }

  /* ---- Buffer access ---- */

  /** Clear the entire buffer to palette index c (default 0). */
  clear(c) { this.buf.fill(c || 0); }

  /** Set a single pixel. Out-of-bounds writes are silently ignored. */
  sp(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < this.W && y >= 0 && y < this.H) {
      this.buf[y * this.W + x] = c;
    }
  }

  /** Get the palette index at (x, y). Returns -1 if out of bounds. */
  gp(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < this.W && y >= 0 && y < this.H) {
      return this.buf[y * this.W + x];
    }
    return -1;
  }

  /* ---- Drawing primitives ---- */

  /** Filled rectangle. */
  fr(x0, y0, w, h, c) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) this.sp(x, y, c);
    }
  }

  /** Filled ellipse. */
  fe(cx, cy, rx, ry, c) {
    for (let y = cy - ry; y <= cy + ry; y++) {
      let dy = (y - cy) / ry;
      let dx = Math.sqrt(Math.max(0, 1 - dy * dy)) * rx;
      for (let x = Math.round(cx - dx); x <= Math.round(cx + dx); x++) {
        this.sp(x, y, c);
      }
    }
  }

  /** Filled triangle (three vertices). */
  ft(x0, y0, x1, y1, x2, y2, c) {
    let pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x2, y: y2 }]
      .sort((a, b) => a.y - b.y);
    let [A, B, C] = pts;
    for (let y = A.y; y <= C.y; y++) {
      let xa, xb;
      if (y < B.y) {
        xa = A.x + (B.x - A.x) * (y - A.y) / (B.y - A.y || 1);
        xb = A.x + (C.x - A.x) * (y - A.y) / (C.y - A.y || 1);
      } else {
        xa = B.x + (C.x - B.x) * (y - B.y) / (C.y - B.y || 1);
        xb = A.x + (C.x - A.x) * (y - A.y) / (C.y - A.y || 1);
      }
      if (xa > xb) [xa, xb] = [xb, xa];
      for (let x = Math.floor(xa); x <= Math.ceil(xb); x++) this.sp(x, y, c);
    }
  }

  /** Filled horizontal line from x0 to x1 (inclusive). */
  hline(x0, x1, y, c) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    for (let x = x0; x <= x1; x++) this.sp(x, y, c);
  }

  /* ---- Converted image loading (tools/png2pixel.mjs output) ---- */

  /**
   * Decode an RLE string produced by tools/png2pixel.mjs.
   * Format: letter = palette index (A-Z → 0-25, a-z → 26-51),
   * followed by decimal digits = run length.
   * @returns {Uint8Array} flat palette-index array
   */
  static decodeRLE(str) {
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

  /**
   * Create a PixelBuffer pre-loaded with a converted image.
   * @param {{w: number, h: number, palette: string[], data: string}} img
   */
  static fromImage(img) {
    const pb = new PixelBuffer(img.w, img.h, img.palette);
    pb.buf.set(PixelBuffer.decodeRLE(img.data));
    return pb;
  }

  /**
   * Paste a converted image into this buffer at (dx, dy).
   * Image palette indices are written as-is — the image is expected to
   * share this buffer's palette (or pass opts.map to translate).
   *
   * @param {{w: number, h: number, palette?: string[], data: string}} img
   * @param {number} [dx=0]
   * @param {number} [dy=0]
   * @param {Object} [opts]
   * @param {number} [opts.transparent] — image index to skip; defaults to
   *   the image palette's 'none' entry if present, else nothing is skipped
   * @param {number[]} [opts.map] — translate image index → buffer index
   */
  blit(img, dx, dy, opts) {
    dx = dx || 0; dy = dy || 0; opts = opts || {};
    let skip = opts.transparent;
    if (skip === undefined && img.palette) skip = img.palette.indexOf('none');
    const src = PixelBuffer.decodeRLE(img.data);
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        const c = src[y * img.w + x];
        if (c === skip) continue;
        this.sp(dx + x, dy + y, opts.map ? opts.map[c] : c);
      }
    }
  }

  /* ---- SVG output ---- */

  /**
   * Render the buffer to an SVG element using RLE-compressed <rect> elements.
   *
   * @param {SVGElement} svgEl — target SVG element (innerHTML will be replaced)
   * @param {Object} [opts] — optional layer configuration
   * @param {string[]} [opts.layers] — named layer IDs (rendered after default layer)
   * @param {function(number, number, number): string|null} [opts.classify]
   *   Called for each pixel run with (x, y, bufferIndex).
   *   Return a layer name to assign the run to that layer, or null for default.
   */
  toSVG(svgEl, opts) {
    const W = this.W, H = this.H, buf = this.buf, P = this.P;

    if (!opts || !opts.layers) {
      // Fast path: no layers
      let html = '<g>';
      for (let y = 0; y < H; y++) {
        let x = 0;
        while (x < W) {
          let c = buf[y * W + x], run = 1;
          while (x + run < W && buf[y * W + x + run] === c) run++;
          html += '<rect x="' + x + '" y="' + y + '" width="' + run
            + '" height="1" fill="' + P[c] + '"/>';
          x += run;
        }
      }
      html += '</g>';
      svgEl.innerHTML = html;
      return;
    }

    // Layered path
    const layerNames = opts.layers;
    const classify = opts.classify;
    const bins = { _default: '' };
    for (let name of layerNames) bins[name] = '';

    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        let c = buf[y * W + x], run = 1;
        while (x + run < W && buf[y * W + x + run] === c) run++;
        let r = '<rect x="' + x + '" y="' + y + '" width="' + run
          + '" height="1" fill="' + P[c] + '"/>';

        // Classify by checking each pixel in the run
        let layer = null;
        for (let wx = x; wx < x + run; wx++) {
          let l = classify(wx, y, y * W + wx);
          if (l) { layer = l; break; }
        }
        bins[layer || '_default'] += r;
        x += run;
      }
    }

    let html = '<g>' + bins._default + '</g>';
    for (let name of layerNames) {
      html += '<g id="' + name + '">' + bins[name] + '</g>';
    }
    svgEl.innerHTML = html;
  }
}

// Node (tooling/tests) — no effect in the browser
if (typeof module !== 'undefined' && module.exports) module.exports = { PixelBuffer };
