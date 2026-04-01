---
name: ddx.update
description: Updates existing DDX documents based on a change. Determines impact, updates affected documents, and cascades changes downstream.
disable-model-invocation: true
---

You are updating existing DDX documents based on a change the user describes.

IMPORTANT: Use file reading/glob tools, NOT shell commands. Do NOT use Bash to create directories — just write files directly with the Write tool and directories are created automatically.

## Load Everything

1. Read `.ddx-tooling/config.yaml`.
2. Use glob to find all `ddx/*/*.md` files.
3. Read every document found. You need the full picture to determine what's affected.

## Ask What Changed

Ask the user: "What would you like to change?" Wait for their response. Do NOT ask them which document to update — you will figure that out.

## Determine Impact

From the user's description, figure out:

1. **Which scope** is affected. Infer this from the user's description by matching it against the content of each scope's documents. For example, if the user says "change the login flow" and only the `auth` scope has login-related content, the scope is `auth`. If only one scope exists, use that. Only ask the user to clarify if the change could plausibly apply to multiple scopes.

2. **Which document level** the change originates at. Use this hierarchy:
   - **definition** — the problem, users, solution, success metrics
   - **design** — the screens, wireframes, interactions
   - **spec** — the architecture, components, data model, integrations
   - **plan** — the build steps and order

   The change belongs at the HIGHEST level it touches. For example:
   - "Change target users" → definition
   - "Add a settings screen" → design
   - "Switch from REST to GraphQL" → spec
   - "Reorder the build steps" → plan

3. **Upstream check** — read all docs ABOVE the affected level in the same scope. Verify the change doesn't contradict them. If it does, tell the user: "This change conflicts with {upstream doc} which says {quote}. Should I update that too?" If yes, start from that higher level instead.

## Make the Change

1. Update the affected document. Write it to disk IMMEDIATELY using Edit or Write tools.
2. Confirm to the user what you changed.

## Cascade Downstream

After the change is made, check every document BELOW the affected level in the same scope:

### Determine the cascade chain

Read `ddx/{scope}/definition.md`. Determine if the product has a user interface:

- **Has UI** (web app, mobile app, dashboard, portal, etc.): cascade chain is `definition → design → spec → plan`.
- **No UI** (API, service, library, CLI, data pipeline, worker, daemon, etc.): cascade chain is `definition → spec → plan`. Skip design entirely.

### Apply the cascade

First, check if Beads tracking is enabled: read `.ddx-tooling/config.yaml` and check if `tracking.provider` is `beads` and `tracking.enabled` is `true`.

For each downstream document in the chain that exists:

**For definition, design, and spec levels** (same regardless of Beads):
1. Read the document.
2. Compare it against the updated upstream document(s).
3. If it's still consistent — say so and move on.
4. If it's inconsistent — show the user what's now wrong and ask: "Should I update {doc} to reflect this change?"
   - If yes: update it, write to disk, then continue checking further downstream.
   - If no: skip it and warn that it's now out of sync.

**When the cascade reaches plan level — Beads NOT enabled:**
1. Read `ddx/{scope}/plan.md`.
2. Compare against the updated upstream docs (definition, spec, design).
3. If inconsistent, show the user what's wrong and ask to update.
4. If yes: modify plan.md directly — add, remove, or rewrite steps as needed. Write to disk.

**When the cascade reaches plan level — Beads IS enabled:**
1. Read the current step details from Beads: `bd list --label ddx:{scope} --all --limit 0 --flat --json`
2. For each task, read its full description (which contains Build, Depends on, Verify).
3. Compare these steps against the updated upstream docs (definition, spec, design).
4. If inconsistent, show the user what's wrong. For each proposed change, explain which Beads task(s) would be affected.
5. If the user approves, apply the changes directly to Beads tasks (see "Reconcile Beads tasks" below).
6. plan.md is auto-refreshed by the Claude Code hook after each `bd` command.

Don't skip levels in the chain.

## Update Plan Status

If the change affected plan-level content (either directly or via downstream cascade) and scope is not `product`:

1. Check if `ddx/product/plan.md` exists. If not, skip this section.

**If Beads is NOT enabled:**
2. Read the updated capability plan. Check if:
   - Any step that was previously marked `[DONE]` was modified or removed.
   - New steps were added that are not `[DONE]`.
3. If either is true, and the capability's **Status** in the product plan is `complete`:
   - Update the status back to `in progress` in `ddx/product/plan.md`.
   - Remove `[DONE]` from any modified steps in the capability plan — they need to be rebuilt.
   - Tell the user: "{scope} status reverted to `in progress` — the plan has new or modified steps that need building."

**If Beads IS enabled:**
2. Check the Beads tasks: were any completed tasks modified or new tasks created?
3. If yes, and the capability's product-plan Beads task was closed:
   - Create a new rework task: `bd create "{scope}: Plan & Build (rework)" -t task --json` and label with `ddx:product-plan`.
   - Tell the user: "{scope} status reverted — the plan has new or modified steps that need building."

## Reconcile Beads Tasks

This section only applies when Beads tracking is enabled AND the change affected plan-level content. If Beads is not enabled, skip entirely.

The detailed step descriptions live in Beads tasks. To reconcile after upstream changes:

1. Read current Beads tasks for this scope:
   `bd list --label ddx:{scope} --all --limit 0 --flat --json`

2. From the upstream changes (the updated definition, spec, and/or design), determine what plan-level changes are needed. Generate the new/modified steps with full details (Build, Depends on, Verify fields). The upstream docs are the source — you are deriving plan changes from them, not from plan.md.

3. Compare the derived steps against existing Beads tasks:

   **New steps needed (no matching Beads task):**
   - Create tasks with full details as descriptions:
     `bd create "{scope}: Step {N} - {step name}" -t task -d "{Build, Depends on, Verify}" --json`
   - Add to the parent task if it exists.
   - Set up dependencies with adjacent steps.
   - Label with `ddx:{scope}`.

   **Steps no longer needed (Beads task exists but is now obsolete):**
   - Close the orphaned task: `bd close {task-id} --reason "Removed from plan during update"`

   **Steps modified that were previously completed (now need rework):**
   - The old closed Beads task stays closed as historical record.
   - Create a new task: `bd create "{scope}: Step {N} - {step name} (rework)" -t task -d "{updated details}" --json`
   - Label with `ddx:{scope}` and set up dependencies.

   **Major reordering (step numbers shifted significantly):**
   - Close all open tasks for the scope and recreate from the derived steps.
   - Tell the user: "Plan structure changed significantly. I've recreated the Beads tasks to match."

   **Steps renamed but position preserved:**
   - Update the task: `bd update {task-id} --title "{new title}" -d "{updated details}"`

4. Tell the user what reconciliation was done. plan.md is auto-refreshed by the hook.

If any `bd` command fails, log a warning and continue — Beads failure never blocks the workflow.
