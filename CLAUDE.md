# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A collection of relaxing animated web scenes. Pure vanilla HTML/CSS/JavaScript with no dependencies, no build system, and no package manager. `index.html` is the landing page hub; each scene lives in its own self-contained HTML file.

## Running Locally

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Or open `index.html` directly in a browser. No build step required.

## Deployment

Hosted on Vercel as a static site. `vercel.json` enables clean URLs so `/seascape` serves the scene without the `.html` extension.

## Files

- `index.html` — Landing page hub linking to all scenes
- `seascape.html` — "Seascape" scene (day-night cycle over the sea)
- `campfire.html` — "Campfire" scene (pixel-art campfire under starry sky)
- `snowy-forest.html` — "Snowy Forest" scene (moonlit winter forest at night)
- `rice-terrace.html` — "Rice Terraces" scene (GBA-style terraced paddies below Mt. Fuji with a day-night cycle)
- `shared/scene-ui.css` — Shared audio panel & back button styles
- `shared/scene-ui.js` — Shared audio control logic (`initSceneAudio()` API)
- `shared/pixel.js` — Shared pixel buffer toolkit (`PixelBuffer` class) for pixel-art scenes
- `shared/cycle.js` — Day-night cycle keyframe interpolation engine (`createCycle()`)
- `shared/audio-kit.js` — Procedural Web Audio boilerplate (`createAudioEngine()`)
- `tools/png2pixel.mjs` — PNG → PixelBuffer data converter (zero-dependency Node script)
- `tools/screenshot.sh` — Headless Chromium scene capture for visual verification
- `templates/scene-template.html` — Runnable boilerplate for new pixel-art scenes
- `refs/` — Per-scene reference material (`<scene>/base.png` + `spec.md`); `refs/_template/spec.md` is the blank spec form
- `docs/scene-workflow.md` — Image-to-scene workflow manual (Japanese, for the repo owner)
- `.claude/skills/port-scene/` — Claude Code skill: checklist for porting a reference image into a scene
- `vercel.json` — Vercel routing config

## Architecture

### Landing Page (`index.html`)

A simple static hub page with card links to each scene. No JavaScript. Dark theme with warm orange accents matching the scene UI.

### Seascape Scene (`seascape.html`)

Everything lives in a single HTML file (~850 lines). The `<script>` block contains several self-contained systems:

### Day-Night Cycle (core timing)

- `CYCLE = 180` — seconds for one full day-night loop
- `phase()` returns 0.0–1.0 representing position in the day (0.0 = sunrise, 0.62 = sunset, 0.78 = night, 1.0 = sunrise again)
- 11-keyframe color interpolation (`KF` array + `interpKF()`) drives sky, sea, wave, foam, and horizon colors
- `lerp()` interpolates between hex color pairs

### SVG Visual Structure

- Sky: 8-stop vertical linear gradient (`#skyG`)
- Sea: 6-stop vertical linear gradient (`#seaG`)
- Horizon at `H = 85` in a `BASE_W=320 × BASE_H=200` viewBox
- Sun arcs left-to-right (x 30→290); moon arcs right-to-left during night
- `shape-rendering="crispEdges"` for pixel-art aesthetic

### Ship System (IIFE)

- 4 types: fishing, fishing2, cargo, ferry — each with distinct dimensions/speeds
- 3 depth lanes (far/mid/near) with different scales
- Procedurally drawn with SVG `<rect>` elements into `#shipLayer`
- Navigation lights respond to night level; spawn rate reduces at night

### Audio System (IIFE)

- All sounds procedurally generated via Web Audio API (no audio files)
- Layered channels: brown noise, wave surges, foam hiss, deep rumble, wind
- Seabird calls (daytime) and cricket chirps (nighttime) tied to phase
- Volume slider + mute button in fixed-position UI panel

### Sparkles & Foam Particles (IIFEs)

- Sparkles: light reflections on water, color/brightness varies with time of day
- Foam: physics-simulated spray particles with gravity and fade

### Responsive Layout

- `initResponsive()` adjusts SVG viewBox for portrait vs landscape
- Portrait mode narrows the view and adds extra sky; landscape shows full width

### Campfire Scene (`campfire.html`)

Single self-contained HTML file with CSS animations and procedural audio.

#### Visual Elements (SVG + CSS)

- 426×240 viewBox with `crispEdges` pixel-art rendering
- Night sky with twinkling stars (6 animation variants)
- Shooting stars spawned via JS with Web Animation API
- Distant tree silhouettes, stone ring, and crossed logs
- Multi-layered flame: base, mid, top, tip — each with independent CSS animations
- Sparks rise from the fire with individual trajectories
- Smoke wisps that expand and fade upward
- Radial glow on ground and surrounding stones

#### Audio System

- Procedural Web Audio API (no audio files)
- Brown noise layers for low rumble and mid warmth
- Crackle buffers with random sharp spike transients
- Volume slider + mute toggle in fixed UI panel

### Snowy Forest Scene (`snowy-forest.html`)

Single self-contained HTML file with a JS pixel-buffer renderer and CSS snow animations.

