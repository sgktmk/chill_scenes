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
- `chill-mart.html` — "Chill Mart" scene (late-night convenience store with sliding doors and customers)
- `orchestra.html` — "Orchestra" scene (concert hall tuning up: 28 cutout musicians, moving bows, open-string audio)
- `shared/scene-ui.css` — Shared audio panel & back button styles
- `shared/scene-ui.js` — Shared audio control logic (`initSceneAudio()` API)
- `shared/pixel.js` — Shared pixel buffer toolkit (`PixelBuffer` class) for pixel-art scenes
- `shared/cycle.js` — Day-night cycle keyframe interpolation engine (`createCycle()`)
- `shared/audio-kit.js` — Procedural Web Audio boilerplate (`createAudioEngine()`)
- `shared/sprite.js` — Sprite runtime for cutout parts (`createSprite()`/`createSprites()`: move, state swap, flip, hide)
- `tools/png2pixel.mjs` — PNG → PixelBuffer data converter (zero-dependency Node script)
- `tools/cutout.mjs` — Splits refs material into background + moving-part sprites sharing one palette
- `tools/lib/png.mjs` — Shared PNG decode/encode, quantization, and RLE library for the tools
- `tools/selftest.mjs` — Zero-dependency smoke test for the conversion tooling (`node tools/selftest.mjs`)
- `tools/screenshot.sh` — Headless Chromium scene capture for visual verification
- `tools/thumbs.sh` — Regenerates landing-page thumbnails from real scene captures
- `assets/thumbs/` — Generated scene thumbnails shown on the landing page
- `templates/scene-template.html` — Runnable boilerplate for new pixel-art scenes
- `refs/` — Per-scene reference material (`<scene>/base.png` + `spec.md`); `refs/_template/spec.md` is the blank spec form
- `refs/orchestra/split.mjs` — One-off refs builder for the Orchestra scene (source render → 160×144 `base.png` + `bg.png` + one part PNG per musician, bow, and moving limb)
- `docs/scene-workflow.md` — Image-to-scene workflow manual (Japanese, for the repo owner)
- `.claude/skills/port-scene/` — Claude Code skill: checklist for porting a reference image into a scene
- `vercel.json` — Vercel routing config

## Architecture

### Landing Page (`index.html`)

A simple static hub page with card links to each scene. No JavaScript. Dark theme with warm orange accents matching the scene UI. Card thumbnails are real captures of the scenes (`assets/thumbs/<scene>.png`, regenerated with `tools/thumbs.sh`) shown with `object-fit: cover` — never hand-redrawn previews.

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

### Chill Mart Scene (`chill-mart.html`)

Single self-contained HTML file, 256×192 (4:3) fixed night scene built from
`refs/chill-mart/` with the layered cutout pipeline (first scene to use it).

#### Visual Elements

- Background from `base.png` via `tools/cutout.mjs`; 32-colour unified palette
- Sliding automatic doors: two mask-cutout sprites (`mask-10-door_l` /
  `mask-20-door_r`) inside an SVG clipPath over the doorway, so opening
  panels retract into the walls. No parts/bg images were provided (mask
  fallback experiment): the doorway interior behind the doors is rebuilt at
  load time by blitting the glass-door sprites back into the background and
  erasing their stiles/handles with neighbouring glass columns
- Procedural pixel customers (10×22, front/back/side views × 2 walk frames,
  3 outfits, drop shadow) arrive every 1-3 minutes. Movement follows the
  terrain: along the road at the bottom, straight up the parking-lot aisle
  (back view) to the door, chime, step inside; on leaving they walk straight
  down (front view) then turn left/right along the road. Rare passers-by
  cross along the road without entering
- Pole sign bulb chase (two alternating CSS phase groups) + occasional
  fluorescent stutter of the whole sign; stars twinkle in three phase groups
- Debug URL params: `?pose=open` holds the doors open, `?walk=1` places a
  customer at the door, `?visit=1` triggers the first visit after 2 s

#### Audio System

- Procedural Web Audio API (no audio files)
- Soft bandpassed night wind with slow gusts; 118/236 Hz sine hum
  (signage / vending machines); cricket bursts every few seconds
