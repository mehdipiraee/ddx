# DDX v2 Core Engine — Technical Design

## Architecture Overview

The core engine follows a three-layer architecture:

### Layer 1: Infrastructure Layer
Low-level services that handle I/O and external integrations:
- **File Manager**: Read/write files, path resolution, auto-numbering
- **LLM Client**: Anthropic Claude API calls, streaming, retries
- **State Manager**: Conversation persistence, context window management

### Layer 2: Service Layer
Domain-specific services that compose infrastructure layer:
- **Document Service**: CRUD operations, template loading, dependency DAG
- **Conversation Service**: Prompt assembly, LLM orchestration, history
- **Consistency Service**: Semantic validation via LLM
- **Workflow Service**: Prerequisite checking, phase transitions

### Layer 3: Presentation Layer
Express.js HTTP server exposing REST API endpoints and SSE

## Data Models

### Configuration Schema (.ddx-tooling/config.yaml)
```yaml
server:
  port: 3000                    # HTTP server port
  nodeEnv: development|production

llm:
  model: claude-3-5-sonnet-20241022
  temperature: 0.7              # 0.0 = deterministic, 1.0 = random
  maxTokens: 4000               # Max output tokens per request
  contextWindow: 200000          # Claude model context window

prompts:
  retryPolicy:
    maxRetries: 3               # Max LLM call retries
    initialBackoffMs: 1000      # Exponential backoff start
    maxBackoffMs: 30000         # Exponential backoff ceiling

templates:
  basePath: .ddx-tooling/templates
  promptsPath: .ddx-tooling/prompts

state:
  basePath: .ddx-tooling/state
  contextWindowSize: 20         # Max messages per conversation

project:
  docsPath: .                   # Root documentation path
```

### Conversation State Schema (.ddx-tooling/state/{conversationId}.json)
```json
{
  "conversationId": "conv-uuid",
  "createdAt": "2026-03-21T10:30:00Z",
  "updatedAt": "2026-03-21T10:35:00Z",
  "documentPath": "ddx/001-user-auth/define.md",
  "messages": [
    {
      "role": "user",
      "content": "Create a define document for user authentication"
    },
    {
      "role": "assistant",
      "content": "I'll create a comprehensive define document..."
    }
  ],
  "metadata": {
    "phase": "define",
    "scope": "capability",
    "capabilityFolder": "001-user-auth"
  }
}
```

### Document Dependency DAG
```
mandate (initial)
    ↓
define (requires mandate)
    ↓
design (requires define)
    ↓
plan (requires design)
    ↓
test (requires plan, aka "build")
    ↓
code (requires test, aka "derive")
```

File paths: `{capability}/mandate.md`, `{capability}/define.md`, etc.

### Project Structure Detection
```
Product Scope:
  .ddx-tooling/
    define.md (product mandate)
  ddx/
    product/
      define.md (product define)
      design.md
      plan.md
      test.md
      code.md
    001-capability-name/
      mandate.md
      define.md
      ...

Capability Scope:
  .ddx-tooling/
    config.yaml
  ddx/
    001-capability-name/
      mandate.md
      define.md
      ...
```

## API Endpoints

### POST /api/mandate
**Request:**
```json
{
  "capabilityName": "user-authentication",
  "context": "User-facing authentication system",
  "conversationId": "conv-123" (optional)
}
```

**Response (200):**
```json
{
  "status": "success",
  "phase": "mandate",
  "documentPath": "ddx/001-user-authentication/mandate.md",
  "capabilityFolder": "001-user-authentication",
  "content": "# User Authentication Mandate\n...",
  "conversationId": "conv-123",
  "nextPhase": "define"
}
```

**Response (400):**
```json
{
  "status": "error",
  "code": "INVALID_CAPABILITY_NAME",
  "message": "Capability name must contain only alphanumerics and hyphens"
}
```

### POST /api/define
**Request:**
```json
{
  "capabilityFolder": "001-user-authentication",
  "context": "Additional context for define phase",
  "conversationId": "conv-123" (optional)
}
```

**Response (200):**
```json
{
  "status": "success",
  "phase": "define",
  "documentPath": "ddx/001-user-authentication/define.md",
  "content": "# User Authentication Requirements\n...",
  "conversationId": "conv-123",
  "nextPhase": "design"
}
```

**Response (400):**
```json
{
  "status": "error",
  "code": "MISSING_PREREQUISITE",
  "message": "Cannot create define document: mandate.md not found",
  "prerequisite": "mandate"
}
```

### POST /api/design, /api/plan, /api/build, /api/derive
Similar structure to /api/define with appropriate phase checks.

