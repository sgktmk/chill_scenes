# /scene-audit — Audit an existing scene for quality and consistency

Run a quality review on an existing scene to check for issues.

**Arguments**: `$ARGUMENTS`
Format: `scene-file-name` (without .html extension, or "all" to audit every scene)
Example: `snowy-forest`

---

## Workflow

### Step 1: Determine Target

If `$ARGUMENTS` is "all", find all scene HTML files in the project root (exclude `index.html`).
Otherwise, target `{ARGUMENTS}.html`.

### Step 2: Audit Each Scene

For each scene file, check every item below. Use Grep/Read tools to verify — do NOT guess.

#### Structure Checklist
- [ ] `<html lang="en">` (not `ja` or other)
- [ ] `<title>` follows format `Name — Chill Scenes`
- [ ] `<link rel="icon" type="image/svg+xml" href="favicon.svg">`
- [ ] Loads `shared/scene-ui.css` via `<link>`
- [ ] Loads `shared/scene-ui.js` via `<script src>`
- [ ] Back button: `<a class="back" href="/">&#8592; Top</a>`
- [ ] Audio panel HTML with ids `aBtn`, `vSl`, `vLb`
- [ ] `initSceneAudio()` called with `onStart`, `onStop`, `onVolumeChange`
- [ ] Default volume slider value is 30-50%

#### Pixel Buffer Scenes (if uses PixelBuffer)
- [ ] Loads `shared/pixel.js` via `<script src>` BEFORE scene script
- [ ] `PixelBuffer` instantiated with correct dimensions
- [ ] Palette array has exactly 32 colours with semantic comments
- [ ] `paintScene()` follows standard depth order
- [ ] `render()` uses `pb.toSVG()`

#### Animation
- [ ] Checks `prefers-reduced-motion` before starting animations
- [ ] CSS particle animations have `@media(prefers-reduced-motion:reduce)` rule

#### Audio
- [ ] `stopAudio()` clears ALL setTimeout/setInterval timers
- [ ] `stopAudio()` closes AudioContext and nulls references
- [ ] No orphaned audio nodes on stop (all oscillators have `.stop()` scheduled)

#### Integration
- [ ] Card exists in `index.html` with preview SVG (not placeholder)
- [ ] Listed in `CLAUDE.md` Files section
- [ ] Architecture section in `CLAUDE.md` describes the scene

#### Code Quality
- [ ] No `console.log` or debug code
- [ ] No hardcoded palette colours outside `const P` (preview card in index.html is exception)
- [ ] SVG id follows convention (`scene` for new scenes, legacy ids acceptable for older scenes)

### Step 3: Report

Output a summary table:

```
| Check | Status | Notes |
|-------|--------|-------|
| lang="en" | PASS/FAIL | ... |
| ... | ... | ... |
```

If any items FAIL, offer to fix them automatically.
