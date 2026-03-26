# Design: DDX v2

## Summary

DDX v2 is a server-centric documentation orchestration system. A shared server owns all logic — document management, dependency tracking, LLM interactions, template processing, and state management. Four thin client modes (CLI, Claude Skills, MCP, Web) connect to this server. This architecture ensures consistent behavior regardless of how the user interacts with DDX.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │   CLI    │  │  Claude  │  │   MCP    │  │     Web      │    │
│  │ (yargs)  │  │  Skills  │  │ (stdio)  │  │  (browser)   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
│       │              │             │                │             │
│       └──────────────┴──────┬──────┴────────────────┘             │
│                             │ HTTP / Direct call                  │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                        DDX Server                                │
│                     (Express.js + Core)                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    API Routes                             │    │
│  │  POST /api/mandate    POST /api/define                    │    │
│  │  POST /api/design     POST /api/plan                      │    │
│  │  POST /api/build      POST /api/derive                    │    │
│  │  GET  /api/documents  GET  /api/documents/:path           │    │
│  │  GET  /api/status     POST /api/check                     │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────┼───────────────────────────────┐    │
│  │                   Service Layer                           │    │
│  │                                                           │    │
│  │  ┌─────────────────┐  ┌──────────────────┐               │    │
│  │  │Document Service │  │Conversation Svc  │               │    │
│  │  │- CRUD ops       │  │- Prompt building │               │    │
│  │  │- Template load  │  │- LLM orchestr.   │               │    │
│  │  │- Dependency DAG │  │- History mgmt    │               │    │
│  │  │- Auto-numbering │  │- Context window  │               │    │
│  │  └─────────────────┘  └──────────────────┘               │    │
│  │                                                           │    │
│  │  ┌─────────────────┐  ┌──────────────────┐               │    │
│  │  │Consistency Svc  │  │  Workflow Svc    │               │    │
│  │  │- Semantic check │  │- Prereq check   │               │    │
│  │  │- Drift detect   │  │- Progressive    │               │    │
│  │  └─────────────────┘  │  decomposition  │               │    │
│  │                        │- Build orchestr.│               │    │
│  │                        └──────────────────┘               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────┼───────────────────────────────┐    │
│  │                Infrastructure Layer                       │    │
│  │  ┌───────────────┐  ┌────────────┐  ┌─────────────────┐  │    │
│  │  │ File Manager  │  │ LLM Client │  │ State Manager   │  │    │
│  │  │ - Read/Write  │  │ - Anthropic│  │ - Conversation  │  │    │
│  │  │ - Path resolve│  │ - Streaming│  │ - Workflow state│  │    │
│  │  │ - Dir create  │  │ - Retry    │  │ - JSON files    │  │    │
│  │  └───────────────┘  └────────────┘  └─────────────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
         │                     │                    │
         v                     v                    v
   File System            Anthropic API      .ddx-tooling/state/
```

## Interfaces

### Server API

All endpoints accept JSON and return JSON. LLM-streaming endpoints use Server-Sent Events (SSE).

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/mandate` | Create or update mandate |
| POST | `/api/define` | Create definition (auto-detects product/capability level) |
| POST | `/api/design` | Create design spec |
| POST | `/api/plan` | Create implementation plan |
| POST | `/api/build` | Execute build with prereq check |
| POST | `/api/derive` | Reverse-engineer docs from code |
| GET | `/api/documents` | List all DDX documents and their status |
| GET | `/api/documents/:path` | Read a specific document |
| POST | `/api/check` | Run consistency check |
| GET | `/api/status` | Server health and project state |

### Request/Response Format

```typescript
// Command request (shared by mandate, define, design, plan)
interface CommandRequest {
  flags?: {
    force?: boolean;     // -f
    quick?: boolean;     // -q (default true)
    dryRun?: boolean;    // -d
    verbose?: boolean;   // -v
    level?: 'product' | 'capability';  // -l
  };
  userInput?: string;    // What the user said
  capabilityName?: string;  // For capability-level operations
}

// Streaming response (SSE)
interface StreamEvent {
  type: 'token' | 'question' | 'document_written' | 'complete' | 'error';
  data: string | Question | DocumentResult | ErrorInfo;
}

interface Question {
  text: string;
  options?: string[];    // For closed-ended questions
  field: string;         // Which template field this answers
}

interface DocumentResult {
  path: string;          // Relative path to written document
  content: string;       // Full document content
  level: 'product' | 'capability';
  capabilityNumber?: number;
}
```

## Behavior

### Core Logic: Command Execution Flow

1. Client sends command request to server API
2. Server loads relevant context (mandate, existing docs, code)
3. Server loads prompt from `.ddx-tooling/prompts/{command}.md`
4. Server loads template from `.ddx-tooling/templates/{doctype}.md`
5. Conversation Service builds system prompt with context + prompt + template
6. LLM Client streams response
7. Server extracts document content from response (between `<doc>` tags)
8. Document Service writes file to `ddx/` directory
9. State Manager persists conversation for continuation
10. Server streams events back to client

### Scope Auto-Detection

```
if command is 'define':
  if ddx/product/define.md does not exist:
    level = 'product'
  else:
    level = 'capability'
    number = max(existing NNN-* folders) + 1

if command is 'design' or 'plan':
  if capabilityName is provided:
    find matching NNN-{capabilityName}/ folder
  else if only product/ exists and has no capabilities:
    level = 'product'
  else:
    ask user which capability to work on
```

