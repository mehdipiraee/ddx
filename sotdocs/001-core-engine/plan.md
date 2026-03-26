# DDX v2 Core Engine — Implementation Plan

## Overview
This plan outlines the build order for implementing the DDX v2 Core Engine. The sequence prioritizes foundational infrastructure first, then layered services, and finally integration testing. Each phase builds on previous work and enables testing as we go.

## Phase 1: Project Setup
**Objective**: Establish TypeScript project structure, build tooling, and dependencies.

### Tasks
1. **Initialize npm project**
   - Create package.json with name, version, description
   - Install runtime dependencies:
     - `express` (HTTP server)
     - `@anthropic-ai/sdk` (Claude API client)
     - `yaml` (YAML config parsing)
     - `uuid` (Unique ID generation)
   - Install dev dependencies:
     - `typescript` (TypeScript compiler)
     - `ts-node` (TypeScript execution)
     - `jest` (Testing framework)
     - `@types/express`, `@types/node` (Type definitions)

2. **Create TypeScript configuration**
   - `tsconfig.json` with:
     - `target: ES2020`
     - `module: commonjs`
     - `strict: true`
     - `outDir: dist`
     - `rootDir: src`

3. **Directory structure**
   ```
   ddx-core-engine/
     src/
       index.ts (entry point)
       config/
         configLoader.ts
       infrastructure/
         FileManager.ts
         LLMClient.ts
         StateManager.ts
       services/
         DocumentService.ts
         ConversationService.ts
         ConsistencyService.ts
         WorkflowService.ts
       api/
         routes.ts
         middleware.ts
     tests/
       unit/
       integration/
     package.json
     tsconfig.json
     .env.example
   ```

4. **Create .env.example**
   - `ANTHROPIC_API_KEY=`
   - `DDX_PROJECT_ROOT=.`
   - `PORT=3000`

## Phase 2: Configuration Loader
**Objective**: Parse and validate .ddx-tooling/config.yaml.

### Tasks
1. **Create ConfigLoader class**
   - Input: path to config.yaml
   - Output: Config object with typed schema
   - Methods:
     - `load(path: string): Config`
     - `validate(config: Config): ValidationError[]`
   - Parse YAML file
   - Apply defaults for optional keys:
     - `port: 3000`
     - `temperature: 0.7`
     - `maxTokens: 4000`
     - `maxRetries: 3`
     - `contextWindowSize: 20`
   - Validate required keys: `llm.model`, `llm.apiKey` (via env)
   - Type-safe return with TypeScript interface

2. **Create Config interface**
   ```typescript
   interface Config {
     server: { port: number; nodeEnv: 'development' | 'production' };
     llm: { model: string; temperature: number; maxTokens: number; contextWindow: number };
     prompts: { retryPolicy: { maxRetries: number; initialBackoffMs: number; maxBackoffMs: number } };
     templates: { basePath: string; promptsPath: string };
     state: { basePath: string; contextWindowSize: number };
     project: { docsPath: string };
   }
   ```

3. **Write unit tests**
   - Valid config loads successfully
   - Missing required keys throw error
   - Invalid YAML throws error
   - Defaults apply for optional keys

## Phase 3: File Manager
**Objective**: Abstract file I/O operations with path resolution and auto-numbering.

### Tasks
1. **Create FileManager class**
   - Constructor takes `projectRoot: string`
   - Methods:
     - `async readFile(path: string): Promise<string>`
     - `async writeFile(path: string, content: string): Promise<void>`
     - `async exists(path: string): Promise<boolean>`
     - `async listDir(path: string): Promise<string[]>`
     - `async createDir(path: string): Promise<void>`
     - `async getNextCapabilityNumber(): Promise<number>`

2. **Path resolution**
   - All paths relative to projectRoot
   - Normalize paths to prevent directory traversal
   - Validate paths don't contain `..` or start with `/`

3. **Auto-numbering logic**
   - `getNextCapabilityNumber()`:
     - List `ddx/` directory
     - Find all folders matching `^[0-9]{3}-`
     - Extract leading numbers
     - Return max + 1, zero-padded to 3 digits
     - If no folders exist, return 1

4. **Error handling**
   - Handle ENOENT (file not found) → throw `FileNotFoundError`
   - Handle EACCES (permission denied) → throw `PermissionError`
   - Handle ENOSPC (disk full) → throw `DiskFullError`
   - Handle EISDIR (is directory) → throw `IsDirectoryError`

5. **Write unit tests**
   - Read existing file returns content
   - Write file creates/overwrites correctly
   - Path validation prevents traversal
   - Auto-numbering: empty directory returns 001
   - Auto-numbering: with 003-feature returns 004
   - createDir creates intermediate directories
   - Errors handled appropriately

