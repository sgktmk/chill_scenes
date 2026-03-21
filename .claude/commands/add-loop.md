# /add-loop — Create a new PIV loop dynamically

Discover and add a new loop to the development roadmap during implementation.

**Arguments**: `$ARGUMENTS`
Format: `"brief goal" "rationale for creating this loop"`
Example: `"Fix audio fadeout bugs" "Discovered during L4 validation that audio doesn't cleanly stop"`

---

## Workflow

### Step 1: Parse Arguments

Extract:
- `GOAL`: Brief 1-sentence goal for the new loop
- `RATIONALE`: Why this loop is needed now (prerequisite, scope creep, bug, complexity, etc.)

If arguments are missing, ask the user for clarification.

### Step 2: Analyze Current Loop State

Read `CLAUDE.md` and identify:
- Current loop number (highest `LN` in loop table)
- Next available loop number (`LN+1`)
- Current loop status
- Ask user: "Where should this new loop go?"
  - Option A: Before current loop (as a prerequisite) — insertBefore(currentLoop)
  - Option B: After current loop (as follow-up) — insertAfter(currentLoop)
  - Option C: After loop N — specify which loop

### Step 3: Assign Loop Number and Position

If user chose Option A or B, renumber subsequent loops if needed:
- If inserting at position, all later loops increment (L3→L4, L4→L5, etc.)
- Update loop table in CLAUDE.md

If user chose Option C, insert without renumbering.

### Step 4: Create Plan Skeleton

Create `docs/plan-LN.md` from `docs/plan-template.md`:
- Fill in loop number and goal
- Pre-populate rationale in comments
- Leave goal/scope/criteria for user to fill in

### Step 5: Update Loop Table

Update the loop table in CLAUDE.md:
- Add new row at correct position
- Status: `計画完了` (plan written, ready for detail)
- Link to newly created `docs/plan-LN.md`

### Step 6: Report to User

Tell the user:
1. New loop number and position
2. Path to plan file (`docs/plan-LN.md`)
3. Instructions: "Fill in the plan details, then proceed with the loop"
