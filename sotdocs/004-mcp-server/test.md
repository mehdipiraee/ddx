# DDX v2 MCP Server — Test

## Test Cases

All tests follow Given/When/Then format.

---

## Happy Path Tests

### Test 1.1: ddx_mandate Tool — Create New Mandate

**Given** the MCP server is running and connected to a DDX server
**When** a client calls the `ddx_mandate` tool with:
```json
{
  "project_id": "demo-project",
  "mandate_content": "Build an e-commerce platform for books. Serve 10k concurrent users. Must integrate with payment gateway Stripe."
}
```
**Then** the tool returns:
```json
{
  "type": "text",
  "text": "Mandate created successfully at projects/demo-project/mandate.md"
}
```
**And** the HTTP request to `POST /mandate` was made with the correct body
**And** the response contains a valid mandate_path field

---

### Test 1.2: ddx_define Tool — Define a Capability

**Given** a project mandate exists for "demo-project"
**When** a client calls the `ddx_define` tool with:
```json
{
  "project_id": "demo-project",
  "capability_name": "payment-processing",
  "definition_content": "Handles payment transactions via Stripe. Supports credit cards, PayPal, Apple Pay."
}
```
**Then** the tool returns:
```json
{
  "type": "text",
  "text": "Capability defined at projects/demo-project/define/payment-processing.md"
}
```
**And** the HTTP request to `POST /define` was made with correct body

---

### Test 1.3: ddx_design Tool — Design a Capability

**Given** a capability "payment-processing" has been defined
**When** a client calls the `ddx_design` tool with:
```json
{
  "project_id": "demo-project",
  "capability_name": "payment-processing",
  "design_content": "Architecture: Stripe SDK → Payment Queue → Settlement Service. Error handling: retry on network failure, fallback to manual resolution."
}
```
**Then** the tool returns success with design_path pointing to the design document
**And** the document is readable via the resource `ddx://documents/demo-project/design/payment-processing.md`

---

### Test 1.4: ddx_plan Tool — Create Implementation Plan

**Given** a capability is defined and designed
**When** a client calls the `ddx_plan` tool with:
```json
{
  "project_id": "demo-project",
  "capability_name": "payment-processing",
  "plan_content": "Phase 1: Stripe SDK setup (2 days). Phase 2: Payment queue implementation (3 days). Phase 3: Testing (2 days)."
}
```
**Then** the tool returns success with plan_path in the response

---

### Test 1.5: ddx_build Tool — Execute Build

**Given** a plan exists for a capability
**When** a client calls the `ddx_build` tool with:
```json
{
  "project_id": "demo-project",
  "capability_name": "payment-processing",
  "build_config": { "environment": "staging", "skip_tests": false }
}
```
**Then** the tool returns success with:
- build_artifacts array (list of produced files)
- build_log string (build output)
- success: true

---

### Test 1.6: ddx_derive Tool — Reverse-Engineer Docs from Code

**Given** existing code at `/repos/demo-project/payment.ts` exists
**When** a client calls the `ddx_derive` tool with:
```json
{
  "project_id": "demo-project",
  "code_path": "/repos/demo-project/payment.ts",
  "capability_name": "payment-processing"
}
```
**Then** the tool returns success with derived_docs containing:
- definition_path
- design_path
- plan_path

---

### Test 1.7: ddx_list Tool — List All Documents

**Given** a project has multiple defined capabilities
**When** a client calls the `ddx_list` tool with:
```json
{
  "project_id": "demo-project",
  "filter": "all"
}
```
**Then** the tool returns an array of documents with:
- path (e.g., "projects/demo-project/define/payment-processing.md")
- type (e.g., "define", "design", "plan")
- name
- created_at

---

### Test 1.8: ddx_list Tool — Filter by Type

**Given** a project with mandate, define, and design documents
**When** a client calls the `ddx_list` tool with:
```json
{
  "project_id": "demo-project",
  "filter": "design"
}
```
**Then** the tool returns only documents where type == "design"

---

