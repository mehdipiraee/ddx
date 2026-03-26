# DDX v2 CLI Interface - Design

## Architecture Overview

The DDX v2 CLI follows a thin-client architecture where the CLI is responsible only for:
1. Parsing command-line arguments (yargs)
2. Translating commands to HTTP requests
3. Managing streaming responses
4. Formatting and displaying results

All business logic, validation, and persistence reside in the 001-core-engine server.

```
User Terminal
    ↓
DDX CLI (yargs) → Command Parser
    ↓
HTTP Client Module
    ↓
DDX Server (001-core-engine)
    ↓
HTTP Response / SSE Stream
    ↓
Output Formatter
    ↓
Terminal Display
```

## Command Structure

### yargs Configuration
The CLI uses yargs to define commands with a consistent structure:

```
ddx <command> [args] [flags]
```

Each command is registered with:
- Handler function (sends HTTP request, processes response)
- Required arguments
- Optional flags
- Description and examples
- Validation logic

### Command-to-Endpoint Mapping

| Command | HTTP Method | Endpoint | Purpose |
|---------|------------|----------|---------|
| mandate | POST/PUT | `/api/mandate` | Create/update project mandate |
| define | POST | `/api/define` | Define product or capability |
| design | POST | `/api/design` | Generate design decisions |
| plan | POST | `/api/plan` | Create implementation plan |
| build | POST | `/api/build` | Execute build plan |
| derive | POST | `/api/derive` | Reverse-engineer docs from code |
| list | GET | `/api/documents` | List all documents |
| check | POST | `/api/check` | Run consistency check |

### Flag Propagation

Standard flags are parsed by yargs and included in all API requests:

```javascript
const commonFlags = {
  force: { alias: 'f', type: 'boolean', default: false },
  quick: { alias: 'q', type: 'boolean', default: true },
  dryRun: { alias: 'd', type: 'boolean', default: false },
  verbose: { alias: 'v', type: 'boolean', default: false },
  level: { alias: 'l', type: 'string', choices: ['product', 'capability'] },
  name: { alias: 'n', type: 'string' }
};
```

When force is true, quick is disabled. When dryRun is true, no persistence occurs.

## HTTP Client Module

### Connection Management

The HTTP client module handles:

1. **Server availability check** — Before sending requests, verify server is running
2. **Connection pooling** — Reuse connections for multiple commands
3. **Timeout management** — Default 30s timeout, configurable
4. **URL construction** — Base URL from environment (default `http://localhost:3333`)

### Request Structure

Each request includes:
- Command name
- Arguments (capability name, project id, etc.)
- Flags (force, quick, dryRun, verbose, level)
- Context (project root, current working directory)

```javascript
{
  command: 'define',
  args: {
    name: 'payment-processing'
  },
  flags: {
    force: false,
    quick: true,
    dryRun: false,
    verbose: false,
    level: 'capability'
  }
}
```

### Response Handling

#### Non-streaming responses
- Parse JSON response
- Check for error status codes (400, 500, etc.)
- Return parsed data to output formatter

#### Streaming responses (SSE)
- Open event stream connection
- Listen for `data:` events
- Parse each event as JSON
- Call display handler for each token/chunk
- Detect stream end

## SSE (Server-Sent Events) Handling

When the server returns a streaming response (e.g., LLM generation), the CLI:

1. **Initiates stream** — Opens connection with `Accept: text/event-stream` header
2. **Reads line-by-line** — Buffers incoming data, parses event boundaries
3. **Displays in real-time** — Outputs each token immediately as it arrives
4. **Handles errors** — Gracefully terminates on stream error

### SSE Event Format

```
data: {"token": "The", "type": "content"}
data: {"token": " mandate", "type": "content"}
data: {"token": " is", "type": "content"}
...
data: {"type": "done"}
```

The CLI concatenates tokens as they arrive, displaying live output:

```
The mandate is...
```

### Stream Interruption Handling

- If connection drops mid-stream: Display "Stream interrupted" message
- If server error event: Display error and stop stream
- If timeout: Display timeout message and allow retry

## Error Display Formatting

All errors follow a consistent format for clarity:

```
ERROR: <error_type>
Message: <human-readable message>
Context: <what command, what flags>
Action: <suggested resolution>
```

### Example Error Outputs

**Unknown command:**
```
ERROR: Unknown Command
Message: 'ddx foo' is not a recognized command
Available commands: mandate, define, design, plan, build, derive, list, check
Action: Run 'ddx --help' for usage
```

**Server not running:**
```
ERROR: Server Not Running
Message: Cannot connect to DDX server at localhost:3333
Action: Starting server automatically...
(Or: Run 'npm run server' in the ddx directory)
```

**Network timeout:**
```
ERROR: Network Timeout
Message: Request to /api/design timed out after 30s
Action: Check server status with 'ddx check' or increase timeout with DDX_TIMEOUT=60
```

**Validation error from server:**
```
ERROR: Validation Error
Message: Capability name 'my-cap!' contains invalid characters
Valid characters: letters, numbers, hyphens, underscores
Action: Rename capability and try again
```

## Server Auto-Start Logic

When the CLI attempts to connect to the server:

1. **Try connection** — Attempt HTTP GET to `/api/health`
2. **If success** — Proceed with command
3. **If failure** — Attempt auto-start:
   - Locate 001-core-engine directory
   - Run `npm run server` in background
   - Wait up to 10s for server to be ready
   - Retry connection
4. **If auto-start fails** — Display clear error with manual start instructions

Auto-start is disabled if:
- Environment variable `DDX_NO_AUTO_START=true`
- Running in CI/CD environment
- Server is explicitly disabled

### Health Check Endpoint

```javascript
GET /api/health
Response: { status: 'ok', version: '2.0.0' }
```

## Output Formatting

### Structured Document Display

When listing documents or showing results:

```
PROJECT DOCUMENTS
─────────────────────────────────────────
1. mandate.md (DRAFT)
   Status: Complete
   Last updated: 2026-03-20 14:22:00

2. define/payment-processing.md (READY)
   Status: Complete
   Last updated: 2026-03-20 15:10:00
```

### Streaming Output Display

Real-time output flows naturally:

```
Generating design decisions...
─────────────────────────────────────────
The payment processing capability requires
robust error handling...
```

### Status Indicators

- `DRAFT` — Work in progress, needs review
- `READY` — Complete and validated
- `ERROR` — Failed validation
- `PENDING` — Waiting on dependencies

## Configuration

Environment variables control CLI behavior:

- `DDX_SERVER_URL` — Server base URL (default: `http://localhost:3333`)
- `DDX_TIMEOUT` — Request timeout in seconds (default: 30)
- `DDX_NO_AUTO_START` — Disable auto-start (default: false)
- `DDX_PROJECT_ROOT` — Override project root detection
- `DDX_VERBOSE` — Global verbose logging (default: false)

## CLI Entry Point

The CLI exposes:
- `ddx` — Main command
- `ddx --version` — Show version
- `ddx --help` — Show help
- `ddx <command> --help` — Command-specific help

When installed globally via npm, the `bin` field in package.json points to the CLI entry script, making `ddx` available as a system command.
