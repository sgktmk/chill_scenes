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

Hosted on Vercel as a static site. `vercel.json` enables clean URLs so `/nihonkai_daynight` serves the scene without the `.html` extension.

## Files

- `index.html` — Landing page hub linking to all scenes
- `nihonkai_daynight.html` — "Seascape" scene (day-night cycle over the sea)
- `vercel.json` — Vercel routing config

## Architecture

### Landing Page (`index.html`)

A simple static hub page with card links to each scene. No JavaScript. Dark theme with warm orange accents matching the scene UI.

### Seascape Scene (`nihonkai_daynight.html`)

Everything lives in a single HTML file (~700 lines). The `<script>` block contains several self-contained systems:

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