**POST /api/build** maps to the "test" phase internally.
**POST /api/derive** maps to the "code" phase internally.

### GET /api/documents
**Response (200):**
```json
{
  "status": "success",
  "scope": "product|capability",
  "documents": [
    {
      "path": "ddx/product/define.md",
      "phase": "define",
      "scope": "product",
      "lastModified": "2026-03-21T10:30:00Z"
    },
    {
      "path": "ddx/001-user-auth/mandate.md",
      "phase": "mandate",
      "scope": "capability",
      "capabilityFolder": "001-user-auth",
      "lastModified": "2026-03-21T10:35:00Z"
    }
  ]
}
```

### GET /api/documents/:path
**Response (200):**
```json
{
  "status": "success",
  "path": "ddx/001-user-auth/define.md",
  "phase": "define",
  "content": "# User Authentication Requirements\n...",
  "lastModified": "2026-03-21T10:35:00Z"
}
```

**Response (404):**
```json
{
  "status": "error",
  "code": "DOCUMENT_NOT_FOUND",
  "message": "Document at 'ddx/001-user-auth/define.md' does not exist"
}
```

### GET /api/status
**Response (200):**
```json
{
  "status": "ready",
  "uptime": 12345,
  "config": {
    "port": 3000,
    "llmModel": "claude-3-5-sonnet-20241022",
    "contextWindow": 20
  },
  "scope": "product|capability",
  "capabilities": [
    {
      "folder": "001-user-auth",
      "phases": ["mandate", "define"]
    }
  ]
}
```

### POST /api/check
**Request:**
```json
{
  "documentPath": "ddx/001-user-auth/define.md",
  "conversationId": "conv-123" (optional)
}
```

**Response (200):**
```json
{
  "status": "success",
  "isValid": true,
  "issues": [],
  "conversationId": "conv-123"
}
```

**Response (200) with issues:**
```json
{
  "status": "success",
  "isValid": false,
  "issues": [
    {
      "severity": "error|warning",
      "code": "MISSING_ACCEPTANCE_CRITERIA",
      "message": "Acceptance Criteria section is required but not found"
    }
  ],
  "conversationId": "conv-123"
}
```

### SSE /api/stream
Streaming endpoint for long-running LLM operations.

**Request:**
```json
{
  "documentPath": "ddx/001-user-auth/define.md",
  "conversationId": "conv-123"
}
```

**Response:** Server-Sent Events stream
```
data: {"type": "thinking", "content": "Analyzing requirements..."}
data: {"type": "chunk", "content": "# User Authentication"}
data: {"type": "chunk", "content": "\n\n## Requirements"}
data: {"type": "complete", "conversationId": "conv-123"}
```

## Behavior Flows

### Command Execution Flow (e.g., POST /api/define)
1. **Parse Request**: Extract capability folder, context, conversationId
2. **Validate Input**: Check capability folder format, context length
3. **Load Config**: Read .ddx-tooling/config.yaml
4. **Check Prerequisites**: Verify mandate.md exists
5. **Load State**: Retrieve conversation history if conversationId provided
6. **Load Template**: Read define.md template from templates/
7. **Build Prompt**: Assemble system prompt + template + context + history
8. **Call LLM**: Stream response via /api/stream or return in response
9. **Validate Output**: Check LLM output structure
10. **Persist Document**: Write content to ddx/{capabilityFolder}/define.md
11. **Save State**: Persist conversation to .ddx-tooling/state/{conversationId}.json
12. **Return Response**: JSON with document path, content, next phase

### Scope Detection Flow
1. **Check Product Level**: Does `.ddx-tooling/define.md` exist?
2. **If Yes**: Project is product-scoped
3. **If No**: Check for capability folders in ddx/
4. **If Found**: Project is capability-scoped
5. **Cache Result**: Store in memory, revalidate on /api/status

### Auto-Numbering Flow
1. **List Existing**: Scan ddx/ for folders matching `NNN-*` pattern
2. **Extract Numbers**: Parse leading digits from each folder
3. **Find Max**: Determine highest existing number
4. **Increment**: Generate nextNumber = max + 1, padded to 3 digits
5. **Format**: Create folder name as `{nextNumber}-{capabilityName}`

### Prerequisite Chain Flow
1. **Get Phase**: Determine requested phase (define, design, plan, etc.)
2. **Get Dependencies**: Map phase to required prerequisite phases
3. **Check Files**: For each prerequisite, verify file exists in capability folder
4. **Report Missing**: If any missing, return 400 with list
5. **Allow**: If all present, proceed with document generation

## Error Modes & Handling

