# DDX v2 Core Engine — Requirements Definition

## Overview
The DDX v2 Core Engine is a server-side application that orchestrates AI-powered documentation workflows. It functions as the central hub that all client modes (CLI, Claude Skills, MCP, Web UI) connect to via REST API. The engine manages the entire documentation generation lifecycle, from mandate through derivation, handling document dependencies, LLM integration, and state persistence.

## Users & Stakeholders
- **Primary Users**: CLI client, Claude Skill client, MCP client, Web UI client
- **End Users**: Documentation teams, product managers, engineers using DDX to generate capability documentation
- **Developers**: Teams maintaining and extending the core engine

## Functional Requirements

### FR1: Document Lifecycle Management
- Must support document creation through six phases: mandate → define → design → plan → test → code
- Must maintain a dependency DAG (directed acyclic graph) tracking document relationships
- Each phase depends on successful completion of its predecessors
- Must validate prerequisites before allowing document transitions

### FR2: API Endpoints
The server must expose the following REST endpoints:
- **POST /api/mandate**: Initiate a new capability mandate
- **POST /api/define**: Create/update a define document
- **POST /api/design**: Create/update a design document
- **POST /api/plan**: Create/update a plan document
- **POST /api/build**: Create/update a test document
- **POST /api/derive**: Create/update a code derivation document
- **GET /api/documents**: List all documents in the project
- **GET /api/documents/:path**: Retrieve a specific document by file path
- **GET /api/status**: Report server health and configuration
- **POST /api/check**: Validate a document against consistency rules
- **SSE /api/stream**: Server-sent events for streaming LLM responses

### FR3: Scope Auto-Detection
- Must automatically detect whether the project operates at product level or capability level
- Detection rule: If `.ddx-tooling/define.md` exists (product mandate), the project is product-scoped
- If no product define.md exists, treat as capability-scoped
- Must report detected scope in API responses and guide subsequent operations

### FR4: Auto-Numbering
- Must auto-number capability folders with format `NNN-name` (e.g., `001-user-auth`, `002-payment-gateway`)
- Numbering must be sequential and not have gaps
- Must generate the next available number when creating new capability folders
- Must preserve existing numbers when reading capability structure

### FR5: Template & Prompt Loading
- Must load Markdown templates from `.ddx-tooling/templates/` directory
- Must load LLM prompts from `.ddx-tooling/prompts/` directory
- Must handle missing templates/prompts gracefully with clear error messages
- Template variables must be substitutable (e.g., `{capability_name}`, `{phase}`)

### FR6: LLM Integration
- Must integrate with Anthropic Claude API for AI-powered document generation
- Must support streaming responses via Server-Sent Events (SSE)
- Must handle token limits and apply sliding-window context management (20-message window)
- Must retry failed LLM requests with exponential backoff
- Must fail gracefully if LLM service is unavailable

### FR7: State Persistence
- Must persist conversation state to `.ddx-tooling/state/` directory
- Must store conversation history in JSON format
- Must support reading conversation history for context in subsequent requests
- Must manage context window size (max 20 messages per conversation)

### FR8: Configuration Management
- Must load configuration from `.ddx-tooling/config.yaml`
- Configuration must include: API port, LLM model, temperature, max tokens, retry policy
- Must validate configuration on startup
- Must use sensible defaults for optional fields

### FR9: Dependency Tracking
- Must enforce document dependency chain: mandate → define → design → plan → test → code
- Must check prerequisite documents exist before allowing advancement
- Must report missing prerequisites to the client
- Must prevent circular dependencies

### FR10: Error Handling & Reporting
- Must return appropriate HTTP status codes (200, 400, 401, 404, 500, 503)
- Must include descriptive error messages in JSON responses
- Must not expose internal server errors to clients
- Must log all errors for debugging

## Non-Functional Requirements

### NFR1: Performance
- Must start up within 5 seconds
- Must respond to GET requests within 1 second (excluding LLM calls)
- Must handle streaming LLM responses with <500ms latency between chunks

### NFR2: Scalability
- Must support multiple concurrent client connections
- Must handle 10+ simultaneous document requests
- Must not degrade significantly under load

### NFR3: Reliability
- Must gracefully handle network interruptions
- Must not lose state if unexpectedly terminated (state persisted to disk)
- Must validate file system integrity on startup

### NFR4: Testability
- Code must be unit-testable with clear service boundaries
- Must support dependency injection for testing
- Must provide mock/stub capabilities for LLM client

## Acceptance Criteria

### AC1: Server Initialization
- [ ] Server starts successfully when `.ddx-tooling/` directory exists
- [ ] Server binds to configured port
- [ ] Server reports ready status via GET /api/status

### AC2: API Endpoints
- [ ] All six phase endpoints (mandate, define, design, plan, build, derive) accept POST requests
- [ ] All endpoints return JSON responses with appropriate status codes
- [ ] GET /api/documents returns list of all documents
- [ ] GET /api/documents/:path returns specific document content
- [ ] POST /api/check validates document consistency

### AC3: Document CRUD
- [ ] Can create a new document via POST endpoint
- [ ] Can read document content via GET endpoint
- [ ] Can update document via subsequent POST
- [ ] Can list all documents in project

### AC4: Dependency Tracking
- [ ] Trying to create a design document without a define document fails with 400 error
- [ ] Trying to create a plan document without design document fails with 400 error
- [ ] Missing prerequisites are clearly reported in error message

### AC5: Scope Detection
- [ ] Product-scoped detection works when `.ddx-tooling/define.md` exists
- [ ] Capability-scoped detection works when product define.md does not exist
- [ ] Detected scope is returned in API responses

### AC6: Auto-Numbering
- [ ] First capability folder auto-numbers to `001-name`
- [ ] Second capability auto-numbers to `002-name`
- [ ] Numbering increments correctly for subsequent capabilities
- [ ] Existing numbered folders are preserved

### AC7: LLM Integration
- [ ] Server successfully calls Anthropic Claude API
- [ ] Streaming responses work via SSE
- [ ] Invalid API key returns appropriate error
- [ ] LLM unavailability returns 503 with retry guidance

### AC8: State Persistence
- [ ] Conversation state is saved to `.ddx-tooling/state/`
- [ ] State survives server restart
- [ ] Context window management limits history to 20 messages
- [ ] Corrupted state file is detected and reported

### AC9: Configuration
- [ ] Config loads from `.ddx-tooling/config.yaml`
- [ ] All required config keys are present
- [ ] Invalid config format returns startup error
- [ ] Default values apply for optional keys

### AC10: Error Handling
- [ ] Invalid request payloads return 400 with descriptive message
- [ ] Resource not found returns 404
- [ ] Server errors return 500 without exposing stack traces
- [ ] All errors are logged

## Out of Scope
- Authentication/authorization (assumed handled by client layer)
- User interface (Web UI is separate client mode)
- Document version history (beyond conversation state)
- Real-time collaboration features
- Analytics and metrics collection