#### Visual Elements (SVG pixel buffer)

- 320×180 viewBox rendered via a 32-colour palette Uint8Array pixel buffer
- Sky rendered as 8-band vertical gradient using palette indices
- Moon with layered ellipses, crater detail, and scattered halo pixels (JS shimmer animation)
- 70 procedurally placed stars with per-star twinkle animation driven by `requestAnimationFrame`
- Distant sine-wave mountains and 3 depth layers of conifer trees (far / mid / near)
- Trees drawn with `ft()` triangles per tier, with snow accumulation and draping at edges
- Ground snow with surface highlight, moon reflection, texture noise, and drift mounds
- Animal tracks in centre clearing
- Two CSS-animated SVG snow overlay layers (far: 55 small slow flakes; near: 30 larger faster flakes)
- Back button and inline audio panel with blue-toned styling to match the winter palette

#### Audio System

- Procedural Web Audio API (no audio files)
- Bandpass-filtered white noise for low wind howl, slowly modulated via recursive `setTimeout`
- Highpass-filtered white noise layer for high-frequency branch whisper
- Low sine drone (48 Hz) for cold atmosphere depth
- Synthesised owl hoots (two-note descending oscillator pair) scheduled every 10–30 s
- Volume master gain; start/stop via button toggle

### Rice Terrace Scene (`rice-terrace.html`)

Single self-contained HTML file rendered at the GBA native resolution (240×160 viewBox) using the shared `PixelBuffer`.

#### Visual Elements

- Static terrain painted once into a 27-colour palette buffer (palette index 0 = `'none'` for transparent sky); day-night look achieved dynamically without repainting
- Mt. Fuji in the upper right: concave slopes, zigzag snowline, snow gullies clipped to the snow boundary
- 7 stepped rice terraces seen from the side, each with water surface, grass lip (azemichi), dirt retaining wall, and rice seedling rows following the terrace contours; far hills and valley haze at the horizon; lone tree on a bund
- 3-minute day-night cycle (`CYCLE = 180`): 10-keyframe interpolation (`KF` array) drives 11 sky band colours, terrain `brightness()/saturate()` CSS filter, star opacity, and cloud tint
- Sun arcs left→right (phase 0–0.62) with elevation-dependent colour; moon arcs right→left through the night; both occluded by terrain when below the horizon
- Paddy water reflects the sky: water pixels RLE-compressed into a fill-inheriting overlay group whose fill tracks the horizon keyframe colour
- Twinkling stars (CSS), two drifting pixel clouds, fireflies at deep night
- Rare egret (シラサギ) event: pixel-sprite bird flies in from the right, stands/pecks in a paddy with water ripples, then flies off; daytime-biased random scheduling
- Debug URL params: `?t=0.25` freezes the phase, `?egret=1` forces the egret event

#### Audio System

- Procedural Web Audio API (no audio files)
- Bandpassed noise wind body + highpassed rustle layer, swelling together via recursive `setTimeout` gusts
- Insects: cricket bursts and detuned bell-cricket rings, louder at night (reads `curNight` from the visual loop)
- Black kite (トンビ) "pee-hyororo" call: sine glide 1480→1580→920 Hz with 11 Hz vibrato onset, daytime only, occasional distant reply
- Faint frog chorus at night (sawtooth through bandpass)

## Creating New Scenes (image-to-scene pipeline)

New pixel-art scenes are built from a reference image, not drawn procedurally
by hand. The composition comes from `refs/<scene>/base.png`, converted to
palette-indexed pixel data; motion and audio are specified in
`refs/<scene>/spec.md` and implemented on top. Full manual:
`docs/scene-workflow.md`. Claude Code should follow the `port-scene` skill
(`.claude/skills/port-scene/SKILL.md`) when asked to build a scene from refs.

```bash
# image → JS data ({ w, h, palette, data }, ≤32 colours, RLE-encoded)
node tools/png2pixel.mjs refs/<scene>/base.png -w 240 -h 160

# verify a scene at a frozen day-night phase (?t=) — local files are served
# via a temporary http server (root-absolute /shared/ paths break file://)
tools/screenshot.sh "<scene>.html?t=0.3" /tmp/day.png
```

Key invariants:

- The reference image is the source of truth for composition; procedural
  drawing is only for dynamic elements (sun/moon, sprites, particles).
- Converted data loads via `PixelBuffer.fromImage()` / `pb.blit()`; palette
  entry `'none'` (index 0 when the source has transparency) marks
  transparent sky for dynamic sky bands.
- Every scene supports `?t=<0-1>` to freeze the cycle phase (built into
  `createCycle()`), enabling reproducible screenshot verification.

## Maintenance Notes

### Shared Code (`shared/`)

Common components are extracted into shared files loaded by each scene:

- **`shared/scene-ui.css`** — Audio panel (`.ap`, `.ab`, `.vs`, `.vl`, `.wi`) and back button (`.back`) styles
- **`shared/scene-ui.js`** — `initSceneAudio({ onStart, onStop, onVolumeChange })` callback-based API for audio toggle and volume control
- **`shared/pixel.js`** — `PixelBuffer` class for palette-indexed pixel-art rendering

