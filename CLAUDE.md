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
- `shared/scene-ui.css` — Shared audio panel & back button styles
- `shared/scene-ui.js` — Shared audio control logic (`initSceneAudio()` API)
- `shared/pixel.js` — Shared pixel buffer toolkit (`PixelBuffer` class) for pixel-art scenes
- `templates/scene.html` — Scene HTML template with standardized structure
- `templates/card-snippet.html` — Index page card template
- `.claude/commands/new-scene.md` — `/new-scene` slash command
- `.claude/commands/refine-scene.md` — `/refine-scene` slash command
- `.claude/commands/scene-audit.md` — `/scene-audit` slash command
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
```

### Scene Creation System

Slash commands and templates for creating new pixel-art scenes with consistent quality.

#### Commands

- **`/new-scene "file-name" "Title" "description"`** — Full scene creation workflow. Orchestrates sub-agents for scaffold, palette, rendering, animation, audio, preview card, and quality review.
- **`/refine-scene file-name "feedback"`** — Apply visual/audio feedback after user review. Categorizes feedback and makes targeted edits.
- **`/scene-audit file-name`** — Quality audit against the project's checklist. Use `all` to audit every scene.

#### Templates (`templates/`)

- **`templates/scene.html`** — Complete scene HTML template with standardized structure, section comments, and documented patterns for each section (palette, drawing, animation, audio).
- **`templates/card-snippet.html`** — Index page card template with placeholder SVG.

#### Standard Scene Structure

New pixel-art scenes follow this file structure:
```
<style>            — scene-specific CSS, particle @keyframes
<svg id="scene">   — target SVG (320×180 viewBox)
<script pixel.js>  — shared pixel buffer
<script>           — scene code in standard section order:
  CONFIG           — dimensions, palette (32 colours)
  PIXEL BUFFER     — PixelBuffer instance + local wrappers
  DRAWING HELPERS  — reusable functions with depth parameter
  PAINT SCENE      — depth-layered rendering (sky→celestial→distant→far→ground→light→texture→mid→detail→near)
  SVG RENDER       — pb.toSVG() with optional layers
  ANIMATIONS       — requestAnimationFrame loop
  AUDIO            — Web Audio procedural sound
  INIT             — paintScene + render + startAnimations
<script scene-ui>  — shared audio UI
<script>           — initSceneAudio() call
```

---

## Development Method: PIV Loop

This project uses the **PIV Loop** (Plan → Implement → Validate → Verify) methodology for structured, focused development.

### Loop Table

| Loop | Goal | Status | Plan | Report |
|------|------|--------|------|--------|
| L1 | Extract `shared/pixel.js` from snowy-forest | ✅ Done | — | — |
| L2 | Create scene templates and `/new-scene` skill | ✅ Done | — | — |
| L3 | Create 8 sub-agents for scene creation | ✅ Done | — | — |
| L4 | Test scene creation system with first new scene | 未着手 | `docs/plan-L4.md` | — |
| L5 | Implement missing roadmap features (OGP, screenshots) | 未着手 | `docs/plan-L5.md` | — |

**Status values**: `未着手` → `計画完了` → `進行中` → `✅ Done`

### PIV Loop Rules

1. **Plan**: Write `docs/plan-LN.md` before implementation. Define goal, scope, Acceptance Criteria, and implementation steps.
2. **Implement**: Follow the plan exactly. Do NOT implement anything outside the plan scope.
3. **Validate**: Run manual tests (visual browser check) and verify Acceptance Criteria.
4. **Verify**: Write `docs/validation-report-LN.md` and confirm the loop is complete.

**Important discipline rules:**
- **1 loop = 1 goal** — No scope creep
- **Incidental fixes go to a new loop** — Don't fix unrelated bugs in the same loop
- **Ambiguities stay as TODO comments** — Don't guess at unclear requirements

### Dynamic Loop Addition

During implementation, if new work is discovered that **doesn't fit the current plan**, use `/add-loop` to create a new loop:

```
/add-loop "brief goal" "rationale for creating new loop"
```

This will:
1. Prompt you to choose insertion position (after current loop, or after specific loop)
2. Create a skeleton `docs/plan-LN.md` and add to the loop table
3. Update CLAUDE.md automatically

**When to add a loop:**
- Discovering that a prerequisite task is necessary before current loop
- Finding scope creep that should be deferred to a dedicated loop
- Identifying a bug/issue severe enough to require immediate attention
- Realizing the current loop is becoming too complex (split it)

### Future Roadmap

Planned features in recommended implementation order:

1. ~~**Shared code extraction**~~ — Done. Shared UI code extracted into `shared/scene-ui.css` and `shared/scene-ui.js`
2. ~~**Scene template & creation system**~~ — Done. Templates, `/new-scene`, `/refine-scene`, `/scene-audit` commands
3. **OGP meta tags** — Add Open Graph / Twitter Card meta tags to each scene for link previews on social media
4. **Screenshot capture** — SVG → Canvas → PNG conversion using native browser APIs (no library needed); add camera button to UI panel
5. **SNS sharing** — Web Share API (mobile) with X/Twitter intent URL fallback (desktop); share button in UI panel

### New Scene Checklist

When adding a new scene (automated by `/new-scene`):

- [ ] Set `lang="en"` and title format `<Name> — Chill Scenes`
- [ ] Include back button and audio panel HTML, load `shared/scene-ui.css`, `shared/pixel.js`, and `shared/scene-ui.js`, call `initSceneAudio()`
- [ ] 32-colour palette with semantic comments, grouped by purpose
- [ ] `paintScene()` follows standard depth order
- [ ] `prefers-reduced-motion` respected in animations
- [ ] `stopAudio()` clears all timers and closes AudioContext
- [ ] Add card with preview SVG to `index.html` grid
- [ ] Add OGP meta tags in `<head>` (once implemented)
- [ ] Update this file's Files list and Architecture section
- [ ] Add clean URL route in `vercel.json`

### Architecture Decision: Build Tool

Current approach: **vanilla HTML/CSS/JS with no build step**. Each scene is an HTML file that loads shared UI from `shared/` via standard `<link>` and `<script src>` tags.

If maintainability becomes an issue in the future, consider:
- **Option**: Introduce Vite as a lightweight build tool for module imports, HMR, and bundling — adds `node_modules`/`package.json` but output remains static HTML
