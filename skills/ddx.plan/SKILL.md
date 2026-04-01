---
name: ddx.plan
description: Generates a Plan document. Product plans sequence capabilities in build order. Capability plans have detailed build steps.
disable-model-invocation: true
---

You are generating a Plan. The plan structure depends on whether you're planning at the PRODUCT level or the CAPABILITY level.

IMPORTANT: Use file reading/glob tools, NOT shell commands. Do NOT use Bash to create directories — just write files directly with the Write tool and directories are created automatically. Be frictionless — if upstream docs are missing, generate them yourself rather than telling the user to run another command.

## Scope Resolution (do this FIRST)

1. Read `.ddx-tooling/config.yaml` to find all document entries. Note prompts, templates, and output paths (contain `{scope}`).

2. Check if `ddx/product/definition.md` exists. If it does NOT exist, the user's request IS the product. Set scope to `product`. Do NOT create a capability scope when there is no product yet.

3. If the product exists, determine capability scope:
   - The user may have described what they want. Use that to infer scope.
   - Glob for existing `ddx/*/` docs. Check which scopes don't have `plan.md` yet.
   - If exactly one scope is missing `plan.md`, that is the active scope.
   - If the user's request matches an existing scope (by content), use that scope.
   - If the user's request is something new — this is a new capability. Derive a kebab-case folder name from their description.
   - Only ask the user if it's genuinely ambiguous between multiple scopes.

3. Resolve all paths: replace `{scope}` in output paths.

4. Determine plan type:
   - If scope is `product` → PRODUCT PLAN.
   - Otherwise → CAPABILITY PLAN.

## Ensure Upstream Exists

Check if `ddx/{scope}/definition.md` and `ddx/{scope}/spec.md` exist. For each missing doc, generate it now (read its prompt and template from config, use available context, write to disk, tell the user). Generate definition first, then spec.

### Check if design is needed

Read `ddx/{scope}/definition.md`. Determine if the product has a user interface:

- **Has UI** (web app, mobile app, dashboard, portal, etc.): check if `ddx/{scope}/design.md` (or `design.html`) exists. If not, generate it before generating spec.
- **No UI** (API, service, library, CLI, data pipeline, worker, daemon, etc.): skip design entirely. Do NOT generate a design document.

## Generate

1. Read the plan prompt file.
2. Read the plan template file.
3. Read the upstream documents — Definition, Spec, and Design (only if design exists / product has UI).
4. If the output file already exists, read it — you are UPDATING.

### Product Plan

The product plan sequences which capabilities to build and in what order. It does NOT contain implementation steps.

1. Read the product definition and spec (and design, if it exists).
2. Identify all distinct capabilities described in these documents.
3. For each capability, determine:
   - A short kebab-case name (suitable as a folder name)
   - A one-line description
   - Dependencies on other capabilities
4. Order from foundational (no dependencies) to complex (depends on earlier ones).
5. Write the plan using this structure:

```
# Product Plan

## Capability Sequence

### 1. {capability-name}
**Description:** {what this capability covers}
**Depends on:** {nothing, or earlier capabilities}
**Status:** not started

### 2. {capability-name}
...
```

### Capability Plan

Detailed build steps for a single capability.

1. Read the capability's definition and spec (and design, if it exists).
2. Also read `ddx/product/plan.md` to understand where this capability fits and what it depends on. If dependency capabilities have specs, skim them for interfaces this capability integrates with.
3. Decompose into ordered steps from low to high complexity. Each step builds on the previous.
4. Write the plan to the resolved output path using the template structure.
5. After writing, if `ddx/product/plan.md` exists, update this capability's status to `in progress` in the product plan.

## Review

Tell the user: "I've written the plan to `{output path}`. Please review it — reorder, split, or merge steps as needed. When you're done, let me know and I'll read your changes."

If the user says they've made changes or want something adjusted:
1. Re-read the file from disk.
2. Make the requested changes.
3. Write the updated file.

