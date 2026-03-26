# System Design Document

## Summary

DDX (Document Dependency eXchange) is an AI-powered documentation orchestration system that maintains alignment across the software development lifecycle through dependency tracking and semantic consistency checking. The system provides four interaction modes—CLI, Interactive REPL, Web Interface, and MCP Server—all built on a shared service layer that manages document creation workflows, LLM interactions, and dependency graph operations.

## Context & Requirements

### Scale & Performance
- **Users**: Single developer to small teams (5-10 people) initially
- **Documents**: Up to 100 documents per project
- **Response time**: LLM interactions 2-10s depending on provider; local operations < 500ms
- **Concurrency**: Web mode supports multiple simultaneous users on same project

### Non-Functional Requirements
- **Reliability**: Workflow state persistence to resume interrupted sessions
- **Extensibility**: Pluggable document templates and prompts via filesystem
- **Portability**: Node.js-based, cross-platform (macOS, Linux, Windows)
- **Observability**: Structured logging for LLM calls, file operations, and consistency checks
- **Security**: API keys stored in environment variables; no credentials in config files

### Constraints
- Depends on external LLM providers (Anthropic Claude API)
- Stateful workflows require local file system access
- Web mode requires network connectivity for WebSocket communication
- MCP mode requires stdio communication (no interactive user input)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Interaction Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   CLI    │  │   REPL   │  │    Web   │  │   MCP    │   │
│  │  (yargs) │  │(readline)│  │ (Express)│  │ (stdio)  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                     Service Layer                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐│
│  │ Document Service │  │Conversation Svc  │  │Consistency  ││
│  │ - CRUD ops       │  │ - History mgmt   │  │Service      ││
│  │ - Template load  │  │ - Prompt build   │  │ - Semantic  ││
│  │ - Extraction     │  │ - LLM orchestr.  │  │   validation││
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬──────┘│
└───────────┼─────────────────────┼────────────────────┼───────┘
            │                     │                    │
┌───────────┼─────────────────────┼────────────────────┼───────┐
│                    Infrastructure Layer                       │
│  ┌────────┴─────────┐  ┌───────┴──────┐  ┌─────────┴──────┐│
│  │  File Manager    │  │  LLM Client  │  │ State Manager  ││
│  │  - Read/Write    │  │  - Streaming │  │ - Conversation ││
│  │  - Graph walk    │  │  - Anthropic │  │   persistence  ││
│  └──────────────────┘  └──────────────┘  └────────────────┘│
└─────────────────────────────────────────────────────────────┘
            │                     │                    │
            v                     v                    v
      File System            Anthropic API        .ddx/ folder
```

### Key Flows

**Document Creation Flow:**
1. User initiates creation via any mode
2. Document Service loads template & upstream docs
3. Conversation Service builds system prompt
4. LLM Client streams response
5. Document Service extracts markdown and writes file
6. State Manager persists conversation for resumption (with extraction state)

**Conversation Continue Flow:**
1. User runs `continue` command for existing conversation
2. State Manager loads conversation and applies context window (sliding window of last 20 messages)
3. Conversation Service sends windowed messages to LLM
4. LLM Client streams response
5. Document Service updates document extraction state
6. State Manager persists updated conversation

**Consistency Check Flow:**
1. User requests check for document
2. Consistency Service loads upstream/downstream docs
3. LLM Client analyzes semantic alignment
4. Results returned with specific inconsistencies flagged

## Component Details

### 1. Interaction Layer

#### CLI Mode (`src/cli.ts`)
- **Responsibilities**: Parse arguments, dispatch to services, handle one-shot commands
- **Technology**: yargs for argument parsing
- **Commands**: `init`, `create`, `continue`, `check`, `list`, `experience`, `serve`, `mcp`
- **Boundaries**: No business logic; purely routing and output formatting

#### Interactive REPL Mode (`src/modes/interactive-cli.ts`)
- **Responsibilities**: Stateful session management, command parsing without prefix
- **Technology**: Node.js readline for terminal I/O
- **Commands**: All CLI commands available without `ddx` prefix, plus `switch`, `status`, `exit`
- **State**: Maintains current document type in session memory
- **Boundaries**: Session lifecycle only; delegates all operations to services

#### Web Interface (`src/server/` + `web/`)
- **Backend Responsibilities**: HTTP API endpoints, WebSocket management, SSE streaming
- **Frontend Responsibilities**: React-based UI with split-pane chat + document preview
- **Technology**: Express.js, ws (WebSocket), React, Vite, TailwindCSS
- **API Endpoints**:
  - `GET /api/documents` - List document types
  - `GET /api/documents/:type` - Read document
  - `POST /api/documents/:type/create` - Start workflow
  - `POST /api/documents/:type/continue` - Continue workflow
  - `GET /api/documents/:type/check` - Run consistency check
- **WebSocket**: Bidirectional real-time updates for streaming LLM responses
- **Boundaries**: Backend has no AI logic; frontend has no file system access

#### MCP Server Mode (`src/modes/mcp-server.ts`)
- **Responsibilities**: Expose DDX operations as MCP tools, communicate via stdio
- **Technology**: @modelcontextprotocol/sdk
- **Tools Exposed**: `ddx_create_document`, `ddx_continue_document`, `ddx_check_consistency`, `ddx_list_documents`, `ddx_read_document`, `ddx_get_state`
- **Resources**: Documents exposed as `ddx://documents/{type}` URIs
- **Boundaries**: No interactive prompts; all inputs via tool parameters

