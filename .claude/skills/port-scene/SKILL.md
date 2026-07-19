---
name: port-scene
description: Port a reference pixel-art image into a new animated chill scene. Use when the user asks to create a scene from refs/<name>/ (base.png + spec.md), or to "port" / "移植" an image into a scene.
---

# Port a reference image into an animated scene

Turn `refs/<scene>/` material (base.png, spec.md, and usually `parts/`)
into a self-contained scene HTML with motion and procedural audio. The
full human-facing manual is `docs/scene-workflow.md`; this skill is the
executor's checklist. Follow it mechanically — every step states what to
run and what to verify, so no step needs judgement beyond comparing images.

**Core rule 1: the image is the source of truth for composition.** Never
redraw the composition procedurally by eye — convert it with the tool and
load the data. Procedural drawing is only for *dynamic* elements (sun, moon,
particles) and small touch-ups.

**Core rule 2: motion is structural, never faked.** Anything that moves,
appears, disappears, or changes shape must be an independent cutout part
rendered by `shared/sprite.js`, with real background behind it (a sliding
door reveals the doorway; a departing boat reveals water). It is FORBIDDEN
to "animate" by estimating an object's coordinates inside the flat
background and jiggling, blurring, or recolouring those pixels. If a
needed part is baked into base.png and there is no parts/ image or mask
for it, STOP and ask the user for the part image — do not improvise.

## Steps

### 1. Understand the material

- Read `refs/<scene>/spec.md` (parts table, motion, audio, resolution,
  day-night choice).
- View `refs/<scene>/base.png` with the Read tool: horizon position,
  palette mood, where each part sits. View each `parts/*.png` too.
- Check the material is complete: every moving thing in spec.md has a
  `parts/NN-name.png` (or `mask-name.png`) entry. If not, ask the user
  before writing any code.
- Look at whichever existing scene (`seascape.html`, `campfire.html`,
  `snowy-forest.html`, `rice-terrace.html`) is closest in spirit — reuse its
  techniques rather than inventing new ones.

### 2. Convert and verify the cutout — do not skip the previews

```bash
# scene with moving parts (the normal case):
node tools/cutout.mjs refs/<scene> -w 240 -h 160 -o /tmp/<scene>-img.js --preview /tmp/<scene>-prev
# scene with nothing moving:
node tools/png2pixel.mjs refs/<scene>/base.png -w 240 -h 160 -o /tmp/<scene>-img.js
```

- Match `-w/-h` to the resolution in spec.md (240×160 GBA or 320×180).
- Read the tool's summary: palette size, each part's states/bbox/z, and
  any WARNING lines (misaligned part, rough inpaint) — resolve warnings
  before continuing, asking the user if the material itself is at fault.
- View every file in the preview dir with the Read tool:
  - `bg.png` — no remnants of any part; inpainted areas look plausible.
    If the inpaint is rough, ask the user for a `bg.png` in refs/.
  - `part-*@*.png` — each part is complete (nothing clipped, nothing
    bleeding in from the background).
  - `composite.png` vs `reference.png` — must match.
- If the palette came out muddy (near-duplicate colours eating the
  budget), try `--colors 24` or ask the user for a cleaner source.
- If the sky is opaque in the image but the scene has a day-night cycle,
  identify the sky palette indices and drop them when blitting (map to
  'none') so dynamic sky bands show through.

### 3. Build the scene

- Copy `templates/scene-template.html` to `<scene>.html` and paste the
  converted data in (`<NAME>_PALETTE` / `<NAME>_BG` / `<NAME>_PARTS`).
- Set title, viewBox, `#scene-wrap` aspect ratio, and `HOR` (horizon y).
- Load the background into `#terrainG`, instantiate parts with
  `createSprites(document.getElementById('partsG'), <NAME>_PARTS)`.
- Implement motion from spec.md:
  - Parts: drive sprites with `moveTo/moveBy` (scene coordinates),
    `setState` (frame swap: door open, wings up), `setFlip`, `show/hide`.
    Position/state timing lives in your rAF loop or `engine.schedule`.
  - Day-night: tune `createCycle()` keyframes (shared/cycle.js).
  - Water/sky reflection: layered `toSVG({ layers, classify })` +
    fill-inheriting overlay — see rice-terrace.html `buildWaterOverlay()`.
  - Ambient particles (smoke, fireflies, sparkles): small procedural
    SVG/CSS elements are fine — they are not composition.
- Implement audio from spec.md with `createAudioEngine()`
  (shared/audio-kit.js); one-shot voices (birds etc.) follow the oscillator
  + gain-envelope patterns in existing scenes.
- Add a debug URL param for every rare event and every part pose
  (e.g. `?egret=1`, `?pose=door-open`) so each state can be frozen for
  screenshots.

### 4. Verify with screenshots — do not skip

```bash
tools/screenshot.sh "<scene>.html?t=0.3" /tmp/day.png
tools/screenshot.sh "<scene>.html?t=0.62" /tmp/dusk.png
tools/screenshot.sh "<scene>.html?t=0.85" /tmp/night.png
tools/screenshot.sh "<scene>.html?t=0.3&pose=<each-pose>" /tmp/pose-*.png
```

View each with the Read tool and compare against `base.png` / the part
previews:

- Composition and colours at day phase must visually match the reference.
- Every part pose renders correctly: the moved/opened/hidden part reveals
  the background behind it, with no hole, ghost, or leftover pixels.
- No broken layering at dusk/night (terrain filter, star opacity, sky bands).
- Iterate until it matches; this loop is what guarantees quality.

### 5. Integrate

- Add a card with preview SVG to `index.html` (copy an existing card).
- Update `CLAUDE.md`: Files list + Architecture section for the new scene.
- `vercel.json` needs no change (`cleanUrls` is global).
- Run through the checklist at the bottom of `docs/scene-workflow.md` —
  it includes the structural-motion checks.
