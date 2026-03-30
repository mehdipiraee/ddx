# DDX - Document-Driven Development

Replace guesswork with structured documents that keep AI and humans aligned from idea to shipped code.

## The Problem

AI coding assistants are powerful, but they build what they *think* you want. Without a shared source of truth, you get:

- **Scope drift** -- the AI adds features you never asked for, or misses the point entirely.
- **Rework loops** -- you describe something, the AI builds it wrong, you re-explain, it rebuilds. Repeat.
- **Lost context** -- every new conversation starts from zero. Prior decisions, constraints, and tradeoffs vanish.
- **No traceability** -- when something breaks or changes, there's no paper trail connecting "why we built it" to "how it's built."

The bigger the project, the worse it gets. A single prompt can't carry the weight of a real product.

## The Solution

DDX creates a chain of structured documents -- definition, design, spec, plan -- that capture your product decisions at each level of detail. Each document builds on the one before it.

```
definition  -->  design  -->  spec  -->  plan  -->  build
 (what/why)     (screens)   (how)     (steps)     (code)
```

You work through this chain interactively with Claude Code. At each stage, DDX interviews you, proposes solutions, and writes a document you can review and edit. When you reach the plan, DDX executes it step by step and writes the code.

Changes cascade. Update the definition, and DDX flags what's now inconsistent in the design, spec, and plan -- then offers to fix it.

Technical products without a UI (APIs, services, pipelines, CLIs) automatically skip the design phase and go straight from definition to spec.

## Example Use Cases

- **Greenfield product** -- you have an idea but no code. Run `/ddx.define` to clarify what you're building, then let DDX carry it through design, spec, plan, and build.
- **Existing codebase** -- you have code but no docs. Run `/ddx.derive` to reverse-engineer product documentation from your source code, then define new capabilities on top.
- **New capability on an existing product** -- the product is defined, now you need auth, billing, or notifications. Run `/ddx.define` again and DDX scopes it as a capability within the product.
- **Mid-project course correction** -- requirements changed. Run `/ddx.update`, describe the change, and DDX cascades it through every affected document.

## Installation

```bash
git clone <repository-url>
cd ddx
npm install
npm run build
npm link
```

This installs `ddx` as a global CLI command. You install it once and use it across all your projects.

## Usage

### Initialize a Project

```bash
cd my-project
ddx init
```

`ddx init` scaffolds DDX into your project -- config, prompts, templates, and Claude Code skills. It detects whether your project has existing code:

- **Existing code found** -- suggests `/ddx.derive` to generate docs from your codebase.
- **Empty project** -- suggests `/ddx.define` to start from scratch.

### The Document Chain

DDX has 7 skills you run as slash commands in Claude Code. Each one guides you through creating a specific document.

| Skill | What it does | Next step |
|-------|-------------|-----------|
| `/ddx.derive` | Analyzes existing code and generates product docs | `/ddx.define` (for first capability) |
| `/ddx.define` | Interactive interview to define the product or a capability | `/ddx.design` or `/ddx.spec` |
| `/ddx.design` | Generates wireframes and interaction design | `/ddx.spec` |
| `/ddx.spec` | Generates technical architecture and spec | `/ddx.plan` |
| `/ddx.plan` | Generates ordered build steps | `/ddx.build` |
| `/ddx.build` | Executes the plan -- writes code, step by step | next capability or done |
| `/ddx.update` | Updates any document and cascades changes downstream | -- |

Each skill suggests the next step when it's done and asks if you want to run it. You can also jump to any skill directly -- if upstream documents are missing, the skill generates them automatically.

### When to Use `/ddx.derive` vs `/ddx.define`

- **`/ddx.derive`** -- your project already has source code and you want DDX to document what exists. It reads your codebase and generates definition, design (if applicable), and spec documents. Use this as a starting point before defining new capabilities.
- **`/ddx.define`** -- you're starting from scratch, or you want to define a new capability for an already-documented product.

### Product vs Capability

The first thing you define becomes the **product**. Everything after that is a **capability** within the product.

```
ddx/
  product/            <-- defined first (the overall product)
    definition.md
    design.md
    spec.md
    plan.md           <-- sequences capabilities in build order
  auth/               <-- capability
    definition.md
    design.md
    spec.md
    plan.md           <-- detailed build steps
  billing/            <-- another capability
    ...
```

The product plan sequences capabilities in the order they should be built. Each capability has its own definition-through-plan chain with detailed build steps.

When you run `/ddx.define` and a product already exists, DDX automatically treats your request as a new capability. It checks existing capabilities for overlap -- if you're describing something that already exists, it updates the existing one instead of creating a duplicate.

### Technical Products

If your product doesn't have a user interface -- an API, a service, a data pipeline, a CLI tool, a library -- DDX detects this from the definition and skips the design phase entirely. The chain becomes:

```
definition  -->  spec  -->  plan  -->  build
```

No configuration needed. The skills infer the product type from what you describe.

### Design Modes

For products that do have a UI, `ddx init` asks you to choose a design mode:

- **ASCII** (default) -- Markdown files with ASCII wireframes. Lightweight, version-control friendly.
- **HTML** -- Single HTML file with Tailwind CSS mockups you can open in a browser. More visual fidelity.

## Project Scaffolding

Running `ddx init` creates the following structure in your project:

```
my-project/
  .ddx-tooling/
    config.yaml          # Document types, paths, LLM settings
    prompts/             # Generation instructions per document type
    templates/           # Document structure templates
    .env.example         # API key placeholder (for REPL only)
  .claude/
    skills/              # Claude Code skills (the /ddx.* commands)
    settings.local.json  # Auto-approved permissions for ddx/ files
  ddx/                   # Output directory for all generated documents
```

- **`.ddx-tooling/`** -- Configuration and prompt/template files DDX uses to generate documents. You can customize the prompts and templates.
- **`.claude/skills/`** -- The skill files that Claude Code reads when you run `/ddx.*` commands.
- **`ddx/`** -- Where all generated documents live, organized by scope (product, then capabilities).

## CLI Commands

| Command | Description |
|---------|-------------|
| `ddx init` | Scaffold DDX into the current project |
| `ddx init --force` | Re-scaffold, overwriting existing files (use after updating DDX) |
| `ddx list` | List document types and their status |
| `ddx` | Launch interactive REPL (requires `ANTHROPIC_API_KEY` in `.ddx-tooling/.env`) |

The REPL is a fallback interface that uses the Anthropic API directly. The primary interface is the Claude Code skills, which don't need an API key.

## Updating DDX

When the DDX package is updated:

```bash
cd /path/to/ddx
git pull
npm run build
```

Then in each project using DDX:

```bash
ddx init --force
```

This overwrites skills, prompts, and templates with the latest versions while preserving your `ddx/` documents and config customizations.

## License

MIT
