# DDX v2 CLI Interface - Test Cases

## Test Structure

Tests are organized by behavior category and use Given/When/Then format. Each test specifies:
- Prerequisites (Given)
- Action taken (When)
- Expected outcome (Then)
- Test type (unit, integration, e2e)

---

## Happy Path Tests

### Test: Mandate Command Executes Successfully
**Type:** Integration  
**Prerequisite:** DDX server is running

Given:
- Server is running at localhost:3333
- Project has no existing mandate

When:
- User runs: `ddx mandate --quick`

Then:
- CLI connects to server
- Server generates mandate document
- Output shows generated mandate content
- Document is persisted to server
- Exit code is 0 (success)

---

### Test: Define Command with Streaming Output
**Type:** Integration  
**Prerequisite:** DDX server running, mandate exists

Given:
- Server is running and healthy
- Mandate document exists
- User specifies capability name via `-n` flag

When:
- User runs: `ddx define -n payment-processing -l capability`

Then:
- CLI sends request to `/api/define`
- Server returns SSE stream
- CLI immediately displays first token
- Subsequent tokens appear in real-time
- Final output is complete and coherent
- Exit code is 0

---

### Test: Design Command with Force Flag
**Type:** Integration  
**Prerequisite:** Server running, capability defined

Given:
- Server is running
- Capability exists: payment-processing
- Force flag enables all prompts

When:
- User runs: `ddx design -n payment-processing -f`

Then:
- CLI sends request with `force: true`
- Server asks for all decisions (no defaults)
- CLI waits for user input
- After all inputs, server generates design
- Output shows design decisions
- Exit code is 0

---

### Test: Plan Command with Dry-Run
**Type:** Integration  
**Prerequisite:** Server running, design exists

Given:
- Server is running
- Design document exists for payment-processing
- Dry-run flag is set

When:
- User runs: `ddx plan -n payment-processing -d`

Then:
- CLI sends request with `dryRun: true`
- Server generates plan without persistence
- Output shows plan content
- No document is saved to server
- User receives message: "This is a dry-run simulation"
- Exit code is 0

---

### Test: Build Command Executes Implementation
**Type:** Integration  
**Prerequisite:** Server running, plan exists

Given:
- Server is running
- Plan document exists
- Build environment is configured

When:
- User runs: `ddx build -n payment-processing`

Then:
- CLI sends build request to server
- Server orchestrates build steps
- CLI displays progress/output in real-time
- Build completes successfully
- Document shows build completion status
- Exit code is 0

---

### Test: Derive Command Reverse-Engineers Docs
**Type:** Integration  
**Prerequisite:** Server running, code exists

Given:
- Server is running
- Code directory exists at ./src/payment
- User specifies code path

When:
- User runs: `ddx derive ./src/payment`

Then:
- CLI sends request with code path to server
- Server analyzes code structure and comments
- Server generates corresponding define/design docs
- CLI displays generated documentation
- Output shows what was derived and where it's stored
- Exit code is 0

---

### Test: List Command Shows All Documents
**Type:** Integration  
**Prerequisite:** Server running, multiple documents created

Given:
- Server is running
- Multiple documents exist: mandate, define/payment, design/payment
- Documents have different statuses: DRAFT, READY

When:
- User runs: `ddx list`

Then:
- CLI sends GET request to `/api/documents`
- Server returns all documents with metadata
- CLI displays formatted table:
  - Document name/path
  - Status (DRAFT/READY/ERROR)
  - Last updated timestamp
  - Type (mandate/define/design/plan/build)
- Table is aligned and readable
- Exit code is 0

---

### Test: Check Command Validates Project
**Type:** Integration  
**Prerequisite:** Server running, multiple documents

Given:
- Server is running
- Project has mandate, define, design documents
- No consistency errors exist

When:
- User runs: `ddx check`

Then:
- CLI sends request to `/api/check`
- Server validates all documents
- CLI displays check results:
  - "✓ Consistency check passed"
  - Summary of documents validated
  - Overall status: PASS
- Exit code is 0

---

### Test: Flags Work Across Commands
**Type:** Unit

Given:
- All 8 commands implemented

When:
- User runs same command with different flag combinations:
  - `ddx define -q` (quick, default)
  - `ddx define -f` (force)
  - `ddx define -v` (verbose)
  - `ddx define -d` (dry-run)

Then:
- Each flag is recognized and parsed
- Flags are correctly passed in request payload
- Server receives flags and adjusts behavior
- Exit code is 0 for each

---

### Test: Verbose Flag Shows Detailed Output
**Type:** Integration

Given:
- Server is running
- User runs command with `-v` flag

When:
- User runs: `ddx design -n payment -v`

Then:
- Output includes:
  - What request was sent
  - Request parameters
  - Server response time
  - Detailed explanations of design decisions
  - Reasoning behind choices
- Output is more verbose than default
- Exit code is 0

---

## Input Validation Tests

### Test: Unknown Command Rejected
**Type:** Unit

Given:
- User types invalid command

When:
- User runs: `ddx foo`