- Distant car pass-bys (brown noise through a sweeping lowpass, 30-90 s)
- Two-tone entrance chime tied to the door events

### Orchestra Scene (`orchestra.html`)

Single self-contained HTML file, 160×144 (Game Boy, 10:9), a fixed indoor
scene built from `refs/orchestra/` with the cutout pipeline.
The reference render was an 8.26×-upscaled 160×144 artwork, so `base.png`
is the artwork restored to its native resolution (16 colours).

#### Visual Elements

- Background from `bg.png` — the empty stage, with the stationary props
  (harp, timpani, bass drum, music stand, organ façade) left in place
- **28 musicians, each its own cutout sprite**, plus **11 bow sprites** and
  **5 limb sprites** (two trombone slides, the timpanist's mallets, the bass
  drum beater, the harpist's hand) — 44 parts in all.
  `refs/orchestra/split.mjs` builds them from `base.png`: faces (bright
  ovals) seed a geodesic split of the figure mask, so each player gets a
  tight silhouette; bows are detected as the long thin bright streak inside
  a player; limbs are cut by hand-placed rects (`subs`). Everything split
  out is erased from the body image underneath, so a moving bow reveals the
  torso behind it. The trombones are drawn bell-on, so the gold ring on the
  chest is the bell mouth and stays put; the slide is the dotted tube
  running down-left out of it to the knob at its end, listed pixel by pixel
  (`subs.pixels`) because it is a thin dotted diagonal touching the player's
  hand — listed pixels are claimed even from a neighbour or the background
- **The figures themselves never move.** Translating a whole figure reads as
  the chair sliding with it, so the musicians stay exactly where the
  reference put them and only the split-out parts move:
  - bow: up to ±2px **along its own principal axis** (computed at load time
    from the bow sprite's pixels) at a roughly constant bow speed, so a
    longer stroke is a slower one
  - trombone slide: pulls 0–2px out of the bell (down-left) and back while
    the note is held
  - mallets / beater: lift, land, rebound — the drum sounds on the landing
  - harp hand: flicks 1px off the string on each pluck
- One state machine drives both the sprites and the audio: a player is
  "playing" ⇔ their part is moving ⇔ a note is sounding. String players rest
  only briefly, so 4–8 of the 11 bows are in motion at any moment; ~8–10
  players sound at once, swelling to ~15–20 when the reference A goes out.
  The timpanist and harpist repeat their attack every 0.5–1.5 s within one
  turn (tapping the head, working down the strings)
- Debug URL params: `?at=<seconds>` fast-forwards the tuning session and
  holds that frame, `?pose=bow` freezes every bow, slide and mallet at full
  travel, `?pose=lift` shifts every musician up-left to expose the
  background behind them, `?pose=home` holds the reference pose, `?a=1`
  sounds the reference A at once
- `prefers-reduced-motion` holds every moving part at its reference position

#### Audio System

- Procedural Web Audio API (no audio files). All voices run through a
  procedurally generated hall reverb (noise-burst impulse response) and a
  soft limiter, and are panned by the player's x position on stage
- Bowed open strings: two detuned sawtooths + a sine body through a
  lowpass, soft attack, bow-pressure waver, **no vibrato** (open strings).
  ±13 cents of detune per note gives the beating of a real tuning
- Pitches are the instruments' open strings — violin G3/D4/A4/E5, viola
  C3/G3/D4/A4, cello C2/G2/D3/A3, bass E1/A1/D2/G2, winds around A4 — with
  **A weighted heaviest**, and occasional open-fifth double stops
- The oboe's reference A4 (bandpassed reed timbre, longer and louder) every
  ~40–75 s, answered by the rest of the stage
- Harp plucks, soft tuned timpani taps and the odd bass drum thud — each
  struck note delayed 0.2 s so it lands with the mallet — plus room sounds
  (chair creaks, page turns, a distant cough) over a quiet hall-air bed

## Creating New Scenes (image-to-scene pipeline)

New pixel-art scenes are built from reference images, not drawn procedurally
by hand. The composition comes from `refs/<scene>/base.png`; each moving
object is provided as its own full-canvas transparent PNG in
`refs/<scene>/parts/NN-name[@state].png` (NN = z-order, `@state` = extra
frames like a door's open state), optionally with `bg.png` (background
behind the parts). Motion and audio are specified in `refs/<scene>/spec.md`
and implemented on top. Full manual: `docs/scene-workflow.md`. Claude Code
should follow the `port-scene` skill (`.claude/skills/port-scene/SKILL.md`)
when asked to build a scene from refs.

```bash
# refs → background + part sprites on ONE unified palette, with
# verification previews (Read them to check the split quality)
node tools/cutout.mjs refs/<scene> -w 240 -h 160 -o /tmp/img.js --preview /tmp/prev

# single flat image (scene with no moving parts)
node tools/png2pixel.mjs refs/<scene>/base.png -w 240 -h 160

# verify a scene at a frozen day-night phase (?t=) — local files are served
# via a temporary http server (root-absolute /shared/ paths break file://)
tools/screenshot.sh "<scene>.html?t=0.3" /tmp/day.png

# smoke-test the tooling after touching tools/ or shared/
node tools/selftest.mjs
```

Key invariants:

- The reference image is the source of truth for composition; procedural
  drawing is only for dynamic elements (sun/moon, particles, touch-ups).
- **Motion is structural, never faked**: anything that moves, appears, or
  changes shape is a cutout part rendered via `createSprites()`
  (shared/sprite.js) with real background behind it — never implemented by
  nudging/blurring pixels of the flat background image. If a part image is
  missing from refs, ask the user instead of improvising.
- Converted data loads via `PixelBuffer.fromImage()` / `pb.blit()`; palette
  entry `'none'` (index 0 when the source has transparency) marks
  transparent sky for dynamic sky bands. cutout output (`<NAME>_BG` /
  `<NAME>_PARTS`) shares a single palette, and every part state carries its
  scene position (`ox`, `oy`).
- Every scene supports `?t=<0-1>` to freeze the cycle phase (built into
  `createCycle()`), plus a debug URL param per part pose / rare event,
  enabling reproducible screenshot verification of every state.

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

#### Sprite API (`shared/sprite.js`)

Structural motion for `tools/cutout.mjs` parts (requires `shared/pixel.js`).
Each sprite is an SVG group; a sprite's `(x, y)` is the scene position of its
default state's top-left corner, and other states keep their authored offset,
so swapping frames never needs re-positioning.

```javascript
const sprites = createSprites(parentG, SCENE_PARTS); // all parts, z-sorted
sprites.door.setState('open');   // frame swap — background shows behind
sprites.boat.moveTo(x, y);       // scene coordinates (moveBy, moveHome too)
sprites.bird.setFlip(true).hide();
const s = createSprite(parentG, imgOrStates, { initial, x, y }); // single
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
- [ ] Convert with `tools/cutout.mjs` when anything moves; verify the `--preview` PNGs (clean bg, complete parts)
- [ ] Implement all moving objects as `createSprites()` sprites — never by nudging pixels of the flat image
- [ ] Support `?t=` phase freeze and verify day/dusk/night with `tools/screenshot.sh`
- [ ] Add a debug URL param per part pose / rare event and screenshot-verify each state
- [ ] Add the scene to `tools/thumbs.sh`, run it, and add a card with the generated `assets/thumbs/<scene>.png` to `index.html`
- [ ] Add OGP meta tags in `<head>` (once implemented)
- [ ] Update this file's Files list and Architecture section
- [ ] No `vercel.json` change needed (`cleanUrls` is global)

### Architecture Decision: Build Tool

Current approach: **vanilla HTML/CSS/JS with no build step**. Each scene is an HTML file that loads shared UI from `shared/` via standard `<link>` and `<script src>` tags.

If maintainability becomes an issue in the future, consider:
- **Option**: Introduce Vite as a lightweight build tool for module imports, HMR, and bundling — adds `node_modules`/`package.json` but output remains static HTML
