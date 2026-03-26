# DDX v2 Core Engine — Test Cases

## Test Case Format
All test cases follow the Given/When/Then format:
- **Given**: Preconditions and setup
- **When**: Action performed
- **Then**: Expected outcome and assertions

## Happy Path Tests

### HP1: Server Startup
**Given** a valid .ddx-tooling/config.yaml file with all required keys
**When** starting the core engine server
**Then** server binds to the configured port, logs "Server ready", and GET /api/status returns 200

### HP2: Create First Capability Mandate
**Given** a project with capability-scoped structure (no product define.md)
**When** POST /api/mandate with { capabilityName: "user-auth", context: "OAuth 2.0 implementation" }
**Then** response is 200 with documentPath "ddx/001-user-auth/mandate.md", content is non-empty, folder 001-user-auth is created

### HP3: Create Second Capability Mandate
**Given** an existing capability 001-user-auth in the project
**When** POST /api/mandate with { capabilityName: "payment-gateway", context: "Stripe integration" }
**Then** response is 200 with documentPath "ddx/002-payment-gateway/mandate.md", numbered correctly

### HP4: Create Define Document After Mandate
**Given** mandate.md exists at ddx/001-user-auth/mandate.md
**When** POST /api/define with { capabilityFolder: "001-user-auth", context: "Authentication flows" }
**Then** response is 200, define.md created, prerequisite check passed, documentPath returned

### HP5: Create Complete Document Chain
**Given** a capability folder with mandate.md through test.md complete
**When** POST /api/derive with { capabilityFolder: "001-user-auth", context: "Generate implementation" }
**Then** response is 200, code.md created, all phases present

### HP6: List All Documents
**Given** a project with multiple capabilities and phases (e.g., 001-user-auth with mandate, define, design; 002-payment-gateway with mandate, define)
**When** GET /api/documents
**Then** response is 200 with array containing all 5 documents, each with path, phase, lastModified, capabilityFolder

### HP7: Read Specific Document
**Given** define.md exists at ddx/001-user-auth/define.md with content "# Requirements\nFunction X..."
**When** GET /api/documents/ddx/001-user-auth/define.md
**Then** response is 200, content matches exactly, lastModified is recent timestamp, phase is "define"

### HP8: Auto-Detect Product Scope
**Given** a project with .ddx-tooling/define.md (product mandate) and ddx/product/define.md
**When** GET /api/status
**Then** response includes scope: "product", capabilities list includes ddx/product/

### HP9: Auto-Detect Capability Scope
**Given** a project with no .ddx-tooling/define.md and folders ddx/001-*, ddx/002-*
**When** GET /api/status
**Then** response includes scope: "capability", capabilities list shows 001, 002 folders

### HP10: Streaming Document Generation
**Given** LLM client configured and mandate.md exists
**When** POST /api/define with { capabilityFolder: "001-user-auth" } expecting streaming
**Then** response starts with HTTP 200 (or SSE stream begins), chunks arrive in order, each chunk is valid JSON with type field, final chunk has type: "complete"

### HP11: Conversation State Persistence
**Given** a POST /api/define request with conversationId: "conv-123"
**When** response returns with conversationId, document is created, then the same conversationId is queried again
**Then** state file .ddx-tooling/state/conv-123.json exists with full conversation history, can continue conversation

### HP12: Check Document Validity
**Given** a well-formed define.md with all required sections (Requirements, Acceptance Criteria, etc.)
**When** POST /api/check with { documentPath: "ddx/001-user-auth/define.md" }
**Then** response is 200, isValid: true, issues array is empty

### HP13: Template Substitution
**Given** a template file with variables {capability_name}, {phase}, {timestamp}
**When** generating a document with those variables in context
**Then** resulting document has variables replaced with actual values, not template placeholders

### HP14: Error Reporting on Missing Prerequisites
**Given** a capability folder with only mandate.md (no define.md)
**When** POST /api/design with { capabilityFolder: "001-user-auth" }
**Then** response is 400, error code "MISSING_PREREQUISITE", message lists "design requires: define.md", prerequisite field is "define"