Then:
- CLI outputs error message:
  ```
  ERROR: Unknown Command
  Message: 'ddx foo' is not a recognized command
  Available commands: mandate, define, design, plan, build, derive, list, check
  Action: Run 'ddx --help' for usage
  ```
- Exit code is 1 (error)

---

### Test: Invalid Flag Rejected
**Type:** Unit

Given:
- User uses non-existent flag

When:
- User runs: `ddx define --invalid-flag`

Then:
- CLI outputs error message:
  ```
  ERROR: Unknown Flag
  Message: '--invalid-flag' is not recognized
  Available flags: -f/--force, -q/--quick, -d/--dry-run, -v/--verbose, -l/--level, -n/--name
  ```
- Exit code is 1

---

### Test: Invalid Flag Value Rejected
**Type:** Unit

Given:
- User provides invalid value for flag

When:
- User runs: `ddx define -l invalid-level`

Then:
- CLI outputs error message:
  ```
  ERROR: Invalid Flag Value
  Message: '-l/--level' must be 'product' or 'capability', got 'invalid-level'
  Action: Use: ddx define -l product OR ddx define -l capability
  ```
- Exit code is 1

---

### Test: Missing Required Arguments
**Type:** Unit

Given:
- Derive command requires a code path

When:
- User runs: `ddx derive` (without path)

Then:
- CLI outputs error message:
  ```
  ERROR: Missing Argument
  Message: The 'derive' command requires a code path argument
  Usage: ddx derive <path-to-code>
  Example: ddx derive ./src
  ```
- Exit code is 1

---

### Test: Conflicting Flags Show Error
**Type:** Unit

Given:
- User provides both `--force` and `--quick` (conflicting)

When:
- User runs: `ddx define -f -q`

Then:
- CLI outputs warning and uses `--force`:
  ```
  WARNING: Conflicting Flags
  Message: Both --force and --quick specified. Using --force (detailed prompts)
  ```
- Command proceeds with --force behavior
- Exit code is 0

---

## Failure Scenario Tests

### Test: Server Not Running - Auto-Start Succeeds
**Type:** Integration

Given:
- Server is NOT running
- DDX_NO_AUTO_START is not set
- 001-core-engine directory is accessible

When:
- User runs: `ddx mandate`

Then:
- CLI detects server is down
- CLI displays: "Starting DDX server..."
- CLI spawns server process
- Server becomes ready within 10 seconds
- CLI retries connection
- Connection succeeds
- Command executes normally
- Exit code is 0

---

### Test: Server Not Running - Auto-Start Fails
**Type:** Integration

Given:
- Server is NOT running
- Auto-start is enabled
- 001-core-engine directory is not found or server fails to start

When:
- User runs: `ddx mandate`

Then:
- CLI detects server is down
- CLI attempts auto-start
- Auto-start fails after 10 second timeout
- CLI displays error message:
  ```
  ERROR: Server Not Running
  Message: Cannot connect to DDX server at localhost:3333
  The automatic server start failed
  Action: Run 'npm run server' in the ddx directory
  Or set DDX_SERVER_URL to connect to remote server
  ```
- Exit code is 1

---

### Test: Server Not Running - Auto-Start Disabled
**Type:** Integration

Given:
- Server is NOT running
- DDX_NO_AUTO_START=true is set

When:
- User runs: `ddx mandate`

Then:
- CLI detects server is down
- CLI does NOT attempt auto-start
- CLI displays error message:
  ```
  ERROR: Server Not Running
  Message: Cannot connect to DDX server at localhost:3333
  Auto-start is disabled
  Action: Run 'npm run server' in the ddx directory
  ```
- Exit code is 1

---

### Test: Server Returns 400 Validation Error
**Type:** Integration

Given:
- Server is running
- User provides invalid input that server rejects

When:
- User runs: `ddx define -n "my-cap!"` (invalid character)

Then:
- CLI sends request
- Server responds with 400 status and error message
- CLI displays formatted error:
  ```
  ERROR: Validation Error
  Message: Capability name 'my-cap!' contains invalid characters
  Valid characters: letters, numbers, hyphens, underscores
  Action: Rename capability and try again
  Example: ddx define -n my-cap
  ```
- Exit code is 1

---

### Test: Server Returns 500 Internal Error
**Type:** Integration

Given:
- Server is running
- Server encounters unexpected error

When:
- User runs command and server throws 500 error

Then:
- CLI displays error message:
  ```
  ERROR: Server Error
  Message: Server returned error 500: Internal Server Error
  Action: Check server logs or try again in a moment
  ```
- Exit code is 1

---

### Test: Network Timeout
**Type:** Integration

Given:
- Server is unreachable (network issue)
- Request timeout is 5 seconds

When:
- User runs: `ddx mandate` (with custom timeout)

Then:
- CLI waits up to 5 seconds
- Request times out
- CLI displays error message:
  ```
  ERROR: Network Timeout
  Message: Request to /api/mandate timed out after 5s
  Action: Check your network connection
  Increase timeout: DDX_TIMEOUT=30 ddx mandate
  ```
- Exit code is 1

