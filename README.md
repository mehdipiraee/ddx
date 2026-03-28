# DDX - Document-Driven Development

Define, design, spec, plan, and build software through structured documents. DDX works as a set of Claude Code skills that guide you from idea to implementation.

## Install

```bash
git clone <repository-url>
cd ddx
npm install
npm run build
npm link
```

## Use in any project

```bash
cd my-project
ddx init
```

`ddx init` scaffolds everything and tells you what to do next. If your project has existing files, it suggests `/ddx.derive`. If it's empty, it suggests `/ddx.define`.

## How it works

DDX creates a `ddx/` folder in your project with structured documents organized by scope:

```
ddx/
├── product/              # product-level docs (created first)
│   ├── definition.md     # what and why
│   ├── design.md         # wireframes and interactions
│   ├── spec.md           # architecture and tech decisions
│   └── plan.md           # capability sequence
├── auth/                 # capability
│   ├── definition.md
│   ├── design.md
│   ├── spec.md
│   └── plan.md           # build steps
└── billing/              # another capability
    └── ...
```

The first thing you define becomes the **product**. Everything after that is a **capability** within that product.

## Skills (Claude Code)

Run these as slash commands in Claude Code. No API key needed — Claude Code is the LLM.

| Skill | What it does |
|-------|-------------|
| `/ddx.derive` | Analyze existing codebase and generate product docs |
| `/ddx.define` | Interactive interview to define product or capability |
| `/ddx.design` | Generate wireframes and interaction design from definition |
| `/ddx.spec` | Generate technical spec from definition and design |
| `/ddx.plan` | Generate build plan from all upstream docs |
| `/ddx.update` | Update any document — cascades changes downstream |
| `/ddx.build` | Execute the plan step by step — writes code |

Skills are frictionless. If upstream docs are missing, they generate them automatically. If there's no product yet, the first thing you ask for becomes the product.

## Document chain

```
definition → design → spec → plan → build
```

Each document builds on its upstream. `/ddx.update` checks consistency across the chain and cascades changes.

## CLI Commands

| Command | Description |
|---------|-------------|
| `ddx init` | Scaffold DDX into the current project |
| `ddx list` | List document types and their status |
| `ddx` | Launch interactive REPL (requires API key) |

## What `ddx init` creates

```
my-project/
├── .ddx-tooling/
│   ├── config.yaml        # Document types, paths, LLM settings
│   ├── prompts/           # Generation instructions per document type
│   ├── templates/         # Document structure templates
│   └── .env.example       # API key placeholder (for REPL only)
├── .claude/
│   ├── commands/          # Claude Code skills
│   └── settings.local.json # Auto-approved permissions for ddx/
└── ddx/                   # Output — all generated documents
```

## Updating

After pulling new changes to the ddx package:

```bash
cd /path/to/ddx
git pull
npm run build
```

Then in each project using ddx:

```bash
ddx init --force
```

## License

MIT
