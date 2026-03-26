# DDX v2 MCP Server — Plan

## Build Order and Phases

### Phase 1: MCP Server Scaffold

**Goal**: Set up the foundational MCP server using @modelcontextprotocol/sdk.

**Tasks**:
1. Initialize Node.js project with TypeScript
   - Create package.json with @modelcontextprotocol/sdk dependency
   - Configure tsconfig.json and build process
   - Add dev dependencies: ts-node, typescript, @types/node

2. Create server entry point (index.ts)
   - Import Server from @modelcontextprotocol/sdk
   - Create StdioServerTransport to listen on stdin and write to stdout
   - Initialize server with protocol version and capabilities (tools + resources)

3. Set up basic server initialization
   - Define tool list (placeholders for implementations)
   - Define resource schema (ddx://documents/{path})
   - Bind server to transport

4. Add logging and error handling
   - Initialize logger (debug, info, warn, error levels)
   - Set up error handler for uncaught exceptions
   - Log server lifecycle (start, shutdown)

5. Environment configuration
   - Load DDX_SERVER_URL, DDX_SERVER_TIMEOUT, MCP_LOG_LEVEL from env
   - Provide sensible defaults
   - Validate configuration on startup

**Deliverable**: `src/index.ts` — Functional MCP server shell that starts cleanly and logs lifecycle events.

---

### Phase 2: HTTP Client for DDX Server Communication

**Goal**: Build an HTTP client that translates MCP tool calls to DDX server API requests.

**Tasks**:
1. Create HTTP client module (http-client.ts)
   - Use Node.js built-in http or fetch API
   - Support configurable base URL and timeout
   - Implement connection pooling/reuse

2. Define request/response types
   - Create TypeScript interfaces for all DDX API request/response shapes
   - Example: MandateRequest, MandateResponse, DefineRequest, DefineResponse, etc.

3. Implement HTTP methods
   - POST method: send JSON body, handle response
   - GET method: append query params, handle response
   - Streaming support: buffer chunks for long responses

4. Error mapping
   - Translate HTTP error codes to descriptive error objects
   - Capture error details for logging and client feedback
   - Return normalized error format

5. Retry logic
   - Implement exponential backoff for transient failures
   - Max 3 retries with 1s, 2s, 4s delays
   - Log retry attempts

**Deliverable**: `src/http-client.ts` — HTTP client with request/response handling, error mapping, and retry logic.

---

### Phase 3: Implement Tool Definitions and Handlers

**Goal**: Implement all 9 MCP tools with proper schemas and request handlers.

**Tasks**:
1. Create tool handler module (tools/index.ts)
   - Export tool definitions (name, description, inputSchema) for all 9 tools
   - Create handler functions: handleDdxMandate, handleDdxDefine, etc.

2. Implement individual tool handlers
   - For each tool:
     - Parse tool arguments (validate against schema)
     - Call corresponding HTTP endpoint via client
     - Map response to MCP tool result format
     - Handle errors and return error message

3. Tool implementations (in tools/ directory):
   - tools/mandate.ts: POST /mandate
   - tools/define.ts: POST /define
   - tools/design.ts: POST /design
   - tools/plan.ts: POST /plan
   - tools/build.ts: POST /build
   - tools/derive.ts: POST /derive
   - tools/list.ts: GET /list
   - tools/check.ts: POST /check
   - tools/read.ts: GET /document/{path}

4. Tool result formatting
   - Ensure all results conform to MCP ToolResultBlockParam
   - Include both success/failure cases
   - Provide actionable error messages

5. Tool registration with server
   - Register each tool with server.setRequestHandler(Tool, handler)
   - Verify tool names match MCP spec

**Deliverable**: `src/tools/` directory with all 9 tool implementations.

---

### Phase 4: Implement Resource Handlers

**Goal**: Enable MCP clients to read DDX documents via the ddx://documents/{path} resource URI.

**Tasks**:
1. Create resource handler module (resources/index.ts)
   - Export resource template definition for ddx://documents/*
   - Implement resource read handler

2. Parse resource URIs
   - Accept URI like ddx://documents/my-project/define/auth-service.md
   - Extract project_id, doc_type, capability_name

3. Implement resource handler
   - Call HTTP GET /document with extracted path
   - Return content as TextResourceContents

4. Resource discovery (optional but recommended)
   - Implement resourceList handler to enumerate documents for a project
   - Uses ddx_list tool under the hood

5. Error handling
   - Return ResourceNotFound error for 404 responses
   - Return InternalError for server errors
   - Provide context about which path failed

**Deliverable**: `src/resources/index.ts` — Resource handler for ddx://documents/* URIs.

---

### Phase 5: Error Handling and JSON-RPC Error Formatting

**Goal**: Ensure all errors are properly formatted as JSON-RPC 2.0 errors.

**Tasks**:
1. Create error utilities module (errors.ts)
   - Define ErrorResponse class for JSON-RPC errors
   - Implement error code mapping (HTTP → JSON-RPC)
   - Add structured error context (details, http_status, etc.)

2. Error translation layer
   - For each HTTP error, create corresponding JSON-RPC error
   - Preserve useful error context and details
   - Log errors at appropriate level

3. Handle tool execution errors
   - Catch exceptions in tool handlers
   - Format as JSON-RPC error with code -32603 (Internal error)
   - Include stack trace in log but not in response

4. Handle protocol errors
   - Invalid JSON-RPC requests: code -32700 (Parse error)
   - Invalid tool parameters: code -32602 (Invalid params)
   - Unknown tool/resource: code -32601 (Method not found)

5. Implement error middleware
   - Wrap tool and resource handlers with error boundary
   - Centralize error logging
   - Ensure all errors have trace IDs

**Deliverable**: `src/errors.ts` — Error handling module with JSON-RPC formatting.

---

### Phase 6: Integration Testing with MCP Client

**Goal**: Verify the MCP server works with Claude Code and VS Code, and that all components integrate correctly.

**Tasks**:
1. Set up test environment
   - Create test fixture that starts MCP server
   - Mock DDX server or use test instance
   - Implement MCP client test harness

2. Happy path tests (for each tool)
   - Tool call succeeds and returns expected shape
   - Response is valid JSON-RPC 2.0
   - Result contains expected fields

3. Error handling tests
   - Tool called with missing required param: returns JSON-RPC error -32602
   - Tool called with invalid value: returns error with details
   - HTTP error from DDX server: translated to JSON-RPC error

4. Resource tests
   - Read resource at valid path: returns content
   - Read resource at invalid path: returns error
   - Resource URI parsing works for nested paths

5. Integration with phases 001-003
   - Create mandate with ddx_mandate tool
   - Create define with ddx_define tool
   - List documents and verify tool-created docs appear
   - Read tool-created doc via resource

6. End-to-end workflow test
   - Create mandate → define → design → plan → build workflow
   - All operations succeed and produce expected artifacts
   - Check consistency across all documents

7. Client compatibility tests
   - Test with Claude Code MCP integration (if available)
   - Test with VS Code MCP extension (if available)
   - Verify tool discoverability and invocation

**Deliverable**: `tests/` directory with integration and unit test suites.

---

## Dependencies

- @modelcontextprotocol/sdk ^0.x.x
- TypeScript ^5.x
- Node.js ^18.x (for native http module)
- (Optional) axios or node-fetch for HTTP client if using fetch API

## Build and Run

```bash
npm install
npm run build
npm start
```

MCP server listens on stdin/stdout. Clients connect via stdio transport.

## Configuration

Set environment variables before running:
- `DDX_SERVER_URL=http://localhost:8080`
- `DDX_SERVER_TIMEOUT=30000`
- `MCP_LOG_LEVEL=info`

