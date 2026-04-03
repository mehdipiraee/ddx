---
name: ddx.build
description: Builds a capability by reading the DDX plan and executing it step by step. Writes code, creates files, and verifies each step.
disable-model-invocation: true
---

You are building a capability from its DDX documents. You will read the plan and execute it step by step.

IMPORTANT: All work happens inside the current project directory. Do NOT explore, read, or search files outside of it. Do NOT look in parent directories or other projects. Everything you need is in the DDX documents and the current project.

IMPORTANT: Use file reading/glob tools, NOT shell commands for file discovery. Do NOT use Bash to create directories — just write files directly with the Write tool and directories are created automatically. Be frictionless — if upstream docs are missing, generate them yourself rather than telling the user to run another command.

## Scope Resolution (do this FIRST)

1. Read `.ddx-tooling/config.yaml`.

2. Check if `ddx/product/definition.md` exists. If it does NOT exist, the user's request IS the product. Set scope to `product` and generate all product-level docs (definition, design, spec, plan) from the user's description. Do NOT create a capability scope when there is no product yet.

3. If the product exists, determine capability scope:
   - The user may have described what they want. Use that to infer scope.
   - Glob for `ddx/*/plan.md` files (excluding `product`).
   - If exactly one scope has a `plan.md`, that is the active scope.
   - If the user's request matches an existing scope (by content), use that scope.
   - If the user's request is something new — this is a new capability. Derive a kebab-case folder name and generate ALL upstream docs (definition, design, spec, plan) before building.
   - Only ask the user if it's genuinely ambiguous between multiple scopes.

4. Set the scope.

## Load Context

Read these documents for this scope:
- `ddx/{scope}/definition.md` — the what and why
- `ddx/{scope}/spec.md` — the architecture and technical decisions
- `ddx/{scope}/plan.md` — the ordered build steps

Also read `ddx/product/definition.md` and `ddx/product/spec.md` if they exist and scope is not `product`, for product-level context.

### Load Beads Status (if tracking enabled)

After loading documents:

1. Check the config already loaded in Scope Resolution. If `tracking.enabled` is `true`, continue. Otherwise skip this subsection.
2. Query all tasks for this scope:
   `bd list --label ddx:{scope} --all --limit 0 --flat --json`
3. Parse the JSON. Each task contains the full step details (Build, Depends on, Verify) in its description. **These task descriptions are the source of truth for what to build** — plan.md is just a status dashboard when Beads is enabled.
4. Identify completed tasks (closed status) — skip those steps during build.
5. Query ready tasks:
   `bd ready --label ddx:{scope} --all --limit 0 --flat --json`
   Use this to confirm the next step's dependencies are satisfied and to determine build order.

If any `bd` command fails, fall back to reading plan.md for what information is available. Beads failure never blocks the build.

### Check if design is needed

Read the definition. Determine if the product has a user interface:

- **Has UI** (web app, mobile app, dashboard, portal, etc.): also read `ddx/{scope}/design.md` (or `design.html`) — the wireframes and interaction design. If missing, generate it.
- **No UI** (API, service, library, CLI, data pipeline, worker, daemon, etc.): skip design entirely. Do NOT load or generate a design document.

If any required documents are missing (definition, spec, plan — and design if UI product), generate them now (read their prompts and templates from config, use available context, write to disk) rather than stopping.

## Build

Execute the plan step by step:

1. **Determine step details:**
   - If Beads tracking is enabled: get step details (Build, Depends on, Verify) from the Beads task descriptions loaded earlier. Use `bd ready --label ddx:{scope} --all --limit 0 --flat --json` to pick the next unblocked step.
   - If Beads is NOT enabled: read the plan.md file and identify Step 1.

2. For each step:
   - Tell the user which step you're working on: "Building Step {N}: {step name}"
   - Read the **Build** field to know what to implement.
   - Read the **Depends on** field to understand what should already exist.
   - Read the **Verify** field to know what success looks like.
   - Implement the step — write code, create files, install dependencies, whatever the step requires. Use the spec and design documents as your reference for technical decisions and UI details.
   - After implementing, run the verification described in the **Verify** field. If it passes, move to the next step. If it fails, fix the issue before moving on.

3. After completing each step:

   **If Beads tracking is enabled:**
   - At step start: `bd update {task-id} --status in_progress`
   - After verification passes: `bd close {task-id} --reason "Step {N} verified"`
   - The Claude Code PostToolUse hook automatically refreshes `plan.md` after each `bd` command. Do NOT manually regenerate it.
   - If a `bd` command fails, log a warning and continue.

   **If Beads is NOT enabled:**
   - Update `ddx/{scope}/plan.md` — mark the step as done by adding `[DONE]` to the step heading.

4. Continue to the next step.

## Completion

When all steps are done:

1. If this is a capability (scope is not `product`) and `ddx/product/plan.md` exists:

   **If Beads tracking is enabled:**
   - Close the parent capability task: `bd list --label ddx:{scope} --all --limit 0 --flat --json`, find the parent task, `bd close {task-id} --reason "{scope} capability complete"`
   - Close the product-plan task for this capability:
     `bd list --label ddx:product-plan --status open --all --limit 0 --flat --json`
     Find the task matching this capability name and close it:
     `bd close {task-id} --reason "{scope} capability complete"`
   - The hook automatically refreshes both `ddx/{scope}/plan.md` and `ddx/product/plan.md` after the `bd close` commands.

   **If Beads is NOT enabled:**
   - Read `ddx/product/plan.md`.
   - Find this capability's entry and update its **Status** from `in progress` to `complete`.
   - Write the updated product plan back to disk.

2. If there are more capabilities in the product plan that are not yet built, tell the user: "The {scope} capability is built. The next capability in the product plan is **{next-capability}**. Want me to run **`/ddx.build`** for it?"

3. If all capabilities are built (or this is a product-level build), tell the user: "All steps in the plan are complete. The {scope} capability is built."
