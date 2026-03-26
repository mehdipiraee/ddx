# DDX v2 CLI Interface - Build Plan

## Overview

This plan outlines the implementation sequence for the DDX v2 CLI. The approach is modular and incremental, starting with core infrastructure and building feature completeness. Each phase produces working, testable code.

## Phase 1: CLI Scaffold (Days 1-2)

### Objectives
- Set up basic yargs command structure
- Register all 8 commands with stubs
- Establish command registry
- Create entry point script

### Deliverables

**src/index.ts** — Main CLI entry point
- Import yargs
- Define yargs configuration (version, help, descriptions)
- Register all commands
- Parse argv and invoke command handler
- Global error handling and exit codes

**src/commands/command-registry.ts** — Central command definitions
- Export command definitions for: mandate, define, design, plan, build, derive, list, check
- Each definition includes:
  - Command name
  - Description
  - Handler function signature
  - Required arguments
  - Optional flags
  - Examples

**src/commands/mandate.ts** — Mandate command stub
- Export handler function
- Log: "mandate command called with args: ..."
- Return success

**src/commands/define.ts** — Define command stub
- Export handler function
- Log command invocation
- Return success

**src/commands/design.ts, plan.ts, build.ts, derive.ts, list.ts, check.ts** — Remaining command stubs
- Same pattern as define.ts

**package.json** updates
- Add `"bin": { "ddx": "dist/index.js" }`
- Add TypeScript as devDependency
- Add yargs as dependency
- Add build script: `"build": "tsc"`
- Add start script: `"start": "node dist/index.js"`

**tsconfig.json** — TypeScript configuration
- Target ES2020
- Module: commonjs
- Output: dist/
- Strict mode enabled

**Acceptance Criteria**
- Running `ddx --help` shows all 8 commands with descriptions
- Running `ddx mandate` calls mandate handler
- Running `ddx define` calls define handler
- Running `ddx unknown` shows error message
- `npm run build` compiles without errors
- All stubs return success status

## Phase 2: HTTP Client Module (Days 3-4)

### Objectives
- Create reusable HTTP client for server communication
- Implement server health check and auto-start logic
- Handle both regular and streaming responses
- Implement error handling with clear messages

### Deliverables

**src/http/http-client.ts** — Core HTTP client
- `HttpClient` class with methods:
  - `constructor(baseUrl: string = 'http://localhost:3333')`
  - `request(method, path, data): Promise<Response>` — Basic HTTP request
  - `requestStream(method, path, data, onToken): Promise<void>` — Streaming request
  - `isServerRunning(): Promise<boolean>` — Health check
  - `autoStartServer(): Promise<void>` — Start server if needed
  - `close(): void` — Cleanup connections

**src/http/sse-parser.ts** — Server-Sent Events parser
- Parse SSE stream line-by-line
- Detect event boundaries
- Parse JSON events
- Emit token chunks and completion events
- Handle stream errors

**src/http/error-formatter.ts** — Error message formatting
- `formatError(error, context)` — Standard error output
- Handle network errors
- Handle validation errors
- Handle timeout errors
- Include actionable suggestions

**src/config.ts** — Configuration management
- Read environment variables:
  - `DDX_SERVER_URL`
  - `DDX_TIMEOUT`
  - `DDX_NO_AUTO_START`
  - `DDX_PROJECT_ROOT`
- Export config object with defaults

**Acceptance Criteria**
- `HttpClient.request()` sends POST/GET to server and returns parsed response
- `HttpClient.requestStream()` opens SSE connection and calls `onToken` for each event
- `HttpClient.isServerRunning()` returns true if server responds to health check
- `HttpClient.autoStartServer()` detects if server is down, starts it, waits for readiness
- SSE parser correctly parses multi-line event streams
- Error formatter produces consistent, readable error messages
- All async operations handle timeouts correctly
- Config module correctly reads environment variables with sensible defaults

## Phase 3: Command Implementation (Days 5-8)

### Objectives
- Replace stubs with actual implementations
- Implement request/response handling for each command
- Handle command-specific arguments and validation
- Support all flags (force, quick, dryRun, verbose, level, name)

### Deliverables

**src/commands/mandate.ts** — Full implementation
- Parse arguments: none required
- Parse flags: level (product/capability), name (if capability level)
- Build request payload
- Call `httpClient.request('POST', '/api/mandate', payload)`
- Handle response (show document content or streaming)
- Display output

**src/commands/define.ts** — Full implementation
- Parse arguments: none required (prompt for name if missing and not --quick)
- Parse flags: level, name, force, quick, dryRun, verbose
- Build request payload with all flags
- Call `httpClient.request('POST', '/api/define', payload)`
- If streaming: use `httpClient.requestStream()` to display in real-time
- Display output with status

**src/commands/design.ts, plan.ts, build.ts** — Full implementation
- Same pattern as define.ts
- Each maps to appropriate endpoint: /api/design, /api/plan, /api/build
- All support streaming responses

**src/commands/derive.ts** — Full implementation
- Parse arguments: optional code path/directory
- Build request with code context
- Call `httpClient.request('POST', '/api/derive', payload)`
- Display generated documentation

**src/commands/list.ts** — Full implementation
- Parse arguments: none required
- Call `httpClient.request('GET', '/api/documents', {})`
- Format response as document listing with status
- Display table of documents

**src/commands/check.ts** — Full implementation
- Parse arguments: none required
- Call `httpClient.request('POST', '/api/check', {})`
- Display check results and any validation errors

