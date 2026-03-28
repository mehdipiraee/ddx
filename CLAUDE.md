# DDX Project Rules

## Package Development Rules

- DDX is a package, not a standalone app. Users install it into other projects via `npm link` and run `ddx init` there. When asked to add or change something that lives in a consuming project (Claude Code skills in `.claude/commands/`, prompts, templates, config defaults, etc.), don't add it to this repo's own project files. Instead, update the ddx source code so that `ddx init` (or a future update command) scaffolds/copies those files into the consuming project. The consuming project is where the files need to end up — this repo is just the package that puts them there.

- Always rebuild (`npm run build:backend && npm link`) after modifying TypeScript source files. Don't leave the build step for the user — changes aren't deployed until built.

## Architecture

### Two Interfaces

1. **Claude Code skills (primary)** — `/ddx.derive`, `/ddx.define`, `/ddx.design`, `/ddx.spec`, `/ddx.plan`, `/ddx.update`, `/ddx.build` as slash commands. Skills are markdown files in `.claude/commands/`. They instruct Claude Code to read config/prompts/templates and conduct the interview directly. No API key needed — Claude Code IS the LLM.

2. **Interactive CLI (fallback)** — `ddx` with no args launches a REPL (`src/repl.ts`). Uses Anthropic API via the engine/service layer. Requires API key.

### CLI Commands

Three CLI commands: `ddx init`, `ddx list`, and `ddx` (REPL launcher). Derive is a skill only (`/ddx.derive`) — it requires an LLM, and at init time no API key exists yet. There are no `create`, `continue`, or `check` subcommands.

### Skill to Document Type Mapping

| Skill | Document Type | Output | Upstream |
|-------|--------------|--------|----------|
| `/ddx.derive` | derive from codebase | product/* | none |
| `/ddx.define` | definition | definition.md | none (root) |
| `/ddx.design` | design | design.md | definition |
| `/ddx.spec` | spec | spec.md | definition, design |
| `/ddx.plan` | plan | plan.md | definition, design, spec |
| `/ddx.update` | update | any doc | all docs in scope |
| `/ddx.build` | build | code | plan, spec, design, definition |

Skills don't call the ddx engine programmatically. They tell Claude Code to read files and write documents directly. The engine (`src/engine.ts`) is for the REPL and library consumers.

### Source Layout

```
src/                  TypeScript source
  cli.ts              CLI entry (Commander.js) — init, list, REPL launcher
  engine.ts           DDXEngine — structured returns, no console output
  repl.ts             Interactive REPL (readline)
  init.ts             Project scaffolding (ddx init)
  index.ts            Library entry point (exports DDXEngine + types)
  types.ts            All TypeScript interfaces
  infra/
    config.ts         ConfigLoader (YAML)
    file-manager.ts   FileManager (I/O)
    llm-client.ts     LLMClient (Anthropic SDK)
    state-manager.ts  StateManager (JSON persistence)
  services/
    conversation-service.ts   Multi-turn conversation state
    document-service.ts       Document CRUD + template handling
    consistency-service.ts    LLM-based consistency checking
    derive-service.ts         Codebase analysis + product doc generation

commands/             Source skill files (scaffolded to .claude/commands/ by ddx init)
  ddx.derive.md
  ddx.define.md
  ddx.design.md
  ddx.spec.md
  ddx.plan.md
  ddx.update.md
  ddx.build.md

prompts/              Source prompt files (scaffolded to .ddx-tooling/prompts/ by ddx init)
templates/            Source template files (scaffolded to .ddx-tooling/templates/ by ddx init)
ddx.config.yaml       Source config (scaffolded to .ddx-tooling/config.yaml by ddx init)
```

### Scoping: Product vs Capability

Output paths use `{scope}` placeholder: `ddx/{scope}/definition.md`. Skills resolve scope at runtime by inspecting the `ddx/` directory:

- **Empty `ddx/`** → first thing defined = product (`ddx/product/`)
- **`ddx/product/` exists** → everything after = capability (`ddx/{capability-name}/`)
- **No product but code exists** → `/ddx.init` derives product definition, design, spec from codebase
- **Product plan** sequences capabilities in build order. **Capability plan** has detailed build steps.

When defining a new capability, skills check existing capabilities for overlap. If a match is found, the user can update the existing capability instead of creating a new one. Updates append versioned sections (`## v2 — {date}: {what changed}`).

```
ddx/
├── product/
│   ├── definition.md
│   ├── design.md
│   ├── spec.md
│   └── plan.md          ← sequences capabilities
├── auth/                 ← capability
│   ├── definition.md
│   ├── design.md
│   ├── spec.md
│   └── plan.md          ← build steps
```

### Config

Consuming projects have `.ddx-tooling/config.yaml` (copied from `ddx.config.yaml` during `ddx init`). It defines document types, their prompt/template/output paths (with `{scope}` placeholder), upstream/downstream relationships, and LLM settings. Skills land in `.claude/commands/` of the consuming project.
