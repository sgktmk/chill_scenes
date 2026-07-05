# /refine-scene — Refine an existing scene based on feedback

Apply visual or audio feedback to an existing pixel-art scene.

**Arguments**: `$ARGUMENTS`
Format: `scene-file-name "feedback description"`
Example: `rainy-window "月をもっと大きく、雨粒を密にして、街の灯りをもう少し暖色に"`

---

## Workflow

### Step 1: Parse Arguments

Extract:
- `SCENE_FILE`: the scene filename (without .html extension)
- `FEEDBACK`: the user's feedback text

### Step 2: Analyze

Read `{SCENE_FILE}.html` thoroughly. Categorize the feedback into:

| Category | What to change | Section in file |
|---|---|---|
| **Palette** | Colour adjustments | `const P = [...]` |
| **Composition** | Element size, position, count | `paintScene()` |
| **Drawing** | Element shape, detail level | Drawing helper functions |
| **Animation** | Speed, intensity, pattern | `startAnimations()` / CSS `@keyframes` |
| **Audio** | Volume, frequency, timing | Audio functions |
| **Particles** | Density, size, speed | `mkParticles()` / CSS |

### Step 3: Apply Changes

For each category of feedback:

1. **Read the relevant section** of the scene file
2. **Make targeted edits** — change only what the feedback asks for
3. **Preserve the existing structure** — don't reorganize or refactor unrelated code

**Important guidelines:**
- If feedback says "bigger", increase dimensions by 30-50% as a starting point
- If feedback says "more" or "denser", increase count by 50%
- If feedback says "less" or "subtle", reduce by 30-40%
- If feedback says "warmer", shift hex colours toward amber/orange
- If feedback says "cooler", shift hex colours toward blue
- If feedback says "brighter", increase palette index by 1-2
- If feedback says "darker", decrease palette index by 1-2
- If feedback mentions "too fast" or "too slow", adjust animation duration by 40-60%
- When changing colours, update both the palette AND any hardcoded hex values in preview card

### Step 4: Report

Tell the user what was changed and ask them to review again in the browser.