When the user is satisfied, proceed to Beads Task Sync (if applicable), then tell them: "The plan is finalized. The next step is **`/ddx.build`** to start building. Want me to run it?"

## Beads Task Sync (if tracking enabled)

After the plan is finalized:

1. Read `.ddx-tooling/config.yaml`. Check if `tracking.provider` is `beads` and `tracking.enabled` is `true`. If not, skip this section entirely.

2. Re-read the plan file from disk. Parse all steps.

3. **For a Capability Plan:**
   - Create a parent task:
     `bd create "{scope}: Build Capability" -t task --json`
   - Capture the parent ID from the JSON output.
   - For each step in the plan, create a child task. Include the FULL step details (Build, Depends on, Verify fields) as the task description:
     `bd create "{scope}: Step {N} - {step name}" -t task -d "{full step details: Build, Depends on, Verify}" --parent {parent-id} --json`
   - Capture each child task's ID from the JSON output.
   - Set up dependencies between sequential steps (step N blocks on step N-1):
     `bd dep add {step-N-id} {step-N-minus-1-id} --type blocks`
   - Label all tasks with the scope:
     `bd label add {task-id} ddx:{scope}`

4. **For a Product Plan:**
   - For each capability in the sequence, include the full description:
     `bd create "{capability-name}: Plan & Build" -t task -d "{description and dependency info}" --json`
   - Set up dependency chains based on the "Depends on" field.
   - Label all tasks with:
     `bd label add {task-id} ddx:product-plan`

5. **Regenerate plan.md as a status dashboard.** Follow the "Refresh plan.md from Beads" procedure below.

6. Tell the user: "I've created {N} Beads tasks — they hold the detailed step descriptions. `plan.md` now shows live status. Run `bd ready` to see what's unblocked."

If any `bd` command fails, log a warning and continue — the plan details live in Beads, but the dashboard refresh is best-effort.

## Refresh plan.md from Beads

This procedure regenerates `plan.md` as a human-readable status dashboard from Beads data. Use it whenever plan state changes.

1. Run `bd list --label ddx:{scope} --json` to get all tasks for this scope.
2. For a **Product Plan**, also run `bd list --label ddx:product-plan --json`.
3. Parse the JSON output. For each task, extract: title, status, priority, description (first line or summary), and any dependency info.
4. Write `plan.md` in this format:

**Product Plan dashboard:**
```
# Product Plan — Status

> Auto-generated from Beads. Source of truth: `bd list --label ddx:product-plan`

| # | Capability | Status | Priority | Description |
|---|-----------|--------|----------|-------------|
| 1 | {name}    | {status} | {priority} | {description} |
| 2 | {name}    | {status} | {priority} | {description} |
```

**Capability Plan dashboard:**
```
# {Scope} — Build Plan Status

> Auto-generated from Beads. Source of truth: `bd list --label ddx:{scope}`

| # | Step | Status | Priority | Description |
|---|------|--------|----------|-------------|
| 1 | {step name} | {status} | {priority} | {short description} |
| 2 | {step name} | {status} | {priority} | {short description} |

## Details

For full step details, run: `bd show {task-id}`
```

5. Write the dashboard to the resolved output path (`ddx/{scope}/plan.md`).

### Product Plan Auto-Update

If the product plan already exists AND new capability folders have been added (glob for `ddx/*/definition.md` and compare against capabilities listed in the plan):
- Read the existing product plan.
- Read the new capability's `definition.md`.
- If Beads tracking is enabled:
  - Create a new Beads task for the capability: `bd create "{capability-name}: Plan & Build" -t task -d "{description}" --json`
  - Label with `ddx:product-plan`.
  - Set up dependencies based on existing capability tasks.
  - Refresh plan.md from Beads (follow the "Refresh plan.md from Beads" procedure above).
- If Beads tracking is NOT enabled:
  - Add the new capability to the sequence in the appropriate position.
  - Update the status of completed capabilities (those with all four docs: definition.md, design.md, spec.md, plan.md) to `complete`.
  - Write the updated product plan.
