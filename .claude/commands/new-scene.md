# /new-scene — Create a new pixel-art scene

Create a new pixel-art scene for the Chill Scenes project.

**Arguments**: `$ARGUMENTS`
Format: `"file-name" "Display Title" "Scene description for concept"`
Example: `"rainy-window" "Rainy Window" "Rain streaks on a window overlooking a city at night"`

---

## Workflow

Execute the following steps **in order**. Each step uses a sub-agent where noted. Mark progress as you go.

### Step 1: Parse Arguments

Extract from `$ARGUMENTS`:
- `SCENE_FILE`: kebab-case filename (e.g. `rainy-window`)
- `SCENE_TITLE`: display name (e.g. `Rainy Window`)
- `SCENE_DESC`: concept description

If arguments are missing or malformed, ask the user for clarification.

### Step 2: Reference Analysis (Agent)

Spawn an **Explore agent** to analyze the current state of existing scenes. The agent should read:
- All existing scene HTML files (find them via `*.html` in project root, excluding `index.html`)
- `shared/pixel.js` API
- `shared/scene-ui.js` and `shared/scene-ui.css`
- `index.html` card structure

The agent should extract and return:
1. Current palette conventions (color grouping pattern, how many colors per category)
2. The `paintScene()` drawing order used in pixel-buffer scenes
3. Audio layer patterns (types, gain ranges, scheduling)
4. Animation patterns (CSS keyframes vs JS requestAnimationFrame)
5. Any new conventions that have emerged since this command was written

### Step 3: Scaffold (Agent, can run in parallel with Step 4)

Spawn a **general-purpose agent** to create the boilerplate:

1. Copy `templates/scene.html` to `{SCENE_FILE}.html` in project root
2. Replace `{{SCENE_TITLE}}` with the display title
3. Add a card to `index.html` using `templates/card-snippet.html` as reference:
   - Replace `{{SCENE_FILE}}`, `{{SCENE_TITLE}}`, `{{SCENE_DESC}}`
   - Place the card after the last existing card in the grid
4. Add the scene to `CLAUDE.md`:
   - Add to the Files list
   - Add a skeleton Architecture section following the pattern of existing scenes
5. The preview SVG in the card should be a placeholder (solid dark rect) — the Preview Card Agent will fill it in later

### Step 4: Palette Design (Agent, can run in parallel with Step 3)

Spawn a **general-purpose agent** to design the 32-colour palette.

**Instructions for the agent:**

Design a 32-colour palette for a pixel-art scene: "{SCENE_DESC}".

Study the existing scene palettes (especially `snowy-forest.html`) for conventions. The palette must follow this structure:

```
Indices 0-7:   Sky / atmosphere (darkest void → lightest sky)
Indices 8-14:  Ground / surface (deepest shadow → brightest highlight)
Indices 15-20: Primary scene elements (darkest → lightest)
Indices 21-25: Light source / accent colours
Indices 26-31: Secondary elements / reserve
```

Rules:
- Exactly 32 colours as hex strings
- Each colour has a semantic comment (e.g. `// 0  void`)
- Adjacent depth layers must have sufficient contrast
- Colours within a group should form smooth gradients
- The overall palette should evoke the mood described in the concept
- Index 0 should always be the darkest background colour
- Index 14 should be the brightest highlight (near-white)

Output ONLY the `const P = [...]` array with comments. Do not write it to a file — just return it.

### Step 5: Scene Rendering (Agent — MOST IMPORTANT)

After Steps 3 and 4 complete, spawn a **general-purpose agent** to implement `paintScene()`.

**Instructions for the agent:**

Implement the `paintScene()` function and any scene-specific drawing helpers for `{SCENE_FILE}.html`.

Concept: "{SCENE_DESC}"

Use the palette from Step 4 (paste it into the prompt).

**CRITICAL: Follow this exact drawing order:**

1. `pb.seed(N); pb.clear(0);` — deterministic seed
2. **SKY** — 6-8 horizontal bands using palette 0-7, fill full width per band
3. **CELESTIAL** — stars (scattered in upper 40% of sky, avoid light source), moon/sun with layered ellipses. **Record positions** in arrays for animation.
4. **DISTANT FEATURES** — Use multi-frequency sine waves for organic mountain/skyline shapes: `74 + Math.sin(x*0.012)*16 + Math.sin(x*0.035)*10 + Math.sin(x*0.08)*5`
5. **FAR ELEMENTS (depth=0)** — 25-35 small, dim elements scattered at Y 80-100
6. **GROUND/WATER** — Stratified gradient from horizon down. Add ±1 index noise (3-5% of pixels)
7. **LIGHT EFFECTS** — Read existing pixels with `buf[y*W+x]`, conditionally brighten within a cone/circle from light source. Only affect pixels in valid range.
8. **TEXTURE PASS** — 300-500 random pixel perturbations on ground area (±1 palette index)
9. **MID ELEMENTS (depth=1)** — 15-20 medium elements at Y 100-120
10. **DETAIL** — Small environmental details (footprints, small objects)
11. **NEAR ELEMENTS (depth=2)** — Large dark framing elements on LEFT and RIGHT edges. Leave centre open for depth.