---

### Test: SSE Stream Interrupted
**Type:** Integration

Given:
- Command initiates streaming response
- Server-Sent Events stream is open

When:
- Connection is lost mid-stream (e.g., network interruption)

Then:
- CLI detects stream interruption
- CLI displays output received so far
- CLI appends message:
  ```
  [Stream interrupted - connection lost]
  ```
- Exit code is 1

---

### Test: Invalid JSON Response
**Type:** Integration

Given:
- Server is running
- Server returns malformed JSON response

When:
- User runs command and receives invalid JSON

Then:
- CLI detects parse error
- CLI displays error message:
  ```
  ERROR: Parse Error
  Message: Server returned invalid JSON response
  Raw response: [first 100 chars of response]
  Action: Check server logs or retry
  ```
- Exit code is 1

---

## Edge Case Tests

### Test: Very Long Streaming Output
**Type:** Integration

Given:
- Command generates large streaming response (10,000+ tokens)

When:
- User runs: `ddx design -n capability-with-lots-of-output`

Then:
- CLI receives and displays all tokens
- No truncation or buffer overflow occurs
- Output remains readable
- Performance is acceptable (< 5 min for 10k tokens)
- Exit code is 0

---

### Test: Special Characters in Capability Name
**Type:** Unit

Given:
- User specifies capability name with special characters

When:
- User runs: `ddx define -n "my-capability-v2.0"`

Then:
- Name is properly encoded in request
- Server receives name correctly
- No encoding errors occur
- Exit code is 0 (or validation error from server if invalid)

---

### Test: Very Long Capability Name
**Type:** Unit

Given:
- User specifies 255-character capability name

When:
- User runs: `ddx define -n "very-long-name-repeated..."`

Then:
- CLI validates name length
- If exceeds limits, shows error:
  ```
  ERROR: Invalid Input
  Message: Capability name exceeds maximum length of 255 characters
  ```
- Otherwise, request is sent normally
- Exit code varies by outcome

---

### Test: Empty Response from Server
**Type:** Integration

Given:
- Server returns empty response body

When:
- User runs command and server responds with empty body

Then:
- CLI handles gracefully
- Displays message:
  ```
  Result: No output from server
  ```
- Exit code is 0 (if expected) or 1 (if error)

---

### Test: Multiple Rapid Commands
**Type:** Integration

Given:
- User runs multiple commands in quick succession

When:
- User runs:
  ```
  ddx define -n cap1 && ddx define -n cap2 && ddx design -n cap1
  ```

Then:
- Each command completes before next begins
- HTTP client reuses connections
- No port conflicts occur
- All commands succeed
- Exit code is 0

---

### Test: Help for Specific Command
**Type:** Unit

Given:
- User requests help for a command

When:
- User runs: `ddx design --help`

Then:
- Output shows:
  - Command description
  - Usage syntax
  - All available flags for command
  - Examples
  - Required/optional arguments
- Exit code is 0

---

## Integration with 001-Core-Engine Tests

### Test: CLI Creates Documents Visible in API
**Type:** Integration

Given:
- Both CLI and 001-core-engine running
- No existing documents

When:
- User runs: `ddx define -n new-capability`
- Then queries server API directly: `curl http://localhost:3333/api/documents`

Then:
- Document appears in API response
- Document has correct content
- Document has correct metadata
- Timestamps match
- Both access methods show same data

---

### Test: API-Created Documents Visible in CLI
**Type:** Integration

Given:
- Both CLI and 001-core-engine running
- Document created directly via API

When:
- User runs: `ddx list`

Then:
- CLI list shows API-created document
- Document appears with correct status
- Content matches API
- Both access methods show same data

---

### Test: Mandate Created via CLI Used by API
**Type:** Integration

Given:
- CLI and server running
- No mandate exists

When:
- User runs: `ddx mandate`
- Server API endpoint `/api/mandate` is queried

Then:
- Both CLI and API see same mandate document
- Subsequent API calls use mandate created by CLI
- All operations reference same mandate
- No duplicate documents created

---

### Test: Streaming Response from API via CLI
**Type:** Integration

Given:
- Server implements streaming endpoint
- CLI implements SSE handling

When:
- User runs command that streams: `ddx design`

Then:
- CLI receives tokens via SSE
- Tokens display in real-time (< 100ms delay per token)
- Final output matches what server would return non-streaming
- Performance is acceptable

---

## Test Execution Strategy

### Unit Tests
- Run without server
- Mock HTTP responses
- Test argument parsing, flag handling, error formatting
- Target: 100% command code coverage

### Integration Tests
- Require running server (001-core-engine)
- Test full request/response cycle
- Test streaming responses
- Test error scenarios with real server errors

### End-to-End Tests
- Full CLI installed globally
- Real server running
- Test real-world usage patterns
- Verify global command access

### Test Commands

```bash
# Unit tests only
npm test -- --unit

# Integration tests (requires server running)
npm test -- --integration

# All tests
npm test

# Specific test
npm test -- --grep "mandate"

# Coverage report
npm test -- --coverage
```