### HP15: Subsequent API Calls in Same Conversation
**Given** a conversationId with 3 messages already in state
**When** POST /api/define with same conversationId and new context
**Then** new message added to state, context window trimmed if needed, LLM receives all relevant history

## Input Validation Tests

### IV1: Invalid Capability Name
**Given** a POST /api/mandate request
**When** capabilityName contains invalid characters: "user@auth!", "user auth", "USER_AUTH_123"
**Then** response is 400, error code "INVALID_CAPABILITY_NAME", message explains valid format (alphanumerics, hyphens)

### IV2: Missing Required Field
**Given** a POST /api/define request
**When** capabilityFolder field is missing: { context: "...", conversationId: "..." }
**Then** response is 400, error code "MISSING_FIELD", message: "capabilityFolder is required"

### IV3: Empty Context
**Given** a POST /api/define request
**When** context field is empty string: { capabilityFolder: "001-user-auth", context: "" }
**Then** response is 400, error code "INVALID_CONTEXT", message: "context must be non-empty"

### IV4: Invalid Document Path
**Given** a GET /api/documents/:path request
**When** path contains directory traversal: "../../etc/passwd" or starts with "/"
**Then** response is 400, error code "INVALID_PATH", message describes path restrictions

### IV5: Malformed JSON Body
**Given** a POST request
**When** Content-Type is application/json but body is not valid JSON: `{bad json`
**Then** response is 400, error code "INVALID_JSON", message: "Request body must be valid JSON"

### IV6: Invalid Capability Folder Format
**Given** a POST /api/define request
**When** capabilityFolder does not match pattern NNN-name: "user-auth" (no number), "999-feature", "abc-feature"
**Then** for "user-auth" response 400 with error "INVALID_CAPABILITY_FOLDER"; 999-feature might return 404 (not found)

## Failure Scenario Tests

### FS1: LLM API Key Invalid
**Given** server configured with invalid ANTHROPIC_API_KEY
**When** POST /api/define triggers LLM call
**Then** response is 401 (or 500), error code "INVALID_API_KEY", message: "Claude API authentication failed"

### FS2: LLM API Temporarily Unavailable
**Given** LLM mock returns 503 Service Unavailable on first call
**When** POST /api/define triggers retry logic
**Then** server retries with exponential backoff, after 3 failed attempts returns 503 with message "Claude API unavailable. Please try again in a few moments."

### FS3: LLM Rate Limited
**Given** LLM mock returns 429 Too Many Requests
**When** POST /api/define triggers API call
**Then** server does not retry, returns 429 immediately with message: "Rate limit exceeded. Please wait before retrying."

### FS4: Template File Not Found
**Given** POST /api/define with phase "define"
**When** .ddx-tooling/templates/define.md does not exist
**Then** response is 500, error code "TEMPLATE_NOT_FOUND", message: "Template not found: define.md in .ddx-tooling/templates/"

### FS5: Config File Invalid YAML
**Given** server startup
**When** .ddx-tooling/config.yaml has syntax error: "key: : bad indentation"
**Then** server fails to start, logs to stderr: "Invalid YAML in config.yaml: ...", process exits with code 1

### FS6: Config Missing Required Key
**Given** server startup
**When** .ddx-tooling/config.yaml missing llm.model key
**Then** server fails to start, logs: "Configuration error: missing required key 'llm.model'", process exits with code 1

### FS7: Port Already in Use
**Given** port 3000 already bound by another process
**When** server startup attempts to bind to port 3000
**Then** server fails with error "Port 3000 already in use. Change 'port' in config.yaml", process exits with code 1

### FS8: Disk Full When Writing Document
**Given** file system has no available space (ENOSPC)
**When** POST /api/define attempts to write document
**Then** response is 507, error code "DISK_FULL", message: "Insufficient disk space to save document"

### FS9: Corrupted Conversation State File
**Given** .ddx-tooling/state/conv-123.json exists but contains invalid JSON: `{bad json}`
**When** POST /api/define with conversationId: "conv-123"
**Then** response is 200 (operation succeeds), includes "warning": "Previous conversation state corrupted; starting fresh", new conversation state created