## Phase 4: LLM Client
**Objective**: Wrap Anthropic Claude API with streaming, retries, and error handling.

### Tasks
1. **Create LLMClient class**
   - Constructor takes `config: LLMConfig` and API key
   - Methods:
     - `async callAPI(messages: Message[]): Promise<string>`
     - `async streamAPI(messages: Message[]): AsyncIterator<string>`

2. **Message building**
   - Accept array of `{ role: 'user' | 'assistant', content: string }`
   - Include system prompt in messages array

3. **Streaming implementation**
   - Use Anthropic SDK `stream()` method
   - Yield chunks as they arrive
   - Handle stream errors (network, API errors)
   - Return full content on completion

4. **Retry logic**
   - Exponential backoff: `min(initialBackoff * 2^attempt, maxBackoff)`
   - Retry on: network errors, 5xx responses, rate limit (429)
   - Don't retry on: 4xx errors (except 429), invalid API key
   - Log each retry attempt with delay

5. **Error handling**
   - `InvalidAPIKeyError` on 401
   - `RateLimitError` on 429 (don't retry, return immediately)
   - `APIUnavailableError` on 5xx after retries
   - `NetworkError` on connection failure
   - All errors include context: attempt count, last response

6. **Token counting** (optional for MVP)
   - Store message count for context window tracking
   - Don't yet implement full token counting

7. **Write unit tests**
   - Mock Anthropic SDK
   - callAPI returns full response
   - streamAPI yields chunks in order
   - Retries on 5xx, succeeds on retry
   - Doesn't retry on 4xx (except 429)
   - Exponential backoff timing correct
   - API key validation on error

## Phase 5: State Manager
**Objective**: Persist and retrieve conversation state with context window management.

### Tasks
1. **Create StateManager class**
   - Constructor takes `config: StateConfig` and `fileManager: FileManager`
   - Methods:
     - `async saveConversation(conversationId: string, state: ConversationState): Promise<void>`
     - `async loadConversation(conversationId: string): Promise<ConversationState | null>`
     - `trimConversationHistory(state: ConversationState, maxMessages: number): ConversationState`

2. **Conversation state schema**
   ```typescript
   interface ConversationState {
     conversationId: string;
     createdAt: ISO8601;
     updatedAt: ISO8601;
     documentPath: string;
     messages: Array<{ role: 'user' | 'assistant'; content: string }>;
     metadata: {
       phase: Phase;
       scope: 'product' | 'capability';
       capabilityFolder?: string;
     };
   }
   ```

3. **Persistence**
   - File path: `.ddx-tooling/state/{conversationId}.json`
   - Save after each API call
   - Pretty-print JSON for readability

4. **Context window management**
   - `trimConversationHistory()`: keep only last N messages
   - If input has more than N messages, drop oldest
   - Always keep at least the most recent user/assistant pair

5. **Error handling**
   - Handle corrupted JSON (log warning, return null)
   - Handle missing state file (return null, not error)
   - Validate state schema on load
   - Handle write failures (propagate error)

6. **Write unit tests**
   - Save and load conversation preserves content
   - Load non-existent conversation returns null
   - Trim keeps last N messages
   - Corrupted JSON logged but doesn't throw
   - Metadata preserved through save/load

## Phase 6: Document Service
**Objective**: CRUD operations, template loading, dependency DAG, scope detection.

### Tasks
1. **Create DocumentService class**
   - Constructor takes `fileManager: FileManager` and `config: Config`
   - Methods:
     - `async createDocument(phase: Phase, capabilityFolder: string, context: string): Promise<Document>`
     - `async getDocument(path: string): Promise<Document>`
     - `async listDocuments(): Promise<Document[]>`
     - `async checkPrerequisites(phase: Phase, capabilityFolder: string): Promise<string[]>`
     - `async detectScope(): Promise<'product' | 'capability'>`
     - `async loadTemplate(phase: Phase): Promise<string>`

2. **Document structure**
   ```typescript
   interface Document {
     path: string;
     phase: Phase;
     content: string;
     lastModified: ISO8601;
     scope?: 'product' | 'capability';
     capabilityFolder?: string;
   }
   ```

3. **Scope detection**
   - Check if `.ddx-tooling/define.md` exists
   - If yes: product-scoped, check `ddx/product/` for docs
   - If no: capability-scoped, check `ddx/NNN-*/` for docs
   - Cache result in memory, revalidate on detectScope call

4. **Prerequisite checking**
   - Define dependency map:
     - `define` requires: `mandate`
     - `design` requires: `define`
     - `plan` requires: `design`
     - `test/build` requires: `plan`
     - `code/derive` requires: `test`
   - Return list of missing prerequisite files
   - Check against actual file system

5. **Template loading**
   - Path: `.ddx-tooling/templates/{phase}.md`
   - Return template content with variables intact
   - Throw error if template not found

6. **List documents**
   - If product-scoped: scan `ddx/product/` and `ddx/NNN-*/`
   - If capability-scoped: scan `ddx/NNN-*/`
   - Return all found `.md` files with metadata

7. **Write unit tests**
   - Scope detection: product vs capability
   - Prerequisite checking: returns missing files
   - Template loading: reads file correctly
   - List documents: finds all phases in all capabilities
   - Get document: reads content and metadata
   - Create document: writes file with timestamp

## Phase 7: Conversation Service
**Objective**: Prompt building, LLM orchestration, history management.

### Tasks
1. **Create ConversationService class**
   - Constructor takes `llmClient: LLMClient`, `documentService: DocumentService`, `stateManager: StateManager`
   - Methods:
     - `async buildPrompt(template: string, context: Record<string, string>): string`
     - `async generateDocument(phase: Phase, context: string, history?: Message[]): AsyncIterator<string>`
     - `async getOrCreateConversation(conversationId?: string): Promise<string>` (returns conversationId)

2. **Prompt building**
   - Input: template (with variables like {capability_name}) and context
   - Output: fully interpolated prompt ready for LLM
   - Validate all template variables are present in context
   - Include system prompt (about being a documentation expert)

3. **Document generation**
   - Accept phase, context, and optional message history
   - If history: trim to context window size
   - Build full prompt with system message
   - Call LLM streaming API
   - Yield chunks as they arrive
   - Return conversation ID for state persistence

4. **System prompt**
   - Describe role: "You are an expert documentation writer for software capabilities"
   - Describe format: "Output must be valid Markdown"
   - Describe structure: reference required sections for each phase
   - Keep concise but clear

5. **Error handling**
   - LLM errors propagate up (let caller handle)
   - Template variable mismatches throw error
   - Invalid phase throws error

6. **Write unit tests**
   - Mock LLM client
   - Prompt building interpolates variables correctly
   - generateDocument returns async iterator
   - Streaming chunks are yielded
   - History trimming works
   - System prompt included

## Phase 8: Consistency Service
**Objective**: Semantic validation via LLM.

### Tasks
1. **Create ConsistencyService class**
   - Constructor takes `llmClient: LLMClient`
   - Methods:
     - `async validateDocument(documentPath: string, content: string): Promise<ValidationResult>`

2. **Validation schema**
   ```typescript
   interface ValidationResult {
     isValid: boolean;
     issues: Array<{
       severity: 'error' | 'warning';
       code: string;
       message: string;
     }>;
   }
   ```

3. **Validation rules by phase**
   - **mandate**: Has mission statement, success criteria
   - **define**: Has functional requirements, acceptance criteria, non-functional requirements
   - **design**: Has architecture section, data models, API endpoints, error handling
   - **plan**: Has ordered build steps, estimated effort
   - **test/build**: Has test cases with Given/When/Then format
   - **code/derive**: Has code samples, generated code makes sense

4. **Validation approach**
   - Use LLM to check structural completeness
   - Build validation prompt with section checklist
   - Parse LLM response for found/missing sections
   - Return warnings for optional sections, errors for required

5. **Error handling**
   - LLM errors don't fail validation, return empty issues
   - Invalid document path throws error

6. **Write unit tests**
   - Mock LLM client
   - Valid document returns no issues
   - Missing required section returns error
   - Optional section missing returns warning
   - LLM error handled gracefully

## Phase 9: Workflow Service
**Objective**: Prerequisite checking, progressive decomposition.

### Tasks
1. **Create WorkflowService class**
   - Constructor takes `documentService: DocumentService`
   - Methods:
     - `async canAdvanceToPhase(phase: Phase, capabilityFolder: string): Promise<boolean>`
     - `async getMissingPrerequisites(phase: Phase, capabilityFolder: string): Promise<Phase[]>`

2. **Dependency enforcement**
   - Return false if any prerequisites missing
   - Return true if all prerequisites present
   - Report which prerequisites are missing

3. **Edge cases**
   - mandate has no prerequisites (always allowed)
   - Empty capability folder allows only mandate
   - Later phases can't be created without earlier ones

4. **Write unit tests**
   - Can create mandate (no prerequisites)
   - Can't create define without mandate
   - Can create define with mandate present
   - getMissingPrerequisites returns correct list

## Phase 10: Express Server with API Routes
**Objective**: HTTP server exposing all API endpoints.

### Tasks
1. **Create main server file (index.ts)**
   - Load config from .ddx-tooling/config.yaml
   - Initialize all services
   - Create Express app
   - Register routes
   - Start server on configured port
   - Handle startup errors (port in use, invalid config)

2. **Create routes file (routes.ts)**
   - **POST /api/mandate**
     - Parse request body: capabilityName, context, conversationId
     - Validate capabilityName format
     - Get next capability number
     - Call DocumentService.createDocument
     - Save state via StateManager
     - Return 200 with document content
   
   - **POST /api/define, /api/design, /api/plan, /api/build, /api/derive**
     - Parse request body: capabilityFolder, context, conversationId
     - Check prerequisites via WorkflowService
     - If missing, return 400 with error
     - Call DocumentService.createDocument
     - Save state via StateManager
     - Return 200 with document content
   
   - **GET /api/documents**
     - Call DocumentService.listDocuments
     - Return 200 with array
   
   - **GET /api/documents/:path**
     - Validate path format
     - Call DocumentService.getDocument
     - Return 200 with document or 404
   
   - **GET /api/status**
     - Return server uptime, config, scope, capabilities
     - Return 200
   
   - **POST /api/check**
     - Parse request body: documentPath, conversationId
     - Call ConsistencyService.validateDocument
     - Return 200 with validation result
   
   - **GET /api/stream** (SSE endpoint)
     - Upgrade connection to SSE
     - Subscribe to generation stream
     - Send chunks as `data: {...}` format
     - Send `data: {"type": "complete"}` on finish

3. **Error handling middleware**
   - Catch 404 → return 404 JSON
   - Catch validation errors → return 400 JSON
   - Catch unhandled exceptions → return 500 JSON
   - Log all errors

4. **Request validation middleware**
   - Validate Content-Type for POST requests
   - Validate required fields present
   - Return 400 if invalid

5. **Write unit tests**
   - Mock all services
   - Test each endpoint success path
   - Test error paths (missing prerequisites, invalid input)
   - Test response format matches spec
   - Test error status codes

## Phase 11: Integration Testing
**Objective**: Full end-to-end workflows across all services.

### Tasks
1. **Setup test environment**
   - Create temporary test directory
   - Initialize test .ddx-tooling/ structure
   - Create test config.yaml
   - Create test templates in .ddx-tooling/templates/

2. **Happy path test**
   - Start server
   - POST /api/mandate with capability name
   - Verify response contains documentPath and content
   - Verify file written to disk
   - POST /api/define to same capability
   - Verify define.md created
   - GET /api/documents to list all
   - Verify both documents listed

3. **Scope detection test**
   - Test with product define.md → product-scoped
   - Test without product define.md → capability-scoped

4. **Auto-numbering test**
   - Create first capability → 001-name
   - Create second capability → 002-name
   - Verify ordering correct

5. **Prerequisite enforcement test**
   - Try to create design without mandate → 400 error
   - Create mandate
   - Create define → succeeds
   - Try to create design without define → 400 error

6. **State persistence test**
   - Create document with conversationId
   - Retrieve same conversationId
   - Verify state restored correctly

7. **Template loading test**
   - Missing template returns error
   - Valid template loads and interpolates

8. **LLM integration test**
   - Mock Anthropic API
   - Generate document via endpoint
   - Verify prompt sent to API
   - Verify streaming chunks returned
   - Verify document saved

9. **Cleanup**
   - Stop server
   - Remove test directory

## Implementation Order Summary
1. Phase 1: Project setup
2. Phase 2: Config loader
3. Phase 3: File Manager
4. Phase 4: LLM Client
5. Phase 5: State Manager
6. Phase 6: Document Service
7. Phase 7: Conversation Service
8. Phase 8: Consistency Service
9. Phase 9: Workflow Service
10. Phase 10: Express server + routes
11. Phase 11: Integration testing

## Estimated Effort
- Phase 1: 1 hour
- Phase 2: 2 hours
- Phase 3: 3 hours
- Phase 4: 4 hours
- Phase 5: 3 hours
- Phase 6: 4 hours
- Phase 7: 3 hours
- Phase 8: 3 hours
- Phase 9: 2 hours
- Phase 10: 6 hours
- Phase 11: 5 hours
- **Total: ~36 hours** (4.5 days for one developer)

## Testing Strategy
- Unit tests: ~70% of code coverage (all services)
- Integration tests: Happy path + error scenarios
- Manual testing: Full workflow before release
