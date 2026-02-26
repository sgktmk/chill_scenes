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
- `astronaut-drift.html` — "Astronaut Drift" scene (fixed astronaut with horizontally scrolling pixel-space)
- `shared/scene-ui.css` — Shared audio panel & back button styles
- `shared/scene-ui.js` — Shared audio control logic (`initSceneAudio()` API)
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

### Astronaut Drift Scene (`astronaut-drift.html`)

Single self-contained HTML file focused on side-scrolling space ambience.

#### Visual Elements (SVG + JS)

- 320×180 pixel-art viewBox with crisp-edge rendering
- Astronaut sprite anchored near left-middle for a fixed focal point
- Three star layers (far/mid/near) rendered in duplicated bands and translated for seamless horizontal looping
- Slow parallax speeds per layer to create side-scrolling depth
- Pixel planets and nebula overlays with subtle pulse animation
- Tether line suggests the astronaut is drifting while still attached

#### Audio System

- Procedural Web Audio API ambient drone (no audio files)
- Layered oscillators with gentle low-frequency modulation
- Shared volume slider + mute toggle via `initSceneAudio()`

## Maintenance Notes

### Shared UI Code (`shared/`)

Common UI components are extracted into shared files loaded by each scene:

- **`shared/scene-ui.css`** — Audio panel (`.ap`, `.ab`, `.vs`, `.vl`, `.wi`) and back button (`.back`) styles
- **`shared/scene-ui.js`** — `initSceneAudio({ onStart, onStop, onVolumeChange })` callback-based API for audio toggle and volume control

Each scene provides its own audio init/control logic via callbacks. The shared JS handles DOM element queries, button class toggles, emoji updates, and volume label updates.

### Future Roadmap

Planned features in recommended implementation order:

1. ~~**Shared code extraction**~~ — Done. Shared UI code extracted into `shared/scene-ui.css` and `shared/scene-ui.js`
2. **OGP meta tags** — Add Open Graph / Twitter Card meta tags to each scene for link previews on social media
3. **Screenshot capture** — SVG → Canvas → PNG conversion using native browser APIs (no library needed); add camera button to UI panel
4. **SNS sharing** — Web Share API (mobile) with X/Twitter intent URL fallback (desktop); share button in UI panel
5. **Scene template** — Standardize boilerplate for new scenes

### New Scene Checklist

When adding a new scene:

- [ ] Set `lang="en"` and title format `<Name> — Chill Scenes`
- [ ] Include back button and audio panel HTML, load `shared/scene-ui.css` and `shared/scene-ui.js`, call `initSceneAudio()`
- [ ] Add card with preview SVG to `index.html` grid
- [ ] Add OGP meta tags in `<head>` (once implemented)
- [ ] Update this file's Files list and Architecture section
- [ ] Add clean URL route in `vercel.json`

### Architecture Decision: Build Tool

Current approach: **vanilla HTML/CSS/JS with no build step**. Each scene is an HTML file that loads shared UI from `shared/` via standard `<link>` and `<script src>` tags.

If maintainability becomes an issue in the future, consider:
- **Option**: Introduce Vite as a lightweight build tool for module imports, HMR, and bundling — adds `node_modules`/`package.json` but output remains static HTML
