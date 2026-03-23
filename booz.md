# DDX v1 → v2 Reconciliation Plan

## The Big Shift

**Current (v1):** Monolithic CLI — business logic lives inside the CLI process. Commander.js parses commands, services run in-process, results print to terminal.

**Future (v2):** Server-centric architecture — a Core Engine HTTP server owns all logic. CLI, Claude Skills, MCP Server, and Web UI are all thin clients that talk to the server over HTTP/SSE/WebSocket.

This is the single most important architectural change. Everything else follows from it.

---

## Command Mapping

### Current Commands (v1)

| Command                   | What it does                                                         |
| ------------------------- | -------------------------------------------------------------------- |
| `ddx init`                | Scaffold project (config, prompts, templates, sotdocs)               |
| `ddx create <doc-type>`   | Generate a document via LLM (opportunity_brief, one_pager, prd, sdd) |
| `ddx continue <doc-type>` | Resume multi-turn conversation for a document                        |
| `ddx check <doc-type>`    | Consistency check against upstream/downstream                        |
| `ddx list`                | List available document types                                        |

### Future Commands (v2)

| Command                   | What it does                                                 |
| ------------------------- | ------------------------------------------------------------ |
| `ddx mandate`             | Scan project, infer conventions, define project mandate      |
| `ddx define [capability]` | Scope + define a product or capability                       |
| `ddx design [capability]` | Translate definition into technical spec                     |
| `ddx plan [capability]`   | Decompose design into ordered, testable implementation steps |
| `ddx build [capability]`  | (New) Execute plan steps with code generation                |
| `ddx derive [capability]` | (New) Generate derivative artifacts                          |
| `ddx list`                | List documents/capabilities                                  |
| `ddx check`               | Consistency verification                                     |

### How They Relate

v1's `create` and `continue` are **generic** — they work on any configured document type. v2 replaces this with **named workflow stages** (`mandate → define → design → plan → build → derive`), each with its own dedicated prompt and behavior.

| v1                             | v2 Equivalent            | Notes                                                                                               |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------- |
| `ddx init`                     | `ddx mandate`            | v2's mandate is richer — it scans the project and asks questions rather than just copying templates |
| `ddx create opportunity_brief` | `ddx mandate`            | The opportunity brief becomes the mandate                                                           |
| `ddx create one_pager`         | `ddx define`             | One-pager maps to the define stage                                                                  |
| `ddx create prd`               | `ddx design`             | PRD maps to the design stage                                                                        |
| `ddx create sdd`               | `ddx plan`               | SDD maps to the plan stage                                                                          |
| `ddx continue <type>`          | Implicit in each command | v2 commands auto-detect whether to create or continue based on state                                |
| `ddx check`                    | `ddx check`              | Same concept, expanded to handle capability scoping                                                 |
| `ddx list`                     | `ddx list`               | Same concept, expanded to show capabilities + their document status                                 |
| *(none)*                       | `ddx build`              | New — code generation from plan                                                                     |
| *(none)*                       | `ddx derive`             | New — derivative artifact generation                                                                |

### Key Insight

v1 treats document types as **configuration** (defined in YAML, you can add arbitrary types). v2 treats workflow stages as **first-class operations** with hardcoded names but scoped to product vs. capability level. The document hierarchy is fixed (`mandate → define → design → plan → test`) but repeats at each capability level.

---

## Architecture Comparison

### v1 Architecture (Current)

```
CLI (Commander.js)
  └── WorkflowEngine (orchestration + formatting)
        ├── services/
        │     ├── ConversationService (create/continue workflows)
        │     ├── DocumentService (read/write/extract docs)
        │     └── ConsistencyService (LLM-based drift detection)
        └── infra/
              ├── ConfigLoader (YAML)
              ├── FileManager (I/O)
              ├── StateManager (JSON persistence)
              └── LLMClient (Anthropic SDK)
```

Everything runs in one process. Infrastructure is separated from business logic, but both are tightly coupled to the CLI lifecycle.

### v2 Architecture (Planned)