Each scene provides its own audio init/control logic via callbacks. The shared JS handles DOM element queries, button class toggles, emoji updates, and volume label updates.

#### PixelBuffer API (`shared/pixel.js`)

`PixelBuffer` provides a palette-indexed pixel buffer with drawing primitives, a seeded PRNG, and RLE-compressed SVG output with optional named layers.

```javascript
const pb = new PixelBuffer(320, 180, palette);
pb.seed(12345);         // seeded PRNG for reproducible scenes
pb.clear(0);            // fill buffer with palette index 0
pb.sp(x, y, c);         // set pixel
pb.gp(x, y);            // get pixel (returns palette index, -1 if OOB)
pb.fr(x, y, w, h, c);   // filled rect
pb.fe(cx, cy, rx, ry, c); // filled ellipse
pb.ft(x0,y0, x1,y1, x2,y2, c); // filled triangle
pb.hline(x0, x1, y, c); // horizontal line
pb.rn();                // random float [0,1)
pb.ri(a, b);            // random int [a,b] inclusive
pb.toSVG(svgEl);        // flush to SVG (simple)
pb.toSVG(svgEl, {       // flush with named layers
  layers: ['moon', 'stars'],
  classify(x, y, idx) { ... }
});

// Converted images (tools/png2pixel.mjs output: { w, h, palette, data })
PixelBuffer.fromImage(img);      // new buffer pre-loaded with the image
pb.blit(img, dx, dy, opts);      // paste ('none' entries skipped; opts.map remaps indices)
PixelBuffer.decodeRLE(img.data); // raw Uint8Array of palette indices (e.g. masks)
```

#### Cycle API (`shared/cycle.js`)

`createCycle({ cycle, startOffset, keyframes })` returns `{ phase, sample, mixRgb, ... }`.
Keyframes are `{ p: 0.0-1.0, ...channels }`; channels may be hex colours,
numbers, or arrays of either — `sample(p)` interpolates them all (colours
come back as `'rgb(r,g,b)'`). The loop closes automatically (p=1.0 mirrors
the first keyframe) and `?t=` in the URL freezes `phase()` for debugging.

#### Audio Kit API (`shared/audio-kit.js`)

`createAudioEngine(vol)` wraps AudioContext + master gain and provides:
`whiteNoiseSrc()` / `brownNoiseSrc()`, `filteredNoise({ type, freq, Q, gain, brown })`
(noise → biquad → gain → master, started), `ramp(gainNode, target, sec)`,
`schedule(fn, minMs, maxMs)` (tracked random-interval rescheduling; fn may
return the next delay), `setVolume(0-100)`, and `stop()` (clears timers,
closes the context). Sound design stays in each scene; the kit only removes
plumbing. Wire it to `initSceneAudio()` as shown in `templates/scene-template.html`.

### Future Roadmap

Planned features in recommended implementation order:

1. ~~**Shared code extraction**~~ — Done. Shared UI code extracted into `shared/scene-ui.css` and `shared/scene-ui.js`
2. **OGP meta tags** — Add Open Graph / Twitter Card meta tags to each scene for link previews on social media
3. **Screenshot capture** — SVG → Canvas → PNG conversion using native browser APIs (no library needed); add camera button to UI panel
4. **SNS sharing** — Web Share API (mobile) with X/Twitter intent URL fallback (desktop); share button in UI panel
5. ~~**Scene template**~~ — Done. `templates/scene-template.html` + image-to-scene pipeline (`tools/`, `shared/cycle.js`, `shared/audio-kit.js`, `docs/scene-workflow.md`)
6. **Migrate existing scenes to shared modules** — Optional: port seascape/rice-terrace day-night code to `shared/cycle.js` and audio plumbing to `shared/audio-kit.js` (currently only new scenes use them)

### New Scene Checklist

When adding a new scene (start from `templates/scene-template.html`; for
image-based scenes follow `docs/scene-workflow.md` / the `port-scene` skill):

- [ ] Set `lang="en"` and title format `<Name> — Chill Scenes`
- [ ] Include back button and audio panel HTML, load `shared/scene-ui.css` and `shared/scene-ui.js`, call `initSceneAudio()`
- [ ] Support `?t=` phase freeze and verify day/dusk/night with `tools/screenshot.sh`
- [ ] Add card with preview SVG to `index.html` grid
- [ ] Add OGP meta tags in `<head>` (once implemented)
- [ ] Update this file's Files list and Architecture section
- [ ] No `vercel.json` change needed (`cleanUrls` is global)

### Architecture Decision: Build Tool

Current approach: **vanilla HTML/CSS/JS with no build step**. Each scene is an HTML file that loads shared UI from `shared/` via standard `<link>` and `<script src>` tags.

If maintainability becomes an issue in the future, consider:
- **Option**: Introduce Vite as a lightweight build tool for module imports, HMR, and bundling — adds `node_modules`/`package.json` but output remains static HTML
