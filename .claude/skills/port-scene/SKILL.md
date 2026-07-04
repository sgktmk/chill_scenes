---
name: port-scene
description: Port a reference pixel-art image into a new animated chill scene. Use when the user asks to create a scene from refs/<name>/ (base.png + spec.md), or to "port" / "移植" an image into a scene.
---

# Port a reference image into an animated scene

Turn `refs/<scene>/base.png` + `refs/<scene>/spec.md` into a self-contained
scene HTML with motion and procedural audio. The full human-facing manual is
`docs/scene-workflow.md`; this skill is the executor's checklist.

**Core rule: the image is the source of truth for composition.** Never
redraw the composition procedurally by eye — convert it with the tool and
load the data. Procedural drawing is only for *dynamic* elements (sun, moon,
sprites, particles) and small touch-ups.

## Steps

### 1. Understand the material

- Read `refs/<scene>/spec.md` (motion, audio, resolution, day-night choice).
- View `refs/<scene>/base.png` with the Read tool to understand the
  composition: where the horizon is, what should animate, palette mood.
- Look at whichever existing scene (`seascape.html`, `campfire.html`,
  `snowy-forest.html`, `rice-terrace.html`) is closest in spirit — reuse its
  techniques rather than inventing new ones.

### 2. Convert the image

```bash
node tools/png2pixel.mjs refs/<scene>/base.png -w 240 -h 160 -o /tmp/scene-img.js
# masks, if provided:
node tools/png2pixel.mjs refs/<scene>/mask-water.png -w 240 -h 160 --mask
```

- Match `-w/-h` to the resolution in spec.md (240×160 GBA or 320×180).
- Check the reported colour count. If the palette came out muddy (many
  near-duplicate colours eating the budget), try `--colors 24` or ask the
  user for a cleaner source.
- If the sky is opaque in the image but the scene has a day-night cycle,
  identify the sky palette indices and drop them when blitting (map to
  'none') so dynamic sky bands show through.

### 3. Build the scene

- Copy `templates/scene-template.html` to `<scene>.html` and paste the
  converted image data in.
- Set title, viewBox, `#scene-wrap` aspect ratio, and `HOR` (horizon y).
- Implement motion from spec.md:
  - Day-night: tune `createCycle()` keyframes (shared/cycle.js).
  - Water/sky reflection: layered `toSVG({ layers, classify })` +
    fill-inheriting overlay — see rice-terrace.html `buildWaterOverlay()`.
  - Sprites/events: draw with a separate small PixelBuffer or `blit()`.
- Implement audio from spec.md with `createAudioEngine()`
  (shared/audio-kit.js); one-shot voices (birds etc.) follow the oscillator
  + gain-envelope patterns in existing scenes.
- Add a debug URL param for any rare event (like `?egret=1`).

### 4. Verify with screenshots — do not skip

```bash
tools/screenshot.sh "<scene>.html?t=0.3" /tmp/day.png
tools/screenshot.sh "<scene>.html?t=0.62" /tmp/dusk.png
tools/screenshot.sh "<scene>.html?t=0.85" /tmp/night.png
```

View each with the Read tool and compare against `base.png`:

- Composition and colours at day phase must visually match the reference.
- No broken layering at dusk/night (terrain filter, star opacity, sky bands).
- Iterate until it matches; this loop is what guarantees quality.

### 5. Integrate

- Add a card with preview SVG to `index.html` (copy an existing card).
- Update `CLAUDE.md`: Files list + Architecture section for the new scene.
- `vercel.json` needs no change (`cleanUrls` is global).
- Run through the checklist at the bottom of `docs/scene-workflow.md`.