### Test 1.9: ddx_check Tool — Run Consistency Check

**Given** a project with mandate, define, design, and plan documents
**When** a client calls the `ddx_check` tool with:
```json
{
  "project_id": "demo-project"
}
```
**Then** the tool returns:
```json
{
  "type": "text",
  "text": "Consistency check passed: all documents present and coherent (0 issues)"
}
```
**And** if issues exist, they are returned as an array with severity, message, and path

---

### Test 1.10: ddx_read Tool — Read a Specific Document

**Given** a document exists at "projects/demo-project/define/payment-processing.md"
**When** a client calls the `ddx_read` tool with:
```json
{
  "path": "projects/demo-project/define/payment-processing.md"
}
```
**Then** the tool returns:
```json
{
  "type": "text",
  "text": "[document content]"
}
```
**And** metadata contains created_at and modified_at timestamps

---

### Test 1.11: Resource Access — Read Document via ddx:// URI

**Given** a document exists
**When** an MCP client requests the resource `ddx://documents/demo-project/define/payment-processing.md`
**Then** the resource handler returns:
```json
{
  "uri": "ddx://documents/demo-project/define/payment-processing.md",
  "mimeType": "text/markdown",
  "text": "[document content]"
}
```

---

## Input Validation Tests

### Test 2.1: Missing Required Parameter

**Given** the MCP server is running
**When** a client calls the `ddx_define` tool with missing `capability_name`:
```json
{
  "project_id": "demo-project",
  "definition_content": "..."
}
```
**Then** the server returns a JSON-RPC error:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": { "details": "Missing required parameter: capability_name" }
  },
  "id": "request-id"
}
```

---

### Test 2.2: Invalid Document Path

**Given** the MCP server is running
**When** a client calls the `ddx_read` tool with a non-existent path:
```json
{
  "path": "projects/nonexistent/define/missing.md"
}
```
**Then** the server returns:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": { "details": "Document not found", "http_status": 404 }
  },
  "id": "request-id"
}
```

---

### Test 2.3: Unknown Tool Name

**Given** the MCP server is running
**When** a client sends a JSON-RPC call to an undefined tool `ddx_nonexistent`
**Then** the server returns:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": { "details": "Tool 'ddx_nonexistent' not found" }
  },
  "id": "request-id"
}
```

---

### Test 2.4: Malformed JSON-RPC Request

**Given** the MCP server is running
**When** a client sends invalid JSON as a request (e.g., missing "jsonrpc" field)
**Then** the server returns:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid Request"
  },
  "id": null
}
```

---

## Failure Scenario Tests

### Test 3.1: DDX Server Not Running

**Given** the MCP server is running but the DDX core server is not reachable
**When** a client calls the `ddx_mandate` tool
**Then** the server returns a JSON-RPC error:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": { "details": "Failed to connect to DDX server at http://localhost:8080", "http_status": null }
  },
  "id": "request-id"
}
```

---

### Test 3.2: DDX Server Returns HTTP 500

**Given** the MCP server is running and DDX server is reachable
**When** the DDX server returns HTTP 500 for a `ddx_design` call
**Then** the MCP server returns:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": { "details": "DDX server error: Internal server error", "http_status": 500 }
  },
  "id": "request-id"
}
```

---

### Test 3.3: HTTP Request Timeout