### EM1: LLM API Unavailable
- **Detection**: Network error or 5xx response from Anthropic
- **Handling**: Retry with exponential backoff (max 3 retries)
- **Response**: After max retries, return 503 with message "Claude API unavailable. Please try again in a few moments."
- **Logging**: Log error with timestamp and request details

### EM2: Invalid Template
- **Detection**: Template file not found or has syntax errors
- **Handling**: Return 500 with clear error message
- **Response**: "Template not found: define.md in .ddx-tooling/templates/"
- **Logging**: Log template path and reason for failure

### EM3: Corrupted State File
- **Detection**: JSON parsing fails when loading conversation state
- **Handling**: Log error, create new conversation state, warn client
- **Response**: Include "warning" field in JSON: "Previous conversation state corrupted; starting fresh"
- **Logging**: Log corrupted file path and error

### EM4: Disk Full
- **Detection**: ENOSPC error when writing file
- **Handling**: Return 507 with message
- **Response**: "Insufficient disk space to save document"
- **Logging**: Log error and available disk space

### EM5: Port Already in Use
- **Detection**: EADDRINUSE error on server startup
- **Handling**: Exit process with error message
- **Response**: Console error "Port 3000 already in use. Change 'port' in config.yaml"
- **Logging**: Log to stderr

### EM6: Invalid Configuration
- **Detection**: YAML parsing error or missing required keys
- **Handling**: Exit process with error message
- **Response**: "Invalid configuration in .ddx-tooling/config.yaml: missing key 'llm.model'"
- **Logging**: Log to stderr

## Constraints & Tradeoffs

### C1: Context Window Size
- **Constraint**: Anthropic Claude models have token limits (200K context window)
- **Tradeoff**: Limit conversation history to 20 messages to stay well under limit
- **Impact**: Users can't reference very old messages; mitigation is document versioning
- **Alternative**: Could implement summarization, but adds complexity

### C2: State Persistence
- **Constraint**: File system limits on state directory
- **Tradeoff**: Keep state files on disk, one per conversation
- **Impact**: Very high conversation counts could consume disk space
- **Alternative**: Could use database, but adds deployment complexity

### C3: Auto-Numbering Strategy
- **Constraint**: Folder names must be human-readable and sortable
- **Tradeoff**: Use 3-digit zero-padded numbers (001, 002, ..., 999)
- **Impact**: Limits to 999 capabilities per project
- **Alternative**: Use UUIDs, but sacrifice human readability

### C4: Streaming vs Batch
- **Constraint**: Large documents take time to generate
- **Tradeoff**: Stream responses via SSE for perceived responsiveness
- **Impact**: Client must handle streaming protocol
- **Alternative**: Batch API returns full content after generation, but longer perceived latency

### C5: Stateless vs Stateful
- **Constraint**: Server should be horizontally scalable
- **Tradeoff**: Store state on disk; conversationId is always required by client
- **Impact**: Requires distributed file system in multi-instance deployment
- **Alternative**: Use Redis or database for state, but adds infrastructure dependency

## Service Interfaces

### FileManager
```typescript
interface FileManager {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listDir(path: string): Promise<string[]>;
  createDir(path: string): Promise<void>;
  getNextCapabilityNumber(): Promise<number>;
}
```

### LLMClient
```typescript
interface LLMClient {
  callAPI(messages: Message[]): Promise<string>;
  streamAPI(messages: Message[]): AsyncIterator<string>;
}
```

### StateManager
```typescript
interface StateManager {
  saveConversation(conversationId: string, state: ConversationState): Promise<void>;
  loadConversation(conversationId: string): Promise<ConversationState | null>;
  trimConversationHistory(state: ConversationState, maxMessages: number): ConversationState;
}
```

### DocumentService
```typescript
interface DocumentService {
  createDocument(phase: Phase, capabilityFolder: string, context: string): Promise<Document>;
  getDocument(path: string): Promise<Document>;
  listDocuments(): Promise<Document[]>;
  checkPrerequisites(phase: Phase, capabilityFolder: string): Promise<string[]>; // returns missing docs
  detectScope(): Promise<"product" | "capability">;
}
```

### ConversationService
```typescript
interface ConversationService {
  buildPrompt(template: string, context: Record<string, string>): string;
  generateDocument(phase: Phase, context: string, history?: Message[]): AsyncIterator<string>;
}
```

### ConsistencyService
```typescript
interface ConsistencyService {
  validateDocument(documentPath: string): Promise<ValidationResult>;
}
```

### WorkflowService
```typescript
interface WorkflowService {
  canAdvanceToPhase(phase: Phase, capabilityFolder: string): Promise<boolean>;
  getMissingPrerequisites(phase: Phase, capabilityFolder: string): Promise<Phase[]>;
}
```