### Prerequisite Chain (for ddx-build)

```
check ddx/mandate.md         → if missing, run mandate flow
check ddx/product/define.md  → if missing, run define (product) flow
check capability define.md   → if missing, run define (capability) flow
check capability design.md   → if missing, run design flow
check capability plan.md     → if missing, run plan flow
check capability test.md     → if missing, generate from define + design
all present → proceed to build
```

Missing docs are generated using quick mode (infer from context, minimal questions). All generated docs are presented as a summary for one user confirmation before build proceeds.

### State Management

- Conversation state stored as JSON in `.ddx-tooling/state/{conversationId}.json`
- Context window: sliding window of last 20 messages, system prompt always preserved
- State enables `continue` operations on interrupted workflows

## Data Model

### File System Layout

```
project/
├── .ddx-tooling/                    # Tooling (hidden)
│   ├── config.yaml                  # DDX configuration
│   ├── templates/                   # Document templates
│   │   ├── mandate.md
│   │   ├── define.md
│   │   ├── design.md
│   │   ├── plan.md
│   │   └── test.md
│   ├── prompts/                     # LLM prompts per command
│   │   ├── mandate.md
│   │   ├── define.md
│   │   ├── design.md
│   │   ├── plan.md
│   │   ├── build.md
│   │   └── derive.md
│   └── state/                       # Conversation persistence
│       └── {conversationId}.json
├── ddx/                             # Source of truth (visible)
│   ├── mandate.md
│   ├── product/
│   │   ├── define.md
│   │   ├── design.md
│   │   └── plan.md
│   ├── 001-{name}/
│   │   ├── define.md
│   │   ├── design.md
│   │   ├── plan.md
│   │   └── test.md
│   └── 002-{name}/
│       ├── define.md
│       ├── design.md
│       ├── plan.md
│       └── test.md
```

### Config Schema (`.ddx-tooling/config.yaml`)

```yaml
project:
  name: "project-name"
  description: "One-line description"

documents:
  mandate:
    template: templates/mandate.md
    prompt: prompts/mandate.md
    output: ddx/mandate.md

  define:
    template: templates/define.md
    prompt: prompts/define.md
    output_product: ddx/product/define.md
    output_capability: ddx/{NNN}-{name}/define.md

  design:
    template: templates/design.md
    prompt: prompts/design.md
    output_product: ddx/product/design.md
    output_capability: ddx/{NNN}-{name}/design.md

  plan:
    template: templates/plan.md
    prompt: prompts/plan.md
    output_product: ddx/product/plan.md
    output_capability: ddx/{NNN}-{name}/plan.md

  test:
    template: templates/test.md
    output_capability: ddx/{NNN}-{name}/test.md

llm:
  provider: anthropic
  model: claude-sonnet-4-20250514
  max_tokens: 8192
  temperature: 1.0

server:
  port: 3333
  host: localhost

conversation:
  max_messages_in_context: 20
  preserve_system_prompt: true
```

## Integration Points

### Anthropic Claude API
- HTTPS REST API with streaming support
- API key from `ANTHROPIC_API_KEY` env var
- Retry: 3x with exponential backoff on 429/500
- Timeout: 60s per request

### MCP Protocol
- stdio transport (JSON-RPC 2.0)
- Exposes tools: `ddx_mandate`, `ddx_define`, `ddx_design`, `ddx_plan`, `ddx_build`, `ddx_derive`, `ddx_list`, `ddx_check`
- Resources: `ddx://documents/{path}` for document access

### Claude Skills
- Each DDX command maps to a skill (ddx-mandate, ddx-define, etc.)
- Skills call the DDX server's HTTP API
- Skills handle the conversation UI; server handles the logic

### Web Interface
- React SPA served by Express
- WebSocket for real-time streaming
- REST API for document CRUD

## Failure Modes

| Failure | Impact | Handling |
|---------|--------|----------|
| LLM API unavailable | Cannot create/check docs | Allow reads, block writes. Clear error message. |
| LLM rate limited | Delayed operations | Exponential backoff, retry 3x |
| Invalid template | Broken document creation | Validate templates on server startup |
| Corrupted state file | Lost conversation | Detect invalid JSON, start fresh conversation |
| Missing upstream doc | Build cannot proceed | Auto-generate with quick mode |
| Disk full | Cannot write docs | Check available space before write, clear error |
| Port in use | Server won't start | Try next port, report to user |

## Constraints & Tradeoffs

1. **Server-centric over distributed**: All logic in one server process. Simpler but limits horizontal scaling. Acceptable for target scale (single developer to small teams).

2. **File system over database**: JSON files for state, markdown for documents. Simpler to understand and debug. Git-friendly. Limits concurrent access but acceptable at launch scale.

3. **Anthropic-only**: Single LLM provider at launch. Faster to build, limits user choice. Abstracted behind LLM Client interface for future multi-provider support.

4. **No auth at launch**: Web mode runs on localhost only. Simpler but blocks remote/team deployment. Add auth when user feedback demands it.

5. **Quick mode as default**: Prioritizes speed over thoroughness. May produce thinner documents. Can be overridden with `-f` flag. Decision based on reducing friction for adoption.