### 2. Service Layer

#### Document Service (`src/services/document-service.ts`)
- **Responsibilities**:
  - Load document config from `ddx.config.yaml`
  - Resolve upstream/downstream document dependencies
  - Extract markdown from LLM responses (between `<doc>` tags)
  - Write/read documents to/from file system
  - Build dependency graph
- **Key Methods**:
  - `loadDocumentConfig(type): DocumentConfig`
  - `loadUpstreamDocuments(type): string[]`
  - `extractAndWriteDocument(response, type): void`
  - `readDocument(type): string | null`
  - `buildDependencyGraph(): Graph`
- **Boundaries**: No LLM interaction; no conversation history

#### Conversation Service (`src/services/conversation-service.ts`)
- **Responsibilities**:
  - Build system prompts from templates and upstream docs
  - Manage conversation history (user + assistant messages)
  - Orchestrate multi-turn LLM interactions
  - Persist and restore conversation state
  - Apply context window management via State Manager
- **Key Methods**:
  - `buildSystemPrompt(type, upstream): string`
  - `sendMessage(message, conversationId): AsyncIterator<string>`
  - `continueConversation(conversationId): AsyncIterator<string>`
  - `getConversationHistory(conversationId): Message[]`
  - `saveConversationState(conversationId): void`
- **Context Handling**: Delegates to State Manager for context window truncation; always uses windowed messages for LLM calls
- **Boundaries**: No file writing (delegates to Document Service); no direct API calls (uses LLM Client)

#### Consistency Service (`src/services/consistency-service.ts`)
- **Responsibilities**:
  - Load document and its dependencies
  - Build consistency check prompt
  - Invoke LLM for semantic validation
  - Parse and structure inconsistency findings
- **Key Methods**:
  - `checkConsistency(type): ConsistencyReport`
  - `buildCheckPrompt(doc, upstream, downstream): string`
- **Boundaries**: Read-only operations; no document modification

### 3. Infrastructure Layer

#### File Manager (`src/file-manager.ts`)
- **Responsibilities**: All file system operations (read/write), path resolution, directory creation
- **Key Methods**:
  - `readFile(path): string`
  - `writeFile(path, content): void`
  - `ensureDirectory(path): void`
  - `listFiles(pattern): string[]`
- **Boundaries**: Pure I/O; no parsing or validation

#### LLM Client (`src/llm-client.ts`)
- **Responsibilities**:
  - Anthropic API communication
  - Request/response handling
  - Token streaming support
  - Error handling and retry logic
- **Key Methods**:
  - `sendMessage(prompt, stream=false): string | AsyncIterator<string>`
  - `streamMessage(prompt): AsyncIterator<string>`
- **Configuration**: API key from `ANTHROPIC_API_KEY` env var; model configurable in `ddx.config.yaml`
- **Boundaries**: No prompt construction; no response parsing

#### State Manager (`src/state-manager.ts`)
- **Responsibilities**:
  - Persist conversation history to `.ddx/state/` folder
  - Restore interrupted workflows with context window management
  - Track document creation progress and extraction state
  - Manage conversation history truncation to prevent context overflow
- **Storage Format**: JSON files per conversation ID
- **Key Methods**:
  - `saveState(conversationId, state): void`
  - `loadState(conversationId): State | null`
  - `deleteState(conversationId): void`
  - `buildContextWindow(conversationId): Message[]`
- **Context Window Strategy**:
  - Sliding window: Keep last N messages (configurable, default 20)
  - Always preserve system prompt (pinned to context)
  - Track document extraction state across sessions
  - Prevents context window overflow in multi-turn conversations