**Flag Handling in Each Command**
- `--force` — Request all confirmations (pass to server)
- `--quick` — Use defaults, minimal prompts (pass to server)
- `--dryRun` — Show output without persisting (pass to server)
- `--verbose` — Include detailed explanations (pass to server)
- `--level` — Target product or capability level (pass to server)
- `--name` — Specify capability name (pass to server)

**Acceptance Criteria**
- Each command correctly parses its arguments
- Each command sends properly formatted request to server
- Streaming responses display tokens in real-time
- Non-streaming responses display formatted output
- All flags are recognized and passed to server
- Invalid flag combinations show error
- Missing required context shows helpful error message
- Dry-run mode shows output without persisting

## Phase 4: Server Auto-Start (Days 8-9)

### Objectives
- Implement automatic server startup on connection failure
- Make server auto-start optional and configurable
- Provide clear user feedback during auto-start

### Deliverables

**Updates to src/http/http-client.ts**
- Enhance `autoStartServer()` method:
  - Detect 001-core-engine directory location
  - Spawn child process: `npm run server`
  - Wait up to 10 seconds for server to become ready
  - Retry health check after each 500ms
  - Clean up child process on completion or timeout
  - Return success/failure status

**Updates to src/index.ts** — Global command wrapper
- Before invoking command:
  - Create HttpClient instance
  - Call `isServerRunning()`
  - If not running and auto-start enabled:
    - Display "Starting DDX server..."
    - Call `autoStartServer()`
    - If success: continue
    - If failure: display error with manual start instructions
  - If auto-start disabled: display error with manual start instructions
- Pass HttpClient instance to all command handlers

**Acceptance Criteria**
- Running command when server is down triggers auto-start
- Auto-start message displays to user: "Starting DDX server..."
- Server becomes ready and command proceeds automatically
- If auto-start fails, user sees clear error: "Run 'npm run server' in the ddx directory"
- Environment variable `DDX_NO_AUTO_START=true` disables auto-start
- In CI/CD environments, auto-start is disabled (detected via CI env vars)
- Auto-start timeout is 10 seconds (configurable via `DDX_STARTUP_TIMEOUT`)

## Phase 5: Output Formatting (Days 9-10)

### Objectives
- Implement consistent, readable output formatting
- Support document display with metadata
- Format streaming output appropriately
- Display errors with clear action items

### Deliverables

**src/output/formatter.ts** — Output formatting functions
- `displayDocument(doc)` — Show document with title, metadata, content
- `displayDocumentList(docs)` — Show table of documents with status
- `displayCheckResults(results)` — Show validation check results
- `displayStreamingStart(title)` — Initialize streaming output section
- `displayStreamingToken(token)` — Append token to streaming output
- `displayStreamingEnd()` — Finalize streaming output
- `displaySuccess(message)` — Show success message with checkmark
- `displayWarning(message)` — Show warning with exclamation
- `formatTable(data, columns)` — Format data as aligned table

**src/output/styles.ts** — Terminal styling
- Color codes for: success (green), error (red), warning (yellow), info (blue)
- Styling helpers: bold, dim, underline
- Spinner for loading states
- Progress indicators for long operations

**Updates to command handlers**
- Replace console.log with formatter calls
- Use displayStreamingToken for SSE output
- Use displayDocument for document content
- Use displayDocumentList for list results
- Use displayCheckResults for check output

**Acceptance Criteria**
- All output is consistent and readable
- Error messages are prominent with red color
- Success messages show with green color
- Streaming output updates in real-time without line breaks
- Document listings are formatted as aligned tables
- Long streaming output doesn't cause buffer/truncation issues
- Status indicators (DRAFT, READY, ERROR) display correctly

## Phase 6: npm Global Installation (Days 10-11)

### Objectives
- Configure npm package for global installation
- Create executable entry point
- Test global installation and command access

### Deliverables

**package.json updates**
- Verify `"bin": { "ddx": "./dist/index.js" }`
- Add `"preferGlobal": true`
- Set `"files": ["dist/", "README.md"]`
- Ensure all dependencies are listed

**bin/ddx.js** — Executable entry point
- Shebang: `#!/usr/bin/env node`
- Require and invoke main CLI handler
- Ensures proper node interpreter is used

**Updates to dist/index.js** — Remove shebang from compiled TypeScript
- Compilation should not include shebang in dist/index.js
- bin/ddx.js provides the shebang wrapper

**README.md** — Installation instructions
- Installation: `npm install -g ddx`
- Usage: `ddx --help`
- Command examples
- Configuration via environment variables
- Troubleshooting

**Acceptance Criteria**
- `npm install -g .` installs CLI globally
- `ddx --help` works from any directory
- `ddx --version` returns version
- `ddx mandate` works as global command
- All commands accessible globally
- Uninstalling removes command: `npm uninstall -g ddx`

## Implementation Order Summary

```
Week 1:
  Days 1-2:   Phase 1 - CLI Scaffold
  Days 3-4:   Phase 2 - HTTP Client Module
  Days 5-8:   Phase 3 - Command Implementation
  Days 8-9:   Phase 4 - Server Auto-Start (parallel)
  Days 9-10:  Phase 5 - Output Formatting (parallel)
  Days 10-11: Phase 6 - npm Global Installation
```

## Testing Throughout

Each phase includes unit tests:
- Phase 1: CLI argument parsing
- Phase 2: HTTP client and SSE parser
- Phase 3: Command request/response handling
- Phase 4: Auto-start logic
- Phase 5: Output formatting
- Phase 6: Global installation behavior

Integration tests run after Phase 3 to verify end-to-end command flow.
