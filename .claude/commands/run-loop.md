# /run-loop — Execute a PIV loop autonomously

Run a complete PIV loop (Plan → Implement → Validate → Verify) from start to finish.

**Arguments**: `$ARGUMENTS`
Format: `LN` or `LN skip-confirm`
Example: `L4` or `L4 skip-confirm` (skip plan confirmation)

---

## Workflow

### Step 1: Parse Arguments

Extract loop number (e.g., `L4`).
Optional flag: `skip-confirm` (bypass plan review).

### Step 2: Launch Loop Engine

Spawn Agent with `subagent_type: "loop-engine"`.

Prompt:
```
Execute PIV loop LN autonomously.

1. Read docs/plan-LN.md and confirm the plan with the user (unless skip-confirm flag)
2. Execute all implementation steps in order
3. Validate against acceptance criteria
4. Generate validation report
5. Call loop-updater to mark as complete

Loop number: {LN}
Skip confirmation: {skip-confirm flag}
```

The loop-engine will:
- Read the plan
- Ask user confirmation (unless skip-confirm)
- Implement each step (delegating to specialized agents)
- Validate and check acceptance criteria
- Generate validation report

### Step 3: Validation & Report

After loop-engine completes implementation and validation:

Spawn Agent with `subagent_type: "validation-executor"`.

Prompt:
```
Validate loop LN and generate validation report.

Read docs/plan-LN.md for acceptance criteria and validation commands.
Check each criterion and generate docs/validation-report-LN.md.
```

### Step 4: Update Status

If validation PASSES, spawn Agent with `subagent_type: "loop-updater"`.

Prompt:
```
Update CLAUDE.md to mark loop LN as complete.
Add link to docs/validation-report-LN.md in the loop table.
```

### Step 5: Summary & Next Steps

Tell the user:
- Loop number and goal
- Result: ✅ COMPLETE or ❌ FAILED
- What was accomplished (1-2 sentence summary)
- If FAILED: What needs fixing, which step to retry
- If COMPLETE: Which loop to run next (e.g., "/run-loop L5")

---

## Loop Execution Discipline

**Important**: The loop-engine will **strictly** follow these rules:

1. **One goal per loop** — If additional work is discovered, `/add-loop` is called instead
2. **Plan adherence** — Only what's in the plan is implemented
3. **Acceptance criteria validation** — All criteria must PASS before marking complete
4. **Stop on failure** — Don't proceed past a failed criterion without user confirmation

---

## Recovery

If a loop fails validation:

```
/run-loop L4 skip-confirm
```

Re-runs L4 implementation and validation, skipping the plan confirmation step (assuming you already approved the plan).

Or use `/refine-loop` to make targeted fixes before re-running validation.