- **Boundaries**: No conversation logic; pure persistence and window management

## Data Model & Storage

### Document Configuration Schema (`ddx.config.yaml`)
```yaml
documents:
  - type: opportunity_brief
    template: templates/opportunity_brief_template.md
    prompt: prompts/opportunity_brief_prompt.md
    output: sotdocs/opportunity_brief.md
    upstream: []
    downstream: [one_pager]

  - type: one_pager
    template: templates/one_pager_template.md
    prompt: prompts/one_pager_prompt.md
    output: sotdocs/one_pager.md
    upstream: [opportunity_brief]
    downstream: [prd]

  - type: prd
    template: templates/prd_template.md
    prompt: prompts/prd_prompt.md
    output: sotdocs/prd.md
    upstream: [one_pager]
    downstream: [sdd]

  - type: sdd
    template: templates/sdd_template.md
    prompt: prompts/sdd_prompt.md
    output: sotdocs/sdd.md
    upstream: [prd]
    downstream: []

llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  max_tokens: 4096
  temperature: 0.7

conversation:
  max_messages_in_context: 20      # Sliding window size for context management
  preserve_system_prompt: true     # Always include system prompt in context
  track_extraction_state: true     # Preserve partial document state across sessions
```

### Conversation State Schema (`.ddx/state/{conversationId}.json`)
```json
{
  "conversationId": "create_opportunity_brief_2026-02-28",
  "documentType": "opportunity_brief",
  "messages": [
    {
      "role": "system",
      "content": "System prompt with template and instructions..."
    },
    {
      "role": "user",
      "content": "I want to build a mobile fitness app"
    },
    {
      "role": "assistant",
      "content": "Great! Let me ask a few questions..."
    }
  ],
  "extractionState": {
    "status": "in_progress",
    "accumulatedContent": "# Opportunity Brief\n\n## Problem Statement\n...",
    "lastTagPosition": "opening"
  },
  "messageCount": 8,
  "createdAt": "2026-02-28T10:30:00Z",
  "updatedAt": "2026-02-28T10:35:00Z",
  "status": "in_progress"
}
```

### Document Dependency Graph
- **Structure**: Directed acyclic graph (DAG)
- **Nodes**: Document types
- **Edges**: upstream → downstream relationships
- **Access Pattern**: Traversal for loading upstream context and checking downstream impact
- **Storage**: Derived from `ddx.config.yaml` at runtime (not persisted)

### File System Layout
```
project/
├── .ddx/
│   └── state/
│       └── {conversationId}.json      # Conversation persistence
├── sotdocs/                           # Output documents
│   ├── opportunity_brief.md
│   ├── one_pager.md
│   ├── prd.md
│   └── sdd.md
├── templates/                         # Document templates
│   ├── opportunity_brief_template.md
│   └── ...
├── prompts/                           # LLM prompts
│   ├── opportunity_brief_prompt.md
│   └── ...
└── ddx.config.yaml                   # Configuration
```

## Integration Points

### Anthropic Claude API
- **Protocol**: HTTPS REST API
- **Authentication**: API key in `Authorization: Bearer {key}` header
- **Endpoints**:
  - `POST https://api.anthropic.com/v1/messages` - Send message
  - Streaming via `stream: true` parameter
- **Models Supported**: `claude-3-5-sonnet-20241022` (default), `claude-3-opus-20240229`
- **Rate Limits**: Provider-dependent; client implements exponential backoff
- **Failure Modes**:
  - Network timeout → Retry 3x with exponential backoff
  - 429 Rate Limit → Wait and retry
  - 500 Server Error → Retry 2x then fail gracefully
  - Invalid API key → Clear error message to user

### Model Context Protocol (MCP)
- **Protocol**: stdio (standard input/output)
- **Communication**: JSON-RPC 2.0 messages
- **Server Type**: Tools + Resources server
- **Client Integration**: Claude Desktop, VSCode extensions, custom MCP clients
- **Failure Modes**:
  - Client disconnects → Clean shutdown
  - Malformed request → Return JSON-RPC error
  - Tool execution failure → Return error in tool response

### WebSocket (Web Mode)
- **Protocol**: ws:// (WebSocket)
- **Events**:
  - Client → Server: `message`, `create_document`, `continue_document`, `check_consistency`
  - Server → Client: `llm_token`, `document_updated`, `error`, `complete`
- **Failure Modes**:
  - Connection lost → Client auto-reconnect with exponential backoff
  - Large payload → Chunk responses into multiple messages
  - Concurrent operations → Queue requests per conversation ID

## Operational Considerations

