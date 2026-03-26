# DDX v2 CLI Interface - Define

## Purpose
The DDX v2 CLI Interface is a thin command-line client that provides developers with terminal-based access to the DDX server's capabilities. It translates user commands into HTTP API calls, handles streaming responses in real-time, and displays results with clear formatting.

## Users
- Product developers working in terminal environments
- Integration scripts and automation workflows
- Developers iterating on projects locally
- CI/CD pipelines invoking DDX operations

## What It Does
The CLI provides 8 primary commands that map to DDX server operations:

1. **mandate** — Create or update a project mandate
2. **define** — Define a product or capability
3. **design** — Design a product or capability (generates design decisions)
4. **plan** — Plan a capability's implementation (creates build roadmap)
5. **build** — Execute the build plan (orchestrates development)
6. **derive** — Reverse-engineer documentation from existing code
7. **list** — List all documents and their current status
8. **check** — Run consistency check across project artifacts

Each command accepts modifiers (flags) to control behavior:

### Standard Flags
- `-f, --force` — Ask every question (detailed mode, no defaults)
- `-q, --quick` — Minimize prompts (default, use sensible defaults)
- `-d, --dry-run` — Show what would be generated without persisting
- `-v, --verbose` — Explain reasoning and include detailed output
- `-l, --level` — Target scope: `product` or `capability`

### Additional Flags
- `-n, --name` — Capability name for capability-level operations

## Key Capabilities

### Real-time Streaming
When the server returns streaming responses (e.g., LLM token generation), the CLI immediately displays output as it arrives using Server-Sent Events (SSE) parsing. Users see live token flow without waiting for completion.

### Automatic Server Management
If the DDX server (001-core-engine) is not running, the CLI automatically starts it. If auto-start fails, it clearly instructs the user to start the server manually.

### Error Clarity
Errors are displayed prominently with:
- Clear error message
- Suggested action or resolution
- Relevant context (what command, what flags)

### Global Command Access
Once installed via npm globally, the CLI works as a standard command: `ddx mandate`, `ddx define`, etc.

## Acceptance Criteria

### Commands
- [ ] All 8 commands parse arguments correctly
- [ ] Commands without required arguments show helpful error message
- [ ] Unknown commands are rejected with "unknown command" error

### Flags
- [ ] `-f, --force` changes behavior to request user input for all decisions
- [ ] `-q, --quick` (default) uses sensible defaults and minimizes prompts
- [ ] `-d, --dry-run` shows output without persisting to server
- [ ] `-v, --verbose` includes detailed explanations in output
- [ ] `-l, --level` correctly targets `product` or `capability`
- [ ] `-n, --name` is recognized and passed to server for capability operations
- [ ] Invalid flag combinations are rejected with clear message

### Streaming Output
- [ ] SSE streams from server display tokens in real-time
- [ ] Long streaming responses display without truncation or buffer issues
- [ ] Streaming completes gracefully when server closes connection

### Error Handling
- [ ] Server not running: CLI detects and auto-starts, or instructs user
- [ ] Server returns error: CLI displays error message prominently
- [ ] Network timeout: CLI shows timeout error with retry suggestion
- [ ] Invalid JSON response: CLI shows parse error and raw response snippet

### Server Integration
- [ ] CLI connects to server at `localhost:3333` (configurable)
- [ ] All API endpoints from 001-core-engine are accessible
- [ ] Request/response format matches server API contract

### Global Installation
- [ ] `npm install -g ddx` installs CLI as global command
- [ ] `ddx --version` returns version
- [ ] `ddx --help` shows usage
- [ ] `ddx <command>` works from any directory