**Composition rules:**
- Foreground elements frame the scene: cluster on left 25% and right 25% of width
- Centre 50% should show depth — the eye travels from foreground to background
- Far elements: smaller, higher Y, dimmer palette indices
- Near elements: larger, lower Y, darkest palette indices
- Use `drawXxx(cx, baseY, h, w, depth)` helper functions with depth parameter for palette selection

**Code quality:**
- Create reusable drawing helper functions (like `drawTree` in snowy-forest)
- Each helper accepts `depth` (0=far, 1=mid, 2=near) for palette colour selection
- Use section comments matching the template (`/* 1. SKY */`, etc.)

Write the palette AND the complete paintScene() with helpers directly into `{SCENE_FILE}.html`, replacing the TODO sections. Also set up animation pixel tracking arrays.

### Step 6: Animation, Audio, Preview Card (3 Agents in parallel)

After Step 5, spawn these three agents **simultaneously**:

#### 6a. Animation Agent

Implement animations for `{SCENE_FILE}.html`.

Read the current state of the file to see what elements were drawn and what pixel positions were recorded.

Implement:
1. **`render()` function** — Use `pb.toSVG()` with layer classification for animatable elements
2. **`startAnimations()` function** — `requestAnimationFrame` loop with:
   - Brightness shimmer for light sources: `1.0 + Math.sin(t*0.4)*0.06 + Math.sin(t*0.7+1)*0.04`
   - Per-element twinkle for stars: individual speed/phase per star
3. **CSS particle overlay** (if appropriate for the scene — snow, rain, fireflies, dust motes):
   - Add `@keyframes` to `<style>`
   - Implement `mkParticles()` function
   - Two layers: far (many, small, slow, dim) and near (fewer, larger, faster, brighter)
4. Uncomment the `mkParticles()` call in INIT section if particles were added

Ensure `prefers-reduced-motion` is respected.

#### 6b. Audio Design Agent

Implement audio for `{SCENE_FILE}.html`.

Concept: "{SCENE_DESC}"

Design and implement 3-5 audio layers appropriate for this scene:

| Layer Type | Implementation | Gain Range |
|---|---|---|
| Base drone | `makeNoiseSrc()` → lowpass/bandpass filter, loop | 0.02-0.05 |
| Texture | `makeNoiseSrc()` → highpass filter, loop | 0.01-0.03 |
| Periodic sound | `setTimeout` recursive + `OscillatorNode` | 0.08-0.15 |
| Incidental | probability-gated `setTimeout` | 0.05-0.12 |

Rules:
- Master gain coefficient: `vol / 100 * 0.45`
- All timers must be stored in module-level variables and cleared in `stopAudio()`
- Periodic sounds: 10-30s interval with `Math.random()` jitter and 60-80% trigger probability
- Use `exponentialRampToValueAtTime()` for pitch sweeps in periodic sounds
- Oscillator-based sounds: `start(t)` and `stop(t + duration + 0.05)` for clean lifecycle

Write directly into the AUDIO section of `{SCENE_FILE}.html`.

#### 6c. Preview Card Agent

Create the static preview SVG for the index.html card of `{SCENE_FILE}`.

Read the current `{SCENE_FILE}.html` to get the palette and understand the scene composition.
Read `index.html` to see the existing preview card SVG patterns.

Create a static SVG preview (320×140 viewBox) that captures the scene's essence:
- `linearGradient` for sky (4-6 stops from the scene's sky palette)
- Focal point (light source) using `radialGradient` or layered shapes
- Depth layers using `polygon` (silhouettes) and `rect` (structures)
- 15-30 SVG elements total
- All colours from the scene's palette
- `shape-rendering="crispEdges"`

Replace the placeholder SVG in the card in `index.html`.

### Step 7: Quality Review (Agent)

Spawn a final **general-purpose agent** to review the complete scene.

**Checklist — verify each item and fix any issues found:**

- [ ] HTML: `lang="en"`, title format `X — Chill Scenes`, favicon link
- [ ] Loads `shared/scene-ui.css`, `shared/pixel.js`, `shared/scene-ui.js` in correct order
- [ ] `PixelBuffer` instantiated with correct W, H, palette
- [ ] Palette: exactly 32 colours, all with semantic comments
- [ ] `paintScene()` follows standard depth order (sky → celestial → distant → far → ground → light → texture → mid → detail → near)
- [ ] `render()` uses `pb.toSVG()`
- [ ] Animation: `prefers-reduced-motion` check, `requestAnimationFrame` cleanup possible
- [ ] Audio: `initSceneAudio()` called with all 3 callbacks
- [ ] Audio: `stopAudio()` clears ALL timers and closes AudioContext
- [ ] Audio: `makeNoiseSrc()` used (not duplicated from template)
- [ ] Responsive: scene-wrap CSS handles portrait and landscape
- [ ] `index.html`: card added with preview SVG
- [ ] `CLAUDE.md`: scene listed in Files and Architecture sections
- [ ] No `console.log` or debug code left
- [ ] Default volume is 40%
- [ ] SVG id is `scene` (standardized)

Fix any issues found. Report the results.

### Step 8: User Review

Tell the user:
1. The scene file path
2. How to preview it: `python3 -m http.server 8000` then open the URL
3. Ask them to review visually and provide feedback
4. Mention they can use `/refine-scene` for adjustments