### FS10: File System Permission Denied
**Given** ddx/ directory exists but is read-only (no write permission)
**When** POST /api/mandate attempts to create capability folder
**Then** response is 403, error code "PERMISSION_DENIED", message: "Permission denied: cannot write to ddx/"

### FS11: Network Error During LLM Call
**Given** LLM client configured with unreachable endpoint
**When** POST /api/define triggers API call
**Then** after exponential backoff retries (max 3), returns 503 with message: "Network error: unable to reach Claude API"

## Edge Case Tests

### EC1: Empty Project (No Capabilities)
**Given** a fresh project with ddx/ directory empty
**When** POST /api/mandate with { capabilityName: "first-feature" }
**Then** first capability numbered 001-first-feature, next would be 002

### EC2: 999 Capabilities (Max Numbering)
**Given** a project with capabilities 001 through 999 already created
**When** POST /api/mandate with { capabilityName: "new-feature" }
**Then** response is 400, error code "NUMBERING_LIMIT_EXCEEDED", message: "Maximum of 999 capabilities reached"

### EC3: Unicode in Capability Name
**Given** a POST /api/mandate request
**When** capabilityName: "用户认证" (Chinese characters)
**Then** response is 400, error code "INVALID_CAPABILITY_NAME", message: "Only ASCII alphanumerics and hyphens allowed"

### EC4: Very Long Capability Name
**Given** a POST /api/mandate request
**When** capabilityName: "a" repeated 200 times
**Then** response is 400, error code "NAME_TOO_LONG", message: "Capability name must be under 100 characters"

### EC5: Very Large Document Content
**Given** LLM generates a document with 50,000 lines
**When** document is written to disk and retrieved
**Then** file written successfully, GET /api/documents/:path returns full content, no truncation

### EC6: Concurrent Requests to Different Capabilities
**Given** two simultaneous POST /api/mandate requests for different capabilities
**When** both requests execute in parallel
**Then** both succeed, both create their respective folders (001, 002), no file system conflicts

### EC7: Concurrent Requests to Same Capability
**Given** two simultaneous POST /api/define requests for the same capability
**When** both requests execute in parallel
**Then** one succeeds (writes define.md), other gets 409 CONFLICT, message: "Document already being written; try again"
(Or: both succeed and second overwrites; implementation choice, but must be consistent)

### EC8: Very Long Context String
**Given** a POST /api/define request
**When** context: "x" repeated 10,000 times
**Then** prompt is built correctly, LLM call proceeds, result saved

### EC9: Document Already Exists
**Given** define.md already exists at ddx/001-user-auth/define.md
**When** POST /api/define with same capabilityFolder and different context
**Then** response is 200, file is overwritten, lastModified timestamp updated

### EC10: Context Window Trimming (20 Message Limit)
**Given** conversation state with 25 messages (user/assistant pairs)
**When** saving state with contextWindowSize: 20
**Then** only last 20 messages retained in memory, first 5 dropped, LLM only sees last 20

### EC11: Mandate Phase Followed Immediately by Derive
**Given** a capability with only mandate.md
**When** POST /api/derive (attempting to skip design, plan, test)
**Then** response is 400, error code "MISSING_PREREQUISITE", lists all missing prerequisites: "design, plan, test"

### EC12: Phase Folder Already Exists
**Given** ddx/001-user-auth/ folder exists but test/ subfolder already present
**When** POST /api/build creates test.md
**Then** file is created/overwritten in same folder, no error

### EC13: Capability Folder Name Collision
**Given** user requests mandate with capabilityName "user-auth"
**When** a folder 001-user-auth already exists in project
**Then** response is 400, error code "CAPABILITY_ALREADY_EXISTS", message: "001-user-auth already exists"

### EC14: Sliding Window with Odd Message Count
**Given** conversation state with 21 messages (11 user, 10 assistant)
**When** trimming to 20 messages with contextWindowSize: 20
**Then** last 20 messages kept (10 user, 10 assistant, or 9+11), conversation remains coherent