**Given** the MCP server has DDX_SERVER_TIMEOUT=2000 (2 seconds)
**When** the DDX server does not respond within 2 seconds
**Then** the MCP server returns:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Server error",
    "data": { "details": "Request timeout after 2000ms" }
  },
  "id": "request-id"
}
```

---

### Test 3.4: Retry on Transient Failure

**Given** the MCP server's HTTP client has retry logic with 3 attempts
**When** the DDX server fails on first attempt (503) but succeeds on second attempt
**Then** the tool call succeeds and returns the correct result
**And** the log contains "Retry attempt 1/3"

---

## Edge Case Tests

### Test 4.1: Very Large Tool Response

**Given** a `ddx_read` call returns a 10MB document
**When** the MCP server buffers the response
**Then** the response is successfully returned to the client without truncation
**And** the full content is accessible

---

### Test 4.2: Concurrent Tool Calls

**Given** the MCP server is running
**When** a client sends 5 concurrent `ddx_list` calls
**Then** all 5 calls complete successfully
**And** each returns the correct document list
**And** no responses are mixed or corrupted

---

### Test 4.3: Unicode in Document Paths

**Given** a capability has a name with unicode characters: "支付処理" (payment processing in Chinese/Japanese)
**When** a client calls `ddx_define` with:
```json
{
  "project_id": "demo-project",
  "capability_name": "支付処理",
  "definition_content": "..."
}
```
**Then** the tool succeeds and the document path is correctly formed
**And** the resource `ddx://documents/demo-project/define/支付処理.md` is readable

---

### Test 4.4: Resource URI with Special Characters

**Given** a document path is `projects/my-project/define/auth-service.md`
**When** a client requests the resource `ddx://documents/my-project/define/auth-service.md`
**Then** the resource is read successfully
**And** the content is returned with correct MIME type "text/markdown"

---

### Test 4.5: Empty Mandatory Fields

**Given** the MCP server is running
**When** a client calls `ddx_mandate` with:
```json
{
  "project_id": "demo-project",
  "mandate_content": ""
}
```
**Then** the server returns:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": { "details": "mandate_content cannot be empty" }
  },
  "id": "request-id"
}
```

---

## Integration with Phases 001-003 Tests

### Test 5.1: MCP-Created Documents Visible in CLI

**Given** a document is created via the MCP `ddx_define` tool
**When** the DDX CLI tool from phase 001 runs `ddx list demo-project`
**Then** the CLI output includes the MCP-created document
**And** the document type and path are correct

---

### Test 5.2: MCP-Created Documents Visible in Skills

**Given** a skill from phase 003 reads all documents for a project
**When** the skill runs after an MCP-created document is added
**Then** the skill sees the new document
**And** the skill can process it normally

---

### Test 5.3: Skill-Created Documents Readable via MCP

**Given** a skill from phase 003 creates a design document
**When** an MCP client calls `ddx_read` on that document path
**Then** the document content is returned successfully
**And** the metadata matches the skill creation timestamp

---

### Test 5.4: End-to-End Workflow via MCP

**Given** no documents exist for a project
**When** the following sequence is executed via MCP:
1. `ddx_mandate` to create mandate
2. `ddx_define` to create definition
3. `ddx_design` to create design
4. `ddx_plan` to create plan
5. `ddx_check` to validate consistency
**Then** all operations succeed in order
**And** the consistency check confirms all documents are present
**And** the documents are visible via `ddx_list`

---

## MCP Client Compatibility Tests

### Test 6.1: Claude Code Integration

**Given** Claude Code has the MCP server configured
**When** Claude Code calls a DDX tool (e.g., `ddx_mandate`)
**Then** the tool executes and returns results in Claude's tool result format
**And** Claude can read and display the result

---

### Test 6.2: VS Code Extension Integration

**Given** VS Code has the DDX MCP server configured
**When** a user invokes a DDX command from the command palette
**Then** the command maps to an MCP tool call
**And** the result is displayed in the VS Code UI

---

### Test 6.3: Tool Schema Validation

**Given** an MCP client (Claude Code or VS Code) queries the server
**When** the client requests tool definitions
**Then** each tool's `inputSchema` is valid JSON Schema
**And** all required properties are marked as required
**And** property descriptions are present and clear

---

## Performance and Reliability Tests

### Test 7.1: Server Startup

**Given** the MCP server environment is configured
**When** the server starts with `npm start`
**Then** the server binds to stdio
**And** logs confirm successful startup
**And** the first tool call succeeds within 5 seconds

---

### Test 7.2: Graceful Shutdown

**Given** the MCP server is running
**When** a SIGTERM signal is sent to the process
**Then** the server logs "Shutting down..."
**And** existing tool calls complete
**And** the process exits cleanly

---