```
Core Engine (Express HTTP Server)
  ├── Document CRUD + template loading
  ├── LLM integration (streaming via SSE)
  ├── State persistence (conversation history)
  ├── Scope detection (product vs capability)
  ├── Auto-numbering (001-name, 002-name)
  ├── Prerequisite chain enforcement
  └── Consistency checking

Thin Clients (all talk to Core Engine over HTTP):
  ├── CLI (yargs, SSE streaming, auto-start server)
  ├── Claude Skills (6 skills, trigger recognition)
  ├── MCP Server (JSON-RPC 2.0 over stdio, 9 tools)
  └── Web UI (React + Vite + TailwindCSS + WebSocket)
```

### What Can Be Reused

| v1 Component | v2 Fate | Rationale |
|-------------|---------|-----------|
| `DocumentService` | **Refactor into Core Engine** | Logic is solid. Needs scope detection (product vs capability) and auto-numbering added. |
| `ConversationService` | **Refactor into Core Engine** | Create/continue logic stays. Remove CLI coupling, add streaming support. |
| `ConsistencyService` | **Refactor into Core Engine** | Same concept. Add prerequisite chain enforcement. |
| `ConfigLoader` | **Replace** | v2 uses `.ddx-tooling/config.yaml` with different schema (capabilities, not arbitrary doc types). |
| `FileManager` | **Keep as-is** | Simple I/O, no changes needed. |
| `StateManager` | **Enhance** | Same JSON approach, but needs per-capability state and richer workflow tracking. |
| `LLMClient` | **Enhance** | Add streaming support (SSE), keep Anthropic SDK. |
| `WorkflowEngine` | **Split** | Orchestration moves to Core Engine. CLI formatting stays in CLI client. |
| `cli.ts` | **Rewrite** | Becomes thin HTTP client. Switch from Commander to yargs. |
| `init.ts` | **Rewrite** | Replaced by `mandate` command logic in Core Engine. |
| `types.ts` | **Evolve** | Core types stay, add capability scoping types. |
| `prompts/` | **Replace** | v2 has its own prompt set (mandate, define, design, plan, build, derive). |
| `templates/` | **Replace** | v2 uses `.ddx-tooling/templates/` with different structure. |

---

## How Current + Future Commands Can Coexist

There are two viable strategies:

### Option A: Clean Break (Recommended)

v2 is a new codebase. The service layer patterns from v1 inform v2's Core Engine design, but there's no code sharing at runtime.

**Pros:** No backwards compatibility baggage. v2's `.ddx-tooling/` directory structure is fundamentally different from v1's `ddx/` structure.
**Cons:** Existing v1 projects need migration.

### Option B: Progressive Migration

Keep v1 commands working while adding v2 commands. A compatibility layer maps between document types and workflow stages.

**Pros:** No disruption for existing users.
**Cons:** Two mental models coexist. Config format conflicts (v1 uses `ddx.config.yaml`, v2 uses `.ddx-tooling/config.yaml`).

**Recommendation: Option A.** The document hierarchy, directory structure, and command philosophy are different enough that trying to bridge them adds complexity without real value. v1 is a prototype; v2 is the product.

---

## Migration Path (v1 → v2)

### Phase 1: Core Engine (001)

Extract v1's service layer into an Express HTTP server:

1. Take `DocumentService`, `ConversationService`, `ConsistencyService` as starting points
2. Add HTTP routes for each operation
3. Add SSE streaming for LLM responses
4. Replace YAML config with `.ddx-tooling/config.yaml` schema
5. Add scope detection (product vs capability level)
6. Add auto-numbering for capability folders
7. Add prerequisite chain enforcement (mandate before define, define before design, etc.)
8. File system state (JSON), same as v1

**Reuse from v1:** Service patterns, `FileManager`, `StateManager` approach, `LLMClient` (add streaming).

### Phase 2: CLI Client (002)

Rewrite CLI as thin HTTP client:

1. Switch from Commander.js to yargs
2. Each command sends HTTP request to Core Engine
3. SSE parser for streaming LLM output to terminal
4. Auto-start server if not running (background process)
5. Add flags: `-f` force, `-q` quick, `-d` dry-run, `-v` verbose, `-l` level

**Reuse from v1:** Terminal formatting patterns (chalk), UX flow for create/continue.

### Phase 3: Claude Skills (003)

