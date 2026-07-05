# /refine-loop — Fix specific issues in a loop and re-validate

Make targeted fixes to a failed acceptance criterion and re-run validation.

**Arguments**: `$ARGUMENTS`
Format: `LN "criterion name" "fix description"`
Example: `L4 "Scene renders correctly" "Center foreground elements to avoid clipping"`

---

## Workflow

### Step 1: Parse Arguments

Extract:
- `LN`: loop number (e.g., `L4`)
- `criterion`: which criterion failed (e.g., "Scene renders correctly")
- `fix`: what to fix (e.g., "Adjust element positioning")

### Step 2: Identify & Implement Fix

1. Read `docs/plan-LN.md` to understand what was supposed to be done
2. Read relevant source files to see current state
3. Implement the fix based on user's description
4. Verify the fix doesn't break other acceptance criteria

**Keep it surgical**: Only fix what's needed to satisfy the specific criterion.

### Step 3: Re-run Validation for the Criterion

Spawn Agent with `subagent_type: "validation-executor"`.

Prompt:
```
Re-validate loop LN, focusing on the criterion: "{criterion_name}".

Run the validation check for this specific criterion and report:
- ✅ PASS — criterion now satisfied
- ❌ FAIL — still failing; describe issue
- ⚠️ PARTIAL — partially fixed; explain

Don't re-check all criteria, just this one (to save time).
```

### Step 4: If Criterion Passes

Tell the user:
```
✅ Criterion "{criterion_name}" now PASSES.

Recommend: Run `/run-loop L4 skip-confirm` to re-validate all criteria.
```

If other criteria might be affected by the fix, suggest full re-validation.

### Step 5: If Criterion Still Fails

Tell the user:
```
❌ Criterion "{criterion_name}" still FAILING.

Issue: [describe what's still wrong]

Recommend:
1. Read the current implementation at [file location]
2. Manually check in browser: [how to verify]
3. Try `/refine-loop L4 "{criterion_name}" "new fix description"`
```

---

## Use Cases

**After failed validation:**
```
/refine-loop L4 "Scene renders correctly" "Adjust tree positioning to prevent overlap"
```

**If audio volume isn't working:**
```
/refine-loop L4 "Audio volume control works" "Check gain ramp timing in setVolume() function"
```

**If animation is jerky:**
```
/refine-loop L4 "Animation smooth" "Increase requestAnimationFrame target framerate"
```
