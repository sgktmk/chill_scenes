---
name: port-scene
description: Port a reference pixel-art image into a new animated chill scene. Use when the user asks to create a scene from refs/<name>/ (base.png + spec.md, optionally layers.json), or to "port" / "移植" an image into a scene.
---

# Port a reference image into an animated scene

Turn `refs/<scene>/` (base.png + spec.md, plus layers.json for partial
animation) into a self-contained scene HTML with motion and procedural
audio. The full human-facing manual is `docs/scene-workflow.md`; this skill
is the executor's checklist.

**Core rule 1: the image is the source of truth for composition.** Never
redraw the composition procedurally by eye — convert it with the tool and
load the data. Procedural drawing is only for *dynamic* elements (sun, moon,
sprites, particles) and small touch-ups.

**Core rule 2: never guess which pixels move.** If the spec asks for part of
the image to move independently (a door, a strap, the view outside a window,
anything behind a foreground object) that part must exist as a layer in
`layers.json` (mask cutout or part sprite). Do NOT estimate regions from the
image by eye, classify pixels by colour, or hard-code guessed coordinates —
that produces fragile fakes. If the material is missing, stop and ask the
user for a `mask-<part>.png` / `part-<name>.png` + `layers.json` entry
instead of improvising.

## Steps

### 1. Validate and understand the material

```bash
node tools/validate-refs.mjs refs/<scene>   # must pass before anything else
```

- Read `refs/<scene>/spec.md` (motion, audio, resolution, day-night choice)
  and `layers.json` if present (layer order = paint order, back to front).
- View `refs/<scene>/base.png` (and part/mask PNGs) with the Read tool to
  understand the composition: where the horizon is, what animates, palette
  mood.
- Look at whichever existing scene (`seascape.html`, `campfire.html`,
  `snowy-forest.html`, `rice-terrace.html`) is closest in spirit — reuse its
  techniques. For layered scenes, `templates/layered-demo.html` +
  `refs/_fixture-train/` is the working reference (window scroll, sliding
  door, swinging strap).

### 2. Convert the image(s)

```bash
# layered scene (layers.json present) — ONE shared palette for all layers:
node tools/png2pixel.mjs --manifest refs/<scene>/layers.json -o /tmp/scene.js

# single-image scene:
node tools/png2pixel.mjs refs/<scene>/base.png -w 240 -h 160 -o /tmp/scene-img.js
# standalone masks, if provided outside the manifest:
node tools/png2pixel.mjs refs/<scene>/mask-water.png -w 240 -h 160 --mask
```

- Match the resolution in spec.md / layers.json (240×160 GBA or 320×180).
- Check the reported colour count. If the palette came out muddy (many
  near-duplicate colours eating the budget), try `--colors 24` or ask the
  user for a cleaner source.
- If the sky is opaque in the image but the scene has a day-night cycle,
  identify the sky palette indices and drop them when blitting (map to
  'none') so dynamic sky bands show through.

### 3. Build the scene

- Copy `templates/scene-template.html` to `<scene>.html` and paste the
  converted data in.
- Set title, viewBox, `#scene-wrap` aspect ratio, and `HOR` (horizon y).
- Layered scenes: `PixelBuffer.sceneToSVG(svgEl, SCENE)` renders one
  `<g id="L-<id>">` per layer in paint order and returns id → element.
  Animate each movable layer with its `transform` attribute, using ONLY
  values from the manifest:
  - `motion: swing` → `rotate(angle px py)` with the layer's `pivot`
  - `motion: slide-*` → `translate(dx dy)` within the range in `motion`
  - `motion: scroll-*` → `translate` looping over the strip's repeat period
  - occlusion is already handled by paint order + cutout holes — never
    simulate it with overlays painted on top.
- Other motion from spec.md:
  - Day-night: tune `createCycle()` keyframes (shared/cycle.js).
  - Water/sky reflection: layered `toSVG({ layers, classify })` +
    fill-inheriting overlay — see rice-terrace.html `buildWaterOverlay()`.
  - Sprites/events: draw with a separate small PixelBuffer or `blit()`.
- Implement audio from spec.md with `createAudioEngine()`
  (shared/audio-kit.js); one-shot voices (birds etc.) follow the oscillator
  + gain-envelope patterns in existing scenes.
- Add a debug URL param for any rare event (like `?egret=1`), and support
  a `?pose=` param that freezes movable layers at a given phase if the
  scene has part animation (see layered-demo.html).

### 4. Verify with screenshots — do not skip

```bash
tools/screenshot.sh "<scene>.html?t=0.3" /tmp/day.png
tools/screenshot.sh "<scene>.html?t=0.62" /tmp/dusk.png
tools/screenshot.sh "<scene>.html?t=0.85" /tmp/night.png
# part animation: capture both extremes of each movable layer
tools/screenshot.sh "<scene>.html?t=0.3&pose=0" /tmp/pose0.png
tools/screenshot.sh "<scene>.html?t=0.3&pose=0.5" /tmp/pose5.png
```

View each with the Read tool and compare against `base.png`:

- Composition and colours at day phase must visually match the reference.
- No broken layering at dusk/night (terrain filter, star opacity, sky bands).
- Movable layers: correct occlusion at both pose extremes (a sliding door
  disappears behind the wall, scenery only shows through apertures, a
  swinging part rotates around its pivot without drifting).
- Iterate until it matches; this loop is what guarantees quality.

### 5. Integrate

- Add a card with preview SVG to `index.html` (copy an existing card).
- Update `CLAUDE.md`: Files list + Architecture section for the new scene.
- `vercel.json` needs no change (`cleanUrls` is global).
- Run through the checklist at the bottom of `docs/scene-workflow.md`.