### Monitoring & Observability
- **Logging**: Structured JSON logs with Winston library
  - Levels: ERROR, WARN, INFO, DEBUG
  - Log LLM requests with prompt hash (not full prompt for privacy)
  - Log file operations with paths and outcome
  - Log API errors with status codes and retry attempts
- **Metrics to Track**:
  - LLM latency (P50, P95, P99)
  - Document creation success rate
  - Consistency check findings per document type
  - API error rate by status code
- **Health Checks**:
  - Web mode: `GET /health` endpoint returns 200 if server operational
  - MCP mode: Responds to `ping` tool call

### Error Handling Strategy
- **User-Facing Errors**: Clear, actionable messages (e.g., "API key missing. Set ANTHROPIC_API_KEY environment variable.")
- **Developer Errors**: Stack traces logged at DEBUG level
- **Graceful Degradation**: If LLM unavailable, allow document reads but block creation/checking
- **Idempotency**: `ddx create` can be re-run safely; checks for existing document first

### Deployment & Rollback
- **Deployment**: npm package published to registry; users install via `npm install -g ddx`
- **Version Management**: Semantic versioning; breaking changes only in major releases
- **Migration Strategy**:
  - Config schema changes: Auto-migrate on first run
  - State format changes: Fallback to re-starting workflows if incompatible
- **Rollback**: Users downgrade via `npm install -g ddx@<previous-version>`

### Resilience Model
- **State Persistence**: All conversation state persisted after each LLM interaction
- **Crash Recovery**: `ddx continue` resumes from last saved state
- **Partial Failures**: If document extraction fails, conversation history still saved for manual extraction
- **Backup Strategy**: Users responsible for versioning `sotdocs/` folder (recommend git)

### Performance Considerations
- **Cold Start**: First `ddx create` takes 2-10s (LLM latency); subsequent `continue` calls similar
- **Web Mode Concurrency**: Single Node.js process handles ~100 concurrent WebSocket connections
- **Memory Usage**: Conversation history kept in memory during session; sliding window (20 messages) prevents unbounded growth; typical usage < 100MB
- **Context Window Management**: Sliding window approach keeps context bounded; system prompt always preserved; prevents LLM context overflow in long conversations
- **Disk I/O**: Minimal; only on document writes and state persistence

## Risks & Tradeoffs

### Known Compromises

1. **Single LLM Provider Dependency**
   - **Risk**: If Anthropic API is down, DDX is unusable
   - **Mitigation**: Future work to support multiple providers (OpenAI, local models)
   - **Trigger**: When 3+ users request alternative providers

2. **No Real-Time Collaboration in Web Mode**
   - **Risk**: Two users editing same document simultaneously causes conflicts
   - **Mitigation**: File system locking; last-write-wins
   - **Trigger**: When team size > 5 people using web mode concurrently

3. **Stateful Workflows Require File System**
   - **Risk**: Cannot run in stateless serverless environments easily
   - **Mitigation**: Future work to support external state stores (Redis, S3)
   - **Trigger**: When hosting DDX as a service for multiple teams

4. **Consistency Checking is LLM-Based**
   - **Risk**: Non-deterministic; may miss issues or false-positive
   - **Mitigation**: Provide user override; log all findings for analysis
   - **Trigger**: If false-positive rate > 20%, add rule-based pre-filter

5. **No Authentication in Web Mode**
   - **Risk**: Anyone with network access can use DDX web interface
   - **Mitigation**: Runs on localhost by default; document security guidance for remote deployments
   - **Trigger**: When users request multi-tenant hosting

6. **Limited Document Types**
   - **Risk**: Users want document types not in default config
   - **Mitigation**: Extensible config system; users can add custom types
   - **Trigger**: Already addressed via pluggable templates/prompts

### Future Redesign Triggers

- **If** consistency check latency > 30s consistently → Implement caching layer for upstream documents
- **If** LLM costs > $100/month for single user → Optimize prompts or add local model support
- **If** document count > 1000 in single project → Migrate from flat files to database (SQLite)
- **If** web mode needs > 1000 concurrent users → Migrate to horizontally scalable architecture
- **If** MCP adoption > CLI adoption → Prioritize MCP features over CLI features

### Scalability Ceiling
- **Current Design Supports**:
  - 100 documents per project
  - 10 concurrent web users
  - 10,000 LLM tokens per document (typical)
- **Breaking Points**:
  - Document graph depth > 10 levels → Prompt size exceeds LLM context window
  - Conversation history > 100 messages → State file size impacts load time
  - Web mode > 100 concurrent users → Node.js event loop saturation
