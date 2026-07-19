/**
 * Shared Sprite runtime — structural motion for cutout parts.
 *
 * Consumes the output of tools/cutout.mjs (<NAME>_PARTS): every moving
 * object is its own SVG group that can move (transform), swap states
 * (door closed → open), flip, and hide — with the real background showing
 * behind it. Never animate by nudging pixels of the flat background.
 *
 * Requires shared/pixel.js (uses PixelBuffer.decodeRLE).
 *
 * Usage:
 *   <g id="partsG"></g>  inside the scene <svg>, above the background
 *
 *   const g = document.getElementById('partsG');
 *   const sprites = createSprites(g, ONSEN_PARTS);   // all parts, z-sorted
 *   sprites.door.setState('open');                   // swap frames
 *   sprites.boat.moveTo(x, y);                       // scene coordinates
 *   sprites.bird.setFlip(true);                      // mirror horizontally
 *   sprites.bird.hide();
 *
 *   // or one sprite from a single image / states object:
 *   const s = createSprite(g, ONSEN_PARTS.door.states);
 *   const c = createSprite(g, CLOUD_IMG);            // {w,h,palette,data}
 *
 * Coordinate model: a sprite's (x, y) is the scene position of its default
 * state's top-left corner. Other states keep their authored offset relative
 * to the default state (cutout.mjs records each state's own ox/oy), so
 * swapping states never needs manual re-positioning.
 */

/**
 * @param {SVGElement} parentEl — group the sprite is appended to
 * @param {Object} statesOrImg — cutout states object ({ base: img, ... })
 *   or a single image { w, h, palette, data } (optionally ox, oy)
 * @param {Object} [opts]
 * @param {string} [opts.initial] — initial state name (default 'base' or first)
 * @param {number} [opts.x] / [opts.y] — initial scene position (default:
 *   the default state's ox/oy, or 0,0 for plain images)
 */
function createSprite(parentEl, statesOrImg, opts) {
  opts = opts || {};
  const states = statesOrImg.data !== undefined ? { base: statesOrImg } : statesOrImg;
  const names = Object.keys(states);
  if (!names.length) throw new Error('createSprite: no states');
  const defName = states.base ? 'base' : names[0];
  const def = states[defName];
  const baseOx = def.ox || 0, baseOy = def.oy || 0;

  const svgNS = 'http://www.w3.org/2000/svg';
  const root = document.createElementNS(svgNS, 'g');

  // Render each state once, at its offset relative to the default state
  const stateEls = {};
  for (const n of names) {
    const img = states[n];
    const sg = document.createElementNS(svgNS, 'g');
    const relX = (img.ox || 0) - baseOx, relY = (img.oy || 0) - baseOy;
    const skip = img.palette.indexOf('none');
    const buf = PixelBuffer.decodeRLE(img.data);
    let html = '';
    for (let y = 0; y < img.h; y++) {
      let x = 0;
      while (x < img.w) {
        const c = buf[y * img.w + x];
        let run = 1;
        while (x + run < img.w && buf[y * img.w + x + run] === c) run++;
        if (c !== skip) {
          html += '<rect x="' + (relX + x) + '" y="' + (relY + y) + '" width="' + run
            + '" height="1" fill="' + img.palette[c] + '"/>';
        }
        x += run;
      }
    }
    sg.innerHTML = html;
    sg.setAttribute('display', 'none');
    root.appendChild(sg);
    stateEls[n] = sg;
  }
  parentEl.appendChild(root);

  const sprite = {
    el: root,
    x: opts.x !== undefined ? opts.x : baseOx,
    y: opts.y !== undefined ? opts.y : baseOy,
    state: null,
    flipped: false,
    visible: true,

    _apply() {
      // Flip mirrors around the default state's box so a flipped sprite
      // stays in place.
      const t = this.flipped
        ? 'translate(' + (this.x + def.w) + ' ' + this.y + ') scale(-1 1)'
        : 'translate(' + this.x + ' ' + this.y + ')';
      root.setAttribute('transform', t);
      root.setAttribute('display', this.visible ? '' : 'none');
      return this;
    },

    /** Switch to another cutout state (frame). */
    setState(n) {
      if (!stateEls[n]) throw new Error('sprite has no state "' + n + '"');
      if (this.state !== n) {
        if (this.state) stateEls[this.state].setAttribute('display', 'none');
        stateEls[n].setAttribute('display', '');
        this.state = n;
      }
      return this;
    },

    /** Move the default state's top-left corner to scene position (x, y). */
    moveTo(x, y) { this.x = x; this.y = y; return this._apply(); },
    moveBy(dx, dy) { return this.moveTo(this.x + dx, this.y + dy); },
    /** Return to the position authored in the reference image. */
    moveHome() { return this.moveTo(baseOx, baseOy); },

    setFlip(f) { this.flipped = !!f; return this._apply(); },
    show() { this.visible = true; return this._apply(); },
    hide() { this.visible = false; return this._apply(); },
    setOpacity(a) { root.setAttribute('opacity', a); return this; },
    remove() { root.remove(); },
  };

  sprite.setState(opts.initial || defName);
  return sprite._apply();
}

/**
 * Instantiate every part of a cutout <NAME>_PARTS object, appended in
 * z-order (far parts first, so near parts draw on top).
 * @returns {Object} name → sprite
 */
function createSprites(parentEl, parts, opts) {
  const out = {};
  const names = Object.keys(parts).sort((a, b) => (parts[a].z || 0) - (parts[b].z || 0));
  for (const n of names) {
    out[n] = createSprite(parentEl, parts[n].states, opts && opts[n]);
  }
  return out;
}

// Node (tooling/tests) — no effect in the browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSprite, createSprites };
}
