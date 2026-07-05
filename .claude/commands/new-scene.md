# /new-scene — Create a new pixel-art scene

Create a new pixel-art scene for the Chill Scenes project.

**Arguments**: `$ARGUMENTS`
Format: `"file-name" "Display Title" "Scene description for concept"`
Example: `"rainy-window" "Rainy Window" "Rain streaks on a window overlooking a city at night"`

---

## Workflow

Execute the following steps **in order**. Use the Agent tool with the specified `subagent_type` for each step.

### Step 1: Parse Arguments

Extract from `$ARGUMENTS`:
- `SCENE_FILE`: kebab-case filename (e.g. `rainy-window`)
- `SCENE_TITLE`: display name (e.g. `Rainy Window`)
- `SCENE_DESC`: concept description

If arguments are missing or malformed, ask the user for clarification.

### Step 2: Reference Analysis

Spawn Agent with `subagent_type: "reference-analyzer"`.

Prompt: "Analyze all existing scenes and extract current conventions for creating a new scene: '{SCENE_TITLE}' — {SCENE_DESC}"

### Step 3 & 4: Scaffold + Palette Design (parallel)

Spawn **two agents in parallel** in a single message:

**Agent A** — `subagent_type: "scene-scaffolder"`
Prompt: "Create scaffold for new scene. File: {SCENE_FILE}.html, Title: {SCENE_TITLE}, Description: {SCENE_DESC}"

**Agent B** — `subagent_type: "palette-designer"`
Prompt: "Design a 32-colour palette for: {SCENE_DESC}. Scene title: {SCENE_TITLE}"

### Step 5: Scene Rendering (MOST IMPORTANT)

After Steps 3 and 4 complete, spawn Agent with `subagent_type: "scene-renderer"`.

Prompt: Include the palette from Step 4 and the reference analysis from Step 2. Ask it to implement paintScene() and drawing helpers in {SCENE_FILE}.html.

Full prompt template:
"Implement paintScene() for {SCENE_FILE}.html. Concept: {SCENE_DESC}.

Here is the palette to use:
{PASTE PALETTE FROM STEP 4}

Here are the current conventions:
{PASTE REFERENCE ANALYSIS FROM STEP 2}

Write the palette and complete paintScene() with helpers into the file."

### Step 6: Animation, Audio, Preview Card (3 agents in parallel)

After Step 5, spawn **three agents in parallel** in a single message:

**Agent A** — `subagent_type: "animation-designer"`
Prompt: "Implement animations for {SCENE_FILE}.html — render(), startAnimations(), and particle overlay if appropriate for the scene concept: {SCENE_DESC}"

**Agent B** — `subagent_type: "audio-designer"`
Prompt: "Implement procedural audio for {SCENE_FILE}.html. Scene concept: {SCENE_DESC}"

**Agent C** — `subagent_type: "preview-card-designer"`
Prompt: "Create a static SVG preview card for {SCENE_FILE} in index.html. Read the scene file to understand the palette and composition."

### Step 7: Quality Review

Spawn Agent with `subagent_type: "quality-reviewer"`.

Prompt: "Review {SCENE_FILE}.html for quality and consistency. Run the full checklist and fix any issues found."

### Step 8: User Review

Tell the user:
1. The scene file path
2. How to preview it: `python3 -m http.server 8000` then open the URL
3. Ask them to review visually and provide feedback
4. Mention they can use `/refine-scene` for adjustments