### EC15: SSE Stream Connection Dropped Mid-Stream
**Given** a client subscribed to /api/stream
**When** client closes connection before `data: {"type": "complete"}` arrives
**Then** stream gracefully closes, server resources freed, no orphaned processes

## Integration Tests

### INT1: Complete Mandate-to-Code Workflow
**Given** a fresh capability scope project
**When** executing in order: POST /api/mandate → POST /api/define → POST /api/design → POST /api/plan → POST /api/build → POST /api/derive
**Then** all 6 documents created in correct folder, dependency chain enforced, each phase wrote its document, final response shows complete DAG

### INT2: Multi-Capability Project
**Given** POST /api/mandate creates 001-user-auth, then POST /api/mandate creates 002-payment
**When** POST /api/define on 001-user-auth, POST /api/design on 002-payment
**Then** both capabilities managed independently, docs don't interfere, GET /api/documents lists all correctly

### INT3: Conversation Continuity Across Phases
**Given** a conversationId "conv-1" used for mandate and define
**When** POST /api/mandate with conversationId "conv-1", then POST /api/define with same conversationId
**Then** state file contains both requests and responses, context window preserves relevant history, define can reference mandate

### INT4: Scope Detection Switch
**Given** a capability-scoped project with 001-feature
**When** creating .ddx-tooling/define.md (product mandate)
**Then** GET /api/status scope changes to "product", subsequent API calls aware of product structure

### INT5: Config Hot Reload
**Given** server running with port 3000
**When** modifying .ddx-tooling/config.yaml port to 3001 and restarting server
**Then** new instance binds to 3001, old port freed

### INT6: Validation with Check Endpoint
**Given** define.md exists with missing "Acceptance Criteria" section
**When** POST /api/check with { documentPath: "ddx/001-user-auth/define.md" }
**Then** response is 200, isValid: false, issues array contains error with code "MISSING_SECTION", severity "error"

### INT7: End-to-End Streaming
**Given** all services configured and running
**When** POST /api/define with streaming expected, LLM mocked to return "# User Auth\n\n## Requirements\n..."
**Then** SSE stream opens, chunks arrive sequentially, each chunk valid JSON, complete event signals finish, document persisted

### INT8: Prerequisite Chain Across Product + Capability
**Given** product-scoped project with ddx/product/define.md and ddx/001-feature/mandate.md
**When** POST /api/define on 001-feature
**Then** response is 200, defines based on both product context and capability mandate

### INT9: Error Recovery
**Given** LLM call fails once, succeeds on retry
**When** POST /api/define with retry policy configured
**Then** request ultimately succeeds after backoff, document created, no error visible to client

### INT10: Full Conversation Lifecycle
**Given** starting fresh
**When** POST /api/mandate with conversationId "conv-1" → POST /api/define with "conv-1" → POST /api/design with "conv-1" → check state file
**Then** .ddx-tooling/state/conv-1.json has 6 messages (3 user, 3 assistant), metadata tracks current phase "design", all documents created

## Test Execution Strategy

### Unit Tests
- Run FileManager tests in isolation (mock fs module)
- Run ConfigLoader tests with test config files
- Run LLMClient tests with mock Anthropic SDK
- Run StateManager tests with temp directories
- Run DocumentService tests with mock FileManager
- Run ConversationService tests with mock LLMClient
- Run ConsistencyService tests with mock LLMClient
- Run WorkflowService tests with mock DocumentService

### Integration Tests
- Use temporary test project directory
- Initialize .ddx-tooling/ with test config, templates, prompts
- Start real server instance
- Execute test scenarios via HTTP client
- Verify file system state after each test
- Clean up test directory

### CI/CD
- Run unit tests before integration tests
- Integration tests require environment variable ANTHROPIC_API_KEY for real API tests (or use mocks)
- Test coverage report generated and enforced (>70% minimum)
- Linting (ESLint) and type checking (TypeScript strict) must pass