Six Claude Code skills wrapping Core Engine HTTP calls:

1. `ddx-mandate`, `ddx-define`, `ddx-design`, `ddx-plan`, `ddx-build`, `ddx-derive`
2. Each skill: detect trigger → parse scope → check prerequisites → call server → stream response
3. Bidirectional with CLI (same server, same state)

**Reuse from v1:** Nothing directly, but prompt engineering experience transfers.

### Phase 4: MCP Server (004)

JSON-RPC 2.0 adapter over stdio:

1. 9 MCP tools exposing all DDX operations
2. Resource URIs: `ddx://documents/{path}`
3. HTTP-to-MCP translation layer
4. Works with Claude Code and VS Code

**Reuse from v1:** Nothing directly.

### Phase 5: Web UI (005)

React SPA:

1. Dashboard (document list, search, filter)
2. Document viewer (markdown rendering)
3. Document creator (chat interface with streaming)
4. Dependency graph visualization
5. WebSocket for real-time updates

**Reuse from v1:** Nothing directly.

---

## Concept Mapping: v1 Document Types → v2 Workflow Stages

### v1: Configurable Document Hierarchy

```
opportunity_brief → one_pager → prd → sdd
     (root)         (depends)   (depends)  (leaf)
```

Documents are **generic** — you define them in YAML with name, prompt, template, output path, upstream, downstream. The system doesn't know what a "PRD" is; it just follows the dependency graph.

### v2: Fixed Workflow Stages with Scoping

```
Product Level:
  mandate.md → define.md → design.md → plan.md

Capability Level (repeats per capability):
  001-core-engine/
    define.md → design.md → plan.md → test.md
  002-cli-interface/
    define.md → design.md → plan.md → test.md
  ...
```

Stages are **semantic** — the system knows that `define` means scoping/requirements, `design` means technical architecture, `plan` means implementation steps. Each stage has its own dedicated LLM prompt.

### What This Means for Implementation

v1's `ConfigLoader` that reads arbitrary document types from YAML **cannot be reused** for v2's fixed workflow stages. Instead, v2 hardcodes the stage sequence and uses config only for project-level settings (LLM model, paths, etc.).

v1's `DocumentService.buildDocumentChain()` maps loosely to v2's prerequisite enforcement, but v2 adds the product/capability scope dimension that v1 doesn't have.

---

## Summary: What Carries Forward

| From v1 | To v2 | Form |
|---------|-------|------|
| Service layer pattern | Core Engine internal architecture | Architectural pattern |
| Document extraction from LLM responses | Core Engine document service | Code/logic reuse |
| Multi-turn conversation state | Core Engine state management | Pattern + code reuse |
| Consistency checking concept | Core Engine consistency service | Pattern reuse, expanded scope |
| File-based JSON state | Same approach in Core Engine | Direct reuse |
| Chalk terminal formatting | CLI client output | Direct reuse |
| Anthropic SDK integration | Core Engine LLM client | Code reuse + streaming addition |

| New in v2 | Not in v1 |
|-----------|-----------|
| HTTP server (Express) | v1 has no server |
| SSE streaming | v1 blocks until LLM completes |
| Scope detection (product/capability) | v1 is flat |
| Auto-numbering (001-, 002-) | v1 has no capability concept |
| Prerequisite enforcement | v1 validates config refs but doesn't enforce order |
| Claude Skills | v1 is CLI-only |
| MCP Server | v1 is CLI-only |
| Web UI | v1 is CLI-only |
| `build` command (code gen) | v1 stops at documentation |
| `derive` command | v1 has no derivative concept |

---

## Recommended Execution Order

1. **Build Core Engine first.** It's the foundation everything else depends on. Port v1's service logic, add HTTP layer + streaming + scoping.
2. **Build CLI second.** It validates the Core Engine API and is the fastest feedback loop for development.
3. **Build Claude Skills third.** This is the primary use case for conversational document generation.
4. **Build MCP Server fourth.** Protocol adapter, straightforward once Core Engine API is stable.
5. **Build Web UI last.** Largest surface area, needs stable API, broadest audience but least critical for early adoption.

This matches v2's planned capability order (001 through 005) exactly.
