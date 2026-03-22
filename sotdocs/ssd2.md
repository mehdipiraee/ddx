# System Design Document v2.0

## Summary

DDX (Document Dependency eXchange) is an AI-powered documentation orchestration system that maintains alignment across the software development lifecycle through scope-based organization, dependency tracking, and semantic consistency checking. The system provides four interaction modes—CLI, Interactive REPL, Web Interface, and MCP Server—all built on a shared service layer. This version introduces **multi-level documentation support** that enables teams to maintain documentation at different granularity levels (product, feature, component) without namespace collisions, allowing parallel feature development while ensuring architectural consistency through intelligent drift detection and conditional update requirements.

## Context & Requirements

### Scale & Performance
- **Users**: Single developer to small teams (5-10 people) initially, expandable to medium teams (20-50)
- **Documents**: Up to 1000 documents per project across multiple scopes
- **Features**: Support for 50+ concurrent feature development efforts
- **Response time**: LLM interactions 2-10s depending on provider; local operations < 500ms; scope-aware operations < 1s
- **Concurrency**: Web mode supports multiple simultaneous users on same project with scope isolation

### Non-Functional Requirements
- **Reliability**: Workflow state persistence with scope awareness to resume interrupted sessions
- **Extensibility**: Pluggable document templates and prompts via filesystem; custom scopes configurable
- **Portability**: Node.js-based, cross-platform (macOS, Linux, Windows)
- **Observability**: Structured logging for LLM calls, file operations, consistency checks, and cross-scope references
- **Security**: API keys stored in environment variables; no credentials in config files
- **Scalability**: Efficient graph traversal for deep dependency chains across scopes
- **Backward Compatibility**: Seamless migration from v0.1.x flat structure to scoped structure

### Constraints
- Depends on external LLM providers (Anthropic Claude API) for document creation and consistency checking
- Stateful workflows require local file system access with scope-based directory organization
- Web mode requires network connectivity for WebSocket communication
- MCP mode requires stdio communication (no interactive user input)
- Architectural drift detection requires LLM analysis (non-deterministic but pragmatic)

### New Requirements (Multi-Level Documentation)
- **Scope Isolation**: Documents at different scopes (product/feature/component) must not collide
- **Context References**: Feature-level docs reference product-level architecture without creating hard dependencies
- **Conditional Updates**: Small features bypass architectural documentation; significant features require SDD updates
- **Architectural Significance Detection**: AI-powered detection of when features introduce architectural changes
- **Parallel Workflows**: Multiple developers working on separate features without conflicts

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Interaction Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   CLI    │  │   REPL   │  │    Web   │  │   MCP    │           │
│  │  (yargs) │  │(readline)│  │ (Express)│  │ (stdio)  │           │
│  │          │  │          │  │          │  │          │           │
│  │  Scope-  │  │  Scope-  │  │  Scope-  │  │  Scope-  │           │
│  │  aware   │  │  aware   │  │  aware   │  │  aware   │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
└───────┼─────────────┼─────────────┼─────────────┼──────────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│                     Service Layer                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Document Service │  │Conversation Svc  │  │  Consistency     │ │
│  │ - CRUD ops       │  │ - History mgmt   │  │  Service         │ │
│  │ - Template load  │  │ - Prompt build   │  │ - Semantic valid.│ │
│  │ - Extraction     │  │ - LLM orchestr.  │  │ - Arch. drift    │ │
│  │ - Scope lookup   │  │ - Context build  │  │   detection      │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘ │
│           │                     │                      │            │
│           └──────┬──────────────┴──────────────────────┘            │
│                  │                                                   │
│  ┌───────────────┴──────────────────────────────────────────────┐  │
│  │               Scope Resolution Engine                        │  │
│  │  - Parse scope:doc_type syntax                               │  │
│  │  - Resolve context_refs across scopes                        │  │
│  │  - Build scoped dependency graphs                            │  │
│  │  - Detect cross-scope inconsistencies                        │  │
│  │  - Manage parameterized paths ({feature_name})               │  │
│  └───────────────┬──────────────────────────────────────────────┘  │
└──────────────────┼──────────────────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────────────────────────┐
│                Infrastructure Layer                                  │
│  ┌───────────────┴──────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │     File Manager         │  │  LLM Client  │  │State Manager │ │
│  │  - Scoped read/write     │  │  - Streaming │  │ - Scoped     │ │
│  │  - Graph walk (multi)    │  │  - Anthropic │  │   conv. state│ │
│  │  - Param substitution    │  │  - Retry     │  │ - Arch flags │ │
│  └──────────────────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
            │                     │                    │
            v                     v                    v
      File System            Anthropic API       .ddx/ folder
    (scoped structure)                          (scoped state)

  sotdocs/
  ├── product/
  │   ├── opportunity_brief.md
  │   ├── one_pager.md
  │   ├── prd.md
  │   └── sdd.md
  └── features/
      ├── git_hooks/
      │   ├── opportunity.md
      │   ├── spec.md
      │   └── implementation.md
      └── watch_mode/
          └── spec.md
```

### Key Flows

**1. Scoped Document Creation Flow:**
```
User: ddx create feature:spec --name git_hooks
  ↓
CLI: Parse "feature:spec" + params {feature_name: "git_hooks"}
  ↓
Scope Resolution Engine:
  - Lookup feature.spec config
  - Resolve output path: sotdocs/features/git_hooks/spec.md
  - Identify context_refs: [product:prd, product:sdd]
  ↓
Document Service:
  - Load feature.spec template
  - Load upstream docs (within feature scope)
  - Load context docs (from product scope)
  ↓
Conversation Service:
  - Build system prompt with upstream + context
  - Mark context docs as "reference only, not authoritative"
  ↓
LLM Client: Stream response
  ↓
Document Service: Extract and write to sotdocs/features/git_hooks/spec.md
  ↓
State Manager: Persist conversation with scope metadata
```

**2. Architectural Drift Detection Flow:**
```
User: ddx check feature:spec --name git_hooks
  ↓
Consistency Service:
  - Check upstream (feature:opportunity)
  - Check context refs (product:prd, product:sdd)
  ↓
Architectural Drift Analyzer (for product:sdd context):
  - Load feature spec content
  - Load product SDD content
  - Build LLM prompt with architectural significance criteria
  - Request JSON response with drift analysis
  ↓
LLM returns:
  {
    "detected": true,
    "changes": ["New async workflow for git hooks", "New .git/ filesystem integration"],
    "recommendation": "Update SDD sections: Component Details, Integration Points",
    "severity": "medium"
  }
  ↓
Consistency Service:
  - If feature marked --architectural: FAIL check
  - Otherwise: WARN but pass check
  - Display architectural drift report
```

**3. Cross-Scope Context Loading Flow:**
```
Feature spec creation needs product SDD as context
  ↓
Scope Resolution Engine:
  - feature.spec has context_refs: [{scope: "product", docs: ["sdd"]}]
  - Resolve product:sdd → sotdocs/product/sdd.md
  ↓
Document Service:
  - Read sotdocs/product/sdd.md
  - Tag as "context reference" (not dependency)
  ↓
Conversation Service:
  - Include in system prompt with instruction:
    "The following is the product-level architecture. Ensure your feature
     design is consistent with this architecture. If your feature requires
     architectural changes, note them explicitly."
```

## Component Details

### 1. Interaction Layer

#### CLI Mode (`src/cli.ts`)
**Responsibilities:**
- Parse scope-aware commands (`scope:doc_type` syntax)
- Extract parameters (`--name`, `--params`, `--architectural`)
- Dispatch to Scope Resolution Engine
- Handle backward compatibility (unscoped commands default to `product` scope)

**New Commands:**
```bash
# Scoped creation
ddx create product:prd
ddx create feature:spec --name git_hooks
ddx create component:design --name auth_service

# Scoped continuation
ddx continue feature:spec --name git_hooks

# Scoped checking with architectural requirements
ddx check feature:spec --name git_hooks
ddx check feature:spec --name redis_caching --require-context-update product:sdd

# Listing
ddx list                    # Show all scopes
ddx list product            # Show product document types
ddx list features           # Show all feature instances
ddx list features --status  # Show feature completion status

# Architectural marking
ddx create feature:spec --name redis_caching --architectural
```

**Scope Parsing Logic:**
```typescript
function parseDocumentType(input: string, defaultScope: string = 'product'): ParsedType {
  if (input.includes(':')) {
    const [scope, docType] = input.split(':');
    return { scope, docType };
  }
  return { scope: defaultScope, docType: input };
}
```

**Boundaries:** No business logic; purely routing, validation, and output formatting. Delegates all scope resolution to Scope Resolution Engine.

---

#### Interactive REPL Mode (`src/modes/interactive-cli.ts`)
**Responsibilities:**
- Maintain session state including current scope and feature context
- Allow scope switching within session
- Provide scope-aware command completion

**Enhanced Session State:**
```typescript
interface REPLSession {
  currentScope: string;           // Current active scope (product/feature/component)
  currentFeatureName?: string;    // If scope=feature, which feature?
  conversationId: string;
  documentType: string;
}
```

**New REPL Commands:**
```
ddx> scope feature git_hooks    # Set context to feature:git_hooks
ddx> create spec                # Creates feature:spec for git_hooks
ddx> scope product              # Switch to product scope
ddx> continue sdd               # Continue product:sdd
ddx> check context              # Check all context refs for current doc
```

**Boundaries:** Session lifecycle and state management only; delegates operations to services.

---

#### Web Interface (`src/server/` + `web/`)

**Backend Changes (`src/server/api-routes.ts`):**
- Add scope awareness to all endpoints
- New endpoints for scope management

**New/Updated API Endpoints:**
```
GET /api/scopes
  → Returns list of all configured scopes

GET /api/scopes/:scope/documents
  → Returns document types for a scope

GET /api/scopes/:scope/instances
  → For parameterized scopes (feature), returns instances (git_hooks, watch_mode)

POST /api/scopes/:scope/documents/:type/create
  → Body: { params: { feature_name: "git_hooks" }, architectural: false }

GET /api/scopes/:scope/documents/:type
  → Query: ?params[feature_name]=git_hooks

POST /api/scopes/:scope/documents/:type/check
  → Returns consistency check including architectural drift analysis
```

**Frontend Changes (`web/src/components/`):**

**New Component: `ScopeSelector.tsx`**
- Dropdown to select scope (product/feature/component)
- If feature scope selected, show feature name input or existing feature selector
- Cascading dropdown: Scope → Document Type → Feature Instance (if applicable)

**Updated Component: `DocumentPreview.tsx`**
- Show scope breadcrumb (e.g., "product > sdd" or "feature > git_hooks > spec")
- Display context references with links
- Highlight architectural significance flags

**New Component: `ArchitecturalDriftReport.tsx`**
- Visual display of detected architectural changes
- Severity indicator (low/medium/high)
- Recommendations for SDD updates
- Button to "Update Product SDD" (launches SDD continuation workflow)

**Layout Enhancement:**
```
┌─────────────────────────────────────────────────────────┐
│ DDX - Document Dependency Exchange                      │
│ [Scope: feature ▼] [Feature: git_hooks ▼] [Check]      │
├──────────────────┬──────────────────────────────────────┤
│                  │  Breadcrumb: feature > git_hooks >   │
│  Chat Panel      │              spec                    │
│                  │  Context Refs: product/prd,          │
│  [Messages...]   │                product/sdd           │
│                  ├──────────────────────────────────────┤
│  User: Design    │  # Feature Specification: Git Hooks  │
│  the git hooks   │                                      │
│  integration     │  ## Overview                         │
│                  │  [Live markdown content]             │
│  AI: Based on    │                                      │
│  the product     │  [Updates as AI generates]           │
│  SDD, I'll...    │                                      │
│                  ├──────────────────────────────────────┤
│  [Input field]   │  ⚠ Architectural Drift Detected:     │
│  [Send]          │  - New async workflow                │
│                  │  - New filesystem integration        │
│                  │  Recommendation: Update product/sdd  │
│                  │  [Update SDD Button]                 │
└──────────────────┴──────────────────────────────────────┘
```

**Boundaries:** Backend provides REST/WebSocket API with scope parameters; frontend manages scope selection UX.

---

#### MCP Server Mode (`src/modes/mcp-server.ts`)

**Updated MCP Tools:**

**`ddx_create_document`**
```json
{
  "name": "ddx_create_document",
  "inputSchema": {
    "type": "object",
    "properties": {
      "scope": {"type": "string", "description": "Scope (product/feature/component)"},
      "documentType": {"type": "string"},
      "params": {"type": "object", "description": "Parameters like {feature_name: 'git_hooks'}"},
      "architectural": {"type": "boolean", "description": "Mark as architecturally significant"}
    },
    "required": ["documentType"]
  }
}
```

**`ddx_check_consistency`** (enhanced)
```json
{
  "name": "ddx_check_consistency",
  "inputSchema": {
    "properties": {
      "scope": {"type": "string"},
      "documentType": {"type": "string"},
      "params": {"type": "object"},
      "requireContextUpdate": {"type": "boolean"}
    }
  }
}
```

**New Tool: `ddx_list_features`**
```json
{
  "name": "ddx_list_features",
  "description": "List all feature instances and their document status",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

**Updated MCP Resources:**
```typescript
// Scoped resources
{
  uri: "ddx://product/sdd",
  name: "Product System Design Document",
  mimeType: "text/markdown"
}
{
  uri: "ddx://feature/git_hooks/spec",
  name: "Git Hooks Feature Specification",
  mimeType: "text/markdown"
}
```

**Boundaries:** Stdio-based MCP protocol; all scope resolution delegated to Scope Resolution Engine.

---

### 2. Service Layer

#### Scope Resolution Engine (`src/services/scope-resolution.ts`) **[NEW]**

**Responsibilities:**
- Parse and validate scope:doc_type syntax
- Resolve parameterized paths (e.g., `{feature_name}`)
- Build scoped dependency graphs (within-scope and cross-scope)
- Load context references from other scopes
- Validate scope and document type existence

**Key Methods:**

```typescript
class ScopeResolutionEngine {
  /**
   * Parse scoped document type reference
   * "feature:spec" → { scope: "feature", docType: "spec" }
   * "prd" → { scope: "product", docType: "prd" } (default scope)
   */
  parseScopedType(input: string): ScopedDocType

  /**
   * Get document config with parameter substitution
   * scope: "feature", docType: "spec", params: {feature_name: "git_hooks"}
   * → output: "sotdocs/features/git_hooks/spec.md"
   */
  getDocumentConfig(scope: string, docType: string, params: Params): ResolvedDocConfig

  /**
   * Resolve all context references for a document
   * Returns list of { scope, docType, path, content } for each context ref
   */
  resolveContextReferences(scope: string, docType: string, params: Params): ContextDoc[]

  /**
   * Build dependency graph including cross-scope context refs
   * Nodes: scoped doc types (product:prd, feature:spec)
   * Edges: upstream/downstream (solid) + context_refs (dashed)
   */
  buildDependencyGraph(): DependencyGraph

  /**
   * List all instances of a parameterized scope
   * scope: "feature" → ["git_hooks", "watch_mode", "web_ui"]
   */
  listScopeInstances(scope: string): string[]

  /**
   * Validate that required parameters are provided
   */
  validateParams(scope: string, docType: string, params: Params): ValidationResult
}
```

**Graph Structure:**
```typescript
interface DependencyGraph {
  nodes: Map<string, GraphNode>;  // Key: "scope:docType" or "scope:docType:instance"
  edges: Edge[];
}

interface GraphNode {
  id: string;                // "feature:spec:git_hooks"
  scope: string;
  docType: string;
  params?: Params;
  config: DocumentConfig;
}

interface Edge {
  from: string;              // Source node ID
  to: string;                // Target node ID
  type: 'upstream' | 'downstream' | 'context';
  description?: string;
}
```

**Example Graph:**
```
product:opportunity_brief
    ↓ (downstream)
product:one_pager
    ↓
product:prd
    ↓
product:sdd ←┐
    ↑        │ (context ref)
    │        │
    └────────┤
             │
feature:opportunity:git_hooks
             ↓
feature:spec:git_hooks ←──┘ (context ref)
             ↓
feature:implementation:git_hooks
```

**Boundaries:** Pure configuration and graph operations; no LLM interaction, no file I/O (delegates to File Manager).

---

#### Document Service (`src/services/document-service.ts`) **[UPDATED]**

**New Responsibilities:**
- Scope-aware document operations
- Delegate scope resolution to Scope Resolution Engine
- Handle parameterized document instances

**Updated Methods:**

```typescript
class DocumentService {
  constructor(
    private scopeResolver: ScopeResolutionEngine,
    private fileManager: FileManager
  ) {}

  /**
   * Load document with scope and parameter awareness
   */
  async loadDocument(scope: string, docType: string, params?: Params): Promise<string> {
    const config = this.scopeResolver.getDocumentConfig(scope, docType, params);
    return await this.fileManager.read(config.output);
  }

  /**
   * Load upstream documents (within same scope)
   */
  async loadUpstreamDocuments(scope: string, docType: string, params?: Params): Promise<Doc[]> {
    const config = this.scopeResolver.getDocumentConfig(scope, docType, params);
    const upstreamDocs: Doc[] = [];

    for (const upstreamType of config.upstream) {
      const upstreamConfig = this.scopeResolver.getDocumentConfig(scope, upstreamType, params);
      const content = await this.fileManager.read(upstreamConfig.output);
      upstreamDocs.push({ scope, type: upstreamType, content, role: 'upstream' });
    }

    return upstreamDocs;
  }

  /**
   * Load context documents (cross-scope references)
   */
  async loadContextDocuments(scope: string, docType: string, params?: Params): Promise<Doc[]> {
    const contextRefs = this.scopeResolver.resolveContextReferences(scope, docType, params);
    const contextDocs: Doc[] = [];

    for (const ref of contextRefs) {
      const content = await this.fileManager.read(ref.path);
      contextDocs.push({
        scope: ref.scope,
        type: ref.docType,
        content,
        role: 'context',
        description: ref.description
      });
    }

    return contextDocs;
  }

  /**
   * Write document with scope and parameter substitution
   */
  async writeDocument(
    scope: string,
    docType: string,
    content: string,
    params?: Params
  ): Promise<string> {
    const config = this.scopeResolver.getDocumentConfig(scope, docType, params);
    await this.fileManager.ensureDirectory(path.dirname(config.output));
    await this.fileManager.write(config.output, content);
    return config.output;
  }

  /**
   * Check if document exists
   */
  async documentExists(scope: string, docType: string, params?: Params): Promise<boolean> {
    const config = this.scopeResolver.getDocumentConfig(scope, docType, params);
    return await this.fileManager.exists(config.output);
  }
}
```

**Boundaries:** Document loading/writing with scope awareness; delegates scope resolution; no LLM interaction.

---

#### Conversation Service (`src/services/conversation-service.ts`) **[UPDATED]**

**Enhanced Responsibilities:**
- Build prompts with upstream AND context documents
- Distinguish between upstream (authoritative) and context (reference) in prompts
- Include scope metadata in conversation state

**Updated Methods:**

```typescript
class ConversationService {
  /**
   * Build system prompt with upstream + context documents
   */
  async buildSystemPrompt(
    scope: string,
    docType: string,
    params?: Params
  ): Promise<string> {
    const config = this.scopeResolver.getDocumentConfig(scope, docType, params);
    const template = await this.fileManager.read(config.template);
    const promptInstructions = await this.fileManager.read(config.prompt);

    // Load upstream docs (authoritative within scope)
    const upstreamDocs = await this.documentService.loadUpstreamDocuments(scope, docType, params);

    // Load context docs (reference from other scopes)
    const contextDocs = await this.documentService.loadContextDocuments(scope, docType, params);

    let systemPrompt = `${promptInstructions}\n\n`;
    systemPrompt += `Document Template:\n${template}\n\n`;

    if (upstreamDocs.length > 0) {
      systemPrompt += `## Upstream Documents (Authoritative)\n`;
      systemPrompt += `These documents are the direct inputs for this document. Ensure alignment.\n\n`;
      for (const doc of upstreamDocs) {
        systemPrompt += `### ${doc.scope}:${doc.type}\n${doc.content}\n\n`;
      }
    }

    if (contextDocs.length > 0) {
      systemPrompt += `## Context Documents (Reference)\n`;
      systemPrompt += `These documents provide context from other scopes. Ensure consistency but do not treat as direct requirements. `;
      systemPrompt += `If your design requires changes to these documents (especially product:sdd), note explicitly.\n\n`;
      for (const doc of contextDocs) {
        systemPrompt += `### ${doc.scope}:${doc.type}`;
        if (doc.description) systemPrompt += ` - ${doc.description}`;
        systemPrompt += `\n${doc.content}\n\n`;
      }
    }

    return systemPrompt;
  }

  /**
   * Save conversation state with scope metadata
   */
  async saveConversationState(
    conversationId: string,
    scope: string,
    docType: string,
    messages: Message[],
    params?: Params,
    metadata?: ConversationMetadata
  ): Promise<void> {
    const state: ConversationState = {
      conversationId,
      scope,
      docType,
      params,
      messages,
      metadata: {
        ...metadata,
        architectural: metadata?.architectural || false,
        createdAt: metadata?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    await this.stateManager.save(conversationId, state);
  }
}
```

**Boundaries:** Prompt construction and conversation orchestration; no direct file I/O or scope resolution.

---

#### Consistency Service (`src/services/consistency-service.ts`) **[UPDATED]**

**Major Enhancements:**
- Check upstream dependencies (within scope)
- Check context references (cross-scope) with architectural drift detection
- Determine if feature is architecturally significant
- Return structured report with recommendations

**New Methods:**

```typescript
class ConsistencyService {
  /**
   * Comprehensive consistency check with architectural drift analysis
   */
  async checkConsistency(
    scope: string,
    docType: string,
    params?: Params,
    options?: CheckOptions
  ): Promise<ConsistencyReport> {
    const report: ConsistencyReport = {
      scope,
      docType,
      params,
      passed: true,
      upstreamChecks: [],
      contextChecks: [],
      architecturalDrift: null,
      timestamp: new Date().toISOString()
    };

    // 1. Check upstream dependencies (within scope)
    const upstreamChecks = await this.checkUpstreamDependencies(scope, docType, params);
    report.upstreamChecks = upstreamChecks;
    if (upstreamChecks.some(c => c.status === 'failed')) {
      report.passed = false;
    }

    // 2. Check context references (cross-scope)
    const contextChecks = await this.checkContextReferences(scope, docType, params);
    report.contextChecks = contextChecks;

    // 3. Detect architectural drift for SDD context refs
    const isArchitecturalFeature = await this.isArchitecturallySignificant(scope, docType, params);

    for (const check of contextChecks) {
      if (check.targetDocType === 'sdd' && check.targetScope === 'product') {
        const drift = await this.detectArchitecturalDrift(
          scope, docType, params,
          check.targetScope, check.targetDocType
        );
        report.architecturalDrift = drift;

        if (drift.detected) {
          const requireUpdate = options?.requireContextUpdate || isArchitecturalFeature;

          if (requireUpdate) {
            check.status = 'failed';
            check.message = 'Architectural changes detected. Product SDD must be updated.';
            report.passed = false;
          } else {
            check.status = 'warning';
            check.message = 'Architectural drift detected. Consider updating product SDD.';
            // Don't fail the check in default mode
          }
        }
      }
    }

    return report;
  }

  /**
   * Detect architectural drift using LLM analysis
   */
  async detectArchitecturalDrift(
    sourceScope: string,
    sourceType: string,
    sourceParams: Params | undefined,
    targetScope: string,
    targetType: string
  ): Promise<ArchitecturalDrift> {
    const sourceDoc = await this.documentService.loadDocument(sourceScope, sourceType, sourceParams);
    const targetDoc = await this.documentService.loadDocument(targetScope, targetType);

    const prompt = this.buildArchitecturalDriftPrompt(sourceDoc, targetDoc);
    const response = await this.llmClient.sendMessage(prompt);

    // Parse JSON response from LLM
    const drift: ArchitecturalDrift = JSON.parse(response);
    return drift;
  }

  /**
   * Build LLM prompt for architectural drift detection
   */
  private buildArchitecturalDriftPrompt(featureDoc: string, sddDoc: string): string {
    return `You are analyzing whether a feature specification introduces architectural changes
that should be documented in the System Design Document (SDD).

Feature Document:
${featureDoc}

Current System Design Document:
${sddDoc}

Analyze if this feature introduces any of the following architectural changes:
1. New service/component or module boundary changes
2. New data model or storage pattern
3. New async workflows (queues, events, pub/sub)
4. Auth/permissions/security model changes
5. Performance/scalability assumption changes
6. New external integrations or compliance constraints

Respond in JSON format:
{
  "detected": true/false,
  "changes": ["list of detected architectural changes"],
  "recommendation": "specific recommendation for updating SDD sections",
  "severity": "low/medium/high",
  "sdd_sections_affected": ["Component Details", "Data Model & Storage"]
}`;
  }

  /**
   * Check if feature is marked as architecturally significant
   */
  async isArchitecturallySignificant(
    scope: string,
    docType: string,
    params?: Params
  ): Promise<boolean> {
    // Check document frontmatter
    const docExists = await this.documentService.documentExists(scope, docType, params);
    if (docExists) {
      const content = await this.documentService.loadDocument(scope, docType, params);
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        if (frontmatter.includes('architectural_significance: true')) {
          return true;
        }
      }
    }

    // Check conversation state for CLI flag
    const conversationId = this.buildConversationId(scope, docType, params);
    const state = await this.stateManager.load(conversationId);
    if (state?.metadata?.architectural === true) {
      return true;
    }

    return false;
  }

  /**
   * Check upstream dependencies (within scope)
   */
  private async checkUpstreamDependencies(
    scope: string,
    docType: string,
    params?: Params
  ): Promise<CheckResult[]> {
    const config = this.scopeResolver.getDocumentConfig(scope, docType, params);
    const currentDoc = await this.documentService.loadDocument(scope, docType, params);
    const results: CheckResult[] = [];

    for (const upstreamType of config.upstream) {
      const upstreamDoc = await this.documentService.loadDocument(scope, upstreamType, params);
      const consistency = await this.checkDocumentConsistency(currentDoc, upstreamDoc);

      results.push({
        targetScope: scope,
        targetDocType: upstreamType,
        status: consistency.consistent ? 'passed' : 'failed',
        message: consistency.message,
        issues: consistency.issues
      });
    }

    return results;
  }

  /**
   * Check context references (cross-scope)
   */
  private async checkContextReferences(
    scope: string,
    docType: string,
    params?: Params
  ): Promise<CheckResult[]> {
    const contextRefs = this.scopeResolver.resolveContextReferences(scope, docType, params);
    const currentDoc = await this.documentService.loadDocument(scope, docType, params);
    const results: CheckResult[] = [];

    for (const ref of contextRefs) {
      const contextDoc = await this.fileManager.read(ref.path);
      const consistency = await this.checkDocumentConsistency(currentDoc, contextDoc);

      results.push({
        targetScope: ref.scope,
        targetDocType: ref.docType,
        status: consistency.consistent ? 'passed' : 'warning',  // Context refs default to warning
        message: consistency.message,
        issues: consistency.issues
      });
    }

    return results;
  }

  /**
   * Use LLM to check semantic consistency between two documents
   */
  private async checkDocumentConsistency(
    currentDoc: string,
    referenceDoc: string
  ): Promise<ConsistencyResult> {
    const prompt = `Compare these two documents for semantic consistency.

Current Document:
${currentDoc}

Reference Document:
${referenceDoc}

Identify any inconsistencies, conflicts, or misalignments.

Respond in JSON format:
{
  "consistent": true/false,
  "message": "Brief summary of consistency status",
  "issues": ["list of specific inconsistencies found"]
}`;

    const response = await this.llmClient.sendMessage(prompt);
    return JSON.parse(response);
  }
}

// Type Definitions

interface ConsistencyReport {
  scope: string;
  docType: string;
  params?: Params;
  passed: boolean;
  upstreamChecks: CheckResult[];
  contextChecks: CheckResult[];
  architecturalDrift: ArchitecturalDrift | null;
  timestamp: string;
}

interface CheckResult {
  targetScope: string;
  targetDocType: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  issues?: string[];
}

interface ArchitecturalDrift {
  detected: boolean;
  changes: string[];
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
  sdd_sections_affected?: string[];
}

interface ConsistencyResult {
  consistent: boolean;
  message: string;
  issues: string[];
}

interface CheckOptions {
  requireContextUpdate?: boolean;
  strictMode?: boolean;
}
```

**Boundaries:** Consistency checking and architectural drift detection; orchestrates LLM calls but doesn't manage conversation state.

---

### 3. Infrastructure Layer

#### File Manager (`src/file-manager.ts`) **[UPDATED]**

**New Responsibilities:**
- Scope-aware file operations
- List feature instances by inspecting filesystem
- Parameter path substitution

**New Methods:**

```typescript
class FileManager {
  /**
   * List all instances of a parameterized scope
   * Example: listScopeInstances("features", "{feature_name}")
   * Scans sotdocs/features/ and returns ["git_hooks", "watch_mode", "web_ui"]
   */
  async listScopeInstances(basePath: string, paramName: string): Promise<string[]> {
    const pattern = basePath.replace(`{${paramName}}`, '*');
    const dirs = await this.listDirectories(pattern);
    return dirs.map(dir => path.basename(dir));
  }

  /**
   * Substitute parameters in path template
   * Template: "sotdocs/features/{feature_name}/spec.md"
   * Params: {feature_name: "git_hooks"}
   * Result: "sotdocs/features/git_hooks/spec.md"
   */
  substituteParams(template: string, params: Params): string {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`{${key}}`, value);
    }
    return result;
  }

  /**
   * Ensure directory exists (create if not)
   * Handles nested scope directories
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * List directories matching pattern
   */
  private async listDirectories(pattern: string): Promise<string[]> {
    const files = await glob(pattern);
    const dirs: string[] = [];
    for (const file of files) {
      const stat = await fs.stat(file);
      if (stat.isDirectory()) {
        dirs.push(file);
      }
    }
    return dirs;
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
```

**Boundaries:** Pure file system operations; no business logic.

---

#### State Manager (`src/state-manager.ts`) **[UPDATED]**

**Enhanced State Schema:**

```typescript
interface ConversationState {
  conversationId: string;
  scope: string;
  docType: string;
  params?: Params;
  messages: Message[];
  metadata: ConversationMetadata;
}

interface ConversationMetadata {
  architectural: boolean;          // Is this feature architecturally significant?
  createdAt: string;
  updatedAt: string;
  status: 'in_progress' | 'completed';
  checkResults?: ConsistencyReport;  // Last check results
}
```

**Conversation ID Format:**
- Old: `create_prd_2026-02-28`
- New: `create_product_prd_2026-02-28` or `create_feature_spec_git_hooks_2026-02-28`

**Boundaries:** State persistence with scope metadata; no conversation logic.

---

## Data Model & Storage

### Updated Configuration Schema (`ddx.config.yaml`)

```yaml
# DDX Configuration v2.0

default_scope: product  # Fallback when scope not specified

scopes:
  product:
    description: "Product-level strategic documents"
    documents:
      opportunity_brief:
        name: "Opportunity Brief"
        template: "templates/product/opportunity_brief_template.md"
        prompt: "prompts/product/opportunity_brief_prompt.md"
        output: "sotdocs/product/opportunity_brief.md"
        upstream: []
        downstream: ["one_pager"]

      one_pager:
        name: "Product One-Pager"
        template: "templates/product/one_pager_template.md"
        prompt: "prompts/product/one_pager_prompt.md"
        output: "sotdocs/product/one_pager.md"
        upstream: ["opportunity_brief"]
        downstream: ["prd"]

      prd:
        name: "Product Requirements Document"
        template: "templates/product/prd_template.md"
        prompt: "prompts/product/prd_prompt.md"
        output: "sotdocs/product/prd.md"
        upstream: ["one_pager"]
        downstream: ["sdd"]

      sdd:
        name: "System Design Document"
        template: "templates/product/sdd_template.md"
        prompt: "prompts/product/sdd_prompt.md"
        output: "sotdocs/product/sdd.md"
        upstream: ["prd"]
        downstream: []

  feature:
    description: "Feature-level tactical documents"
    documents:
      opportunity:
        name: "Feature Opportunity Brief"
        template: "templates/feature/opportunity_template.md"
        prompt: "prompts/feature/opportunity_prompt.md"
        output: "sotdocs/features/{feature_name}/opportunity.md"
        params: ["feature_name"]
        upstream: []
        downstream: ["spec"]
        context_refs:
          - scope: product
            docs: ["prd"]
            description: "Reference product requirements for context"

      spec:
        name: "Feature Specification"
        template: "templates/feature/spec_template.md"
        prompt: "prompts/feature/spec_prompt.md"
        output: "sotdocs/features/{feature_name}/spec.md"
        params: ["feature_name"]
        upstream: ["opportunity"]
        downstream: ["implementation"]
        context_refs:
          - scope: product
            docs: ["prd", "sdd"]
            description: "Ensure consistency with product architecture"

      implementation:
        name: "Implementation Plan"
        template: "templates/feature/implementation_template.md"
        prompt: "prompts/feature/implementation_prompt.md"
        output: "sotdocs/features/{feature_name}/implementation.md"
        params: ["feature_name"]
        upstream: ["spec"]
        downstream: []
        context_refs:
          - scope: product
            docs: ["sdd"]
            description: "Follow architectural patterns from product SDD"

  component:
    description: "Component-level detailed design documents"
    documents:
      design:
        name: "Component Design"
        template: "templates/component/design_template.md"
        prompt: "prompts/component/design_prompt.md"
        output: "sotdocs/components/{component_name}/design.md"
        params: ["component_name"]
        upstream: []
        downstream: []
        context_refs:
          - scope: product
            docs: ["sdd"]
            description: "Align with overall system architecture"

llm:
  provider: "anthropic"
  model: "claude-3-5-sonnet-20241022"
  max_tokens: 4096
  temperature: 0.7

workflow:
  auto_save: true
  auto_check: false  # Don't auto-check after each continue (user-triggered)
```

### Scoped Conversation State (`.ddx/state/{conversationId}.json`)

```json
{
  "conversationId": "create_feature_spec_git_hooks_2026-02-28",
  "scope": "feature",
  "docType": "spec",
  "params": {
    "feature_name": "git_hooks"
  },
  "messages": [
    {
      "role": "system",
      "content": "System prompt with template, upstream, and context..."
    },
    {
      "role": "user",
      "content": "Design git hooks integration"
    },
    {
      "role": "assistant",
      "content": "Based on the product SDD, I'll design a hook execution workflow..."
    }
  ],
  "metadata": {
    "architectural": true,
    "createdAt": "2026-02-28T10:00:00Z",
    "updatedAt": "2026-02-28T10:15:00Z",
    "status": "in_progress",
    "checkResults": {
      "timestamp": "2026-02-28T10:14:00Z",
      "passed": false,
      "architecturalDrift": {
        "detected": true,
        "severity": "medium",
        "changes": ["New async workflow", "New filesystem integration"]
      }
    }
  }
}
```

### Scoped Dependency Graph

**Multi-Scope Graph Example:**

```
Nodes:
  product:opportunity_brief
  product:one_pager
  product:prd
  product:sdd
  feature:opportunity:git_hooks
  feature:spec:git_hooks
  feature:implementation:git_hooks
  feature:spec:watch_mode

Edges:
  product:opportunity_brief → product:one_pager (downstream)
  product:one_pager → product:prd (downstream)
  product:prd → product:sdd (downstream)

  feature:opportunity:git_hooks → feature:spec:git_hooks (downstream)
  feature:spec:git_hooks → feature:implementation:git_hooks (downstream)

  product:prd ⇢ feature:opportunity:git_hooks (context ref, dashed)
  product:sdd ⇢ feature:spec:git_hooks (context ref, dashed)
  product:sdd ⇢ feature:implementation:git_hooks (context ref, dashed)

  product:sdd ⇢ feature:spec:watch_mode (context ref, dashed)
```

**Graph Properties:**
- **Within-scope edges:** Solid lines (upstream/downstream dependencies)
- **Cross-scope edges:** Dashed lines (context references)
- **Parameterized nodes:** Include parameter values in ID (e.g., `feature:spec:git_hooks`)

### File System Layout

```
project/
├── .ddx/
│   └── state/
│       ├── create_product_prd_2026-02-28.json
│       ├── create_feature_spec_git_hooks_2026-02-28.json
│       └── create_feature_spec_watch_mode_2026-02-28.json
│
├── sotdocs/
│   ├── product/
│   │   ├── opportunity_brief.md
│   │   ├── one_pager.md
│   │   ├── prd.md
│   │   └── sdd.md
│   ├── features/
│   │   ├── git_hooks/
│   │   │   ├── opportunity.md
│   │   │   ├── spec.md
│   │   │   └── implementation.md
│   │   ├── watch_mode/
│   │   │   ├── opportunity.md
│   │   │   └── spec.md
│   │   └── web_ui/
│   │       └── opportunity.md
│   └── components/
│       ├── auth_service/
│       │   └── design.md
│       └── api_gateway/
│           └── design.md
│
├── templates/
│   ├── product/
│   │   ├── opportunity_brief_template.md
│   │   ├── one_pager_template.md
│   │   ├── prd_template.md
│   │   └── sdd_template.md
│   ├── feature/
│   │   ├── opportunity_template.md
│   │   ├── spec_template.md
│   │   └── implementation_template.md
│   └── component/
│       └── design_template.md
│
├── prompts/
│   ├── product/
│   │   ├── opportunity_brief_prompt.md
│   │   ├── one_pager_prompt.md
│   │   ├── prd_prompt.md
│   │   └── sdd_prompt.md
│   ├── feature/
│   │   ├── opportunity_prompt.md
│   │   ├── spec_prompt.md
│   │   └── implementation_prompt.md
│   └── component/
│       └── design_prompt.md
│
└── ddx.config.yaml
```

## Integration Points

### Anthropic Claude API
*(Unchanged from SSD v1.0)*

- **Protocol:** HTTPS REST API
- **Authentication:** API key in `Authorization: Bearer {key}` header
- **Endpoints:** `POST https://api.anthropic.com/v1/messages`
- **Models:** `claude-3-5-sonnet-20241022` (default)
- **Usage:** Document creation, consistency checking, architectural drift detection
- **Failure Modes:** Retry with exponential backoff; graceful degradation

### Model Context Protocol (MCP)
*(Updated with scope awareness)*

- **Protocol:** stdio (JSON-RPC 2.0)
- **Tools:** All tools now accept `scope`, `params`, and `architectural` parameters
- **Resources:** URIs now scoped (e.g., `ddx://feature/git_hooks/spec`)
- **Client Integration:** Claude Desktop, VSCode extensions

### WebSocket (Web Mode)
*(Enhanced with scope events)*

- **Protocol:** ws://
- **New Events:**
  - `scope_changed`: Client switched scope/feature context
  - `architectural_drift_detected`: Real-time notification during document creation
  - `context_ref_updated`: A referenced document was modified
- **Failure Modes:** Connection lost → auto-reconnect with session recovery

## Operational Considerations

### Monitoring & Observability

**Enhanced Logging:**
- Log all scope resolution operations
- Log cross-scope context references
- Log architectural drift detections with severity
- Log parameterized path resolutions

**Additional Metrics:**
- Architectural drift detection rate by feature
- False positive rate for drift detection
- Average number of context references per document
- Feature completion rate (all docs created)
- Time to architectural significance resolution

**Dashboards (Future):**
- Scope dependency graph visualization
- Feature progress tracker
- Architectural drift heatmap by feature

### Error Handling Strategy

**Scope-Specific Errors:**
- Unknown scope → Clear error with available scopes listed
- Missing required parameter → Error with parameter name and example
- Invalid scope:doc_type syntax → Error with correct syntax example
- Context reference not found → Warning (allow creation to proceed)

**Architectural Drift Handling:**
- LLM fails to return valid JSON → Default to "warning" mode, log error
- SDD not found for context ref → Skip architectural check, warn user
- User ignores architectural drift warning → Log for future analysis

### Migration Strategy

**Phase 1: Backward Compatibility (v0.2.0)**

```typescript
// Config migration: Detect old format and auto-convert
function migrateConfig(oldConfig: OldConfig): NewConfig {
  return {
    default_scope: 'product',
    scopes: {
      product: {
        description: 'Product-level documents (migrated)',
        documents: oldConfig.documents
      }
    },
    llm: oldConfig.llm,
    workflow: oldConfig.workflow
  };
}
```

**Migration Command:**
```bash
ddx migrate config
# Converts ddx.config.yaml to v2.0 format
# Moves sotdocs/*.md to sotdocs/product/*.md
# Updates .ddx/state/*.json with scope metadata
```

**Phase 2: Gradual Adoption (v0.2.0 - v0.3.0)**
- Support both `ddx create prd` (defaults to `product:prd`)
- Support explicit `ddx create product:prd`
- Warn when using unscoped commands (with migration tips)

**Phase 3: Full Scoped Mode (v0.3.0+)**
- Require explicit scopes in commands (or rely on default_scope)
- Deprecate unscoped commands
- Full scope-aware tooling (visual graphs, feature dashboards)

### Performance Considerations

**Scope Resolution Caching:**
- Cache parsed scope configurations in memory
- Cache dependency graph (rebuild only on config change)
- Cache feature instance lists (invalidate on filesystem change)

**Context Loading Optimization:**
- Lazy-load context documents (only when needed)
- Cache context document content during single workflow session
- Parallelize loading of multiple context refs

**Architectural Drift Detection:**
- LLM call is expensive (~2-5s per check)
- Cache drift analysis results for 1 hour
- Allow users to skip drift detection with `--skip-drift-check` flag

**Scalability Targets:**
- 1000 documents: < 2s to build full dependency graph
- 100 features: < 1s to list all feature instances
- 10 context refs per doc: < 3s to load all context

## Risks & Tradeoffs

### Known Compromises

1. **Non-Deterministic Architectural Drift Detection**
   - **Risk:** LLM may produce inconsistent drift analysis; false positives/negatives
   - **Mitigation:**
     - Allow users to override with `--skip-drift-check` or `--require-context-update`
     - Log all drift detections for analysis and model tuning
     - Provide clear severity levels and recommendations
   - **Trigger:** If false positive rate > 30%, add rule-based pre-filters

2. **Context References Don't Enforce Updates**
   - **Risk:** Product SDD can be updated without notifying feature docs that reference it
   - **Mitigation:**
     - Future: Implement "reverse dependency" tracking
     - Notify feature owners when product SDD changes (via CLI warning or notification system)
     - Add `ddx check-all-features` command to batch-check all features against updated product docs
   - **Trigger:** When teams report frequent stale feature docs

3. **Parameterized Paths Increase Complexity**
   - **Risk:** Users may forget to provide `--name` parameter; error messages may be unclear
   - **Mitigation:**
     - Clear error messages: "Missing required parameter: feature_name. Use --name <feature_name>"
     - REPL mode prompts for missing parameters interactively
     - Web UI provides input fields for all required parameters
   - **Trigger:** User testing reveals confusion

4. **Multiple Scopes Increase Learning Curve**
   - **Risk:** New users may be confused by scope:doc_type syntax
   - **Mitigation:**
     - Provide clear onboarding documentation and examples
     - Default scope behavior for simple use cases
     - Interactive `ddx init` wizard that explains scopes
     - Gradual migration path from v0.1.x
   - **Trigger:** If user drop-off > 40% after seeing scoped commands

5. **Architectural Significance Requires Manual Marking**
   - **Risk:** Users forget to mark features with `--architectural`, leading to missed SDD updates
   - **Mitigation:**
     - AI automatically detects architectural changes (warning mode)
     - Prompt users during `ddx continue` if architectural patterns detected
     - Provide `ddx mark-architectural feature:spec --name git_hooks` command to retroactively mark
   - **Trigger:** When > 20% of features should have been marked architectural but weren't

6. **Cross-Scope Consistency Checks are Expensive**
   - **Risk:** Checking context refs requires multiple LLM calls; high latency and cost
   - **Mitigation:**
     - Cache consistency results for 1 hour
     - Allow incremental checks (only check what changed)
     - Provide `--quick` flag that skips context checks
     - Batch API requests when checking multiple context refs
   - **Trigger:** If consistency checks take > 30s or cost > $0.50 per check

7. **Single Product SDD May Become Unwieldy**
   - **Risk:** Large products with many features may have SDD that's too large (10,000+ lines)
   - **Mitigation:**
     - Encourage modular SDD structure with sections
     - Future: Support SDD "chapters" (sdd/architecture.md, sdd/data_model.md)
     - Allow features to reference specific SDD sections
   - **Trigger:** When product SDD > 5,000 lines

### Future Redesign Triggers

- **If** architectural drift false positive rate > 30% → Add rule-based pre-filtering before LLM analysis
- **If** feature count > 100 per product → Implement feature grouping or "epics" scope
- **If** consistency check latency > 30s → Implement caching layer and incremental checking
- **If** context references cause confusion → Add visual dependency graph in Web UI
- **If** multiple teams need product-level isolation → Introduce "workspace" or "project" scopes above product
- **If** parameterized scopes need > 2 parameters → Redesign to hierarchical scope nesting
- **If** users need custom scopes beyond product/feature/component → Make scope definitions fully pluggable

### Migration Risks

- **Breaking Changes:** Moving from flat to scoped structure requires file reorganization
  - **Mitigation:** Provide automated migration tool (`ddx migrate`)
- **State Incompatibility:** Old conversation state files missing scope metadata
  - **Mitigation:** Backward-compatible state loader; default to `product` scope for old states
- **User Confusion:** Existing users accustomed to `ddx create prd` may be confused by `product:prd`
  - **Mitigation:** Support both syntaxes; provide clear upgrade guide

### Scalability Ceiling

- **Current Design Supports:**
  - 1000 documents across all scopes
  - 100 features in parallel
  - 10 context refs per document
  - Dependency graph depth of 10 levels

- **Breaking Points:**
  - Feature count > 1000 → Directory listing becomes slow (need indexing)
  - Context refs > 20 per doc → Prompt size exceeds LLM context window
  - Scope depth > 3 levels (if nested scopes added) → Graph traversal complexity explodes
  - Concurrent users > 100 in web mode → Node.js process saturation

## Success Metrics

This v2.0 design will be considered successful if:

1. **Namespace Isolation:** 10+ features can be developed in parallel without collisions (measured by file conflicts)
2. **Architectural Discipline:** > 80% of architecturally significant features correctly update product SDD
3. **False Positive Rate:** Architectural drift detection false positive rate < 20%
4. **Migration Success:** > 90% of v0.1.x users successfully migrate to v0.2.0 within 2 weeks of release
5. **User Comprehension:** > 80% of new users understand scope:doc_type syntax without reading docs (measured by onboarding surveys)
6. **Performance:** Scope resolution and context loading < 1s for 90th percentile
7. **Consistency Check Accuracy:** > 85% of consistency check findings are deemed accurate by users (survey)

## Appendix: Complete Example Workflow

### Scenario: Adding Redis Caching Feature to Existing Product

**Starting State:**
```
sotdocs/product/
├── opportunity_brief.md (done)
├── one_pager.md (done)
├── prd.md (done)
└── sdd.md (done)
```

**Step 1: Create Feature Opportunity**
```bash
ddx create feature:opportunity --name redis_caching

# AI reads context: product/prd
# AI asks: What problem does Redis caching solve?
# User responds...
# AI creates: sotdocs/features/redis_caching/opportunity.md
```

**Step 2: Create Feature Spec (Marked as Architectural)**
```bash
ddx create feature:spec --name redis_caching --architectural

# AI reads:
#   - Upstream: features/redis_caching/opportunity.md
#   - Context: product/prd, product/sdd
# AI asks: What should be cached? What's the invalidation strategy?
# User responds...
# AI creates: sotdocs/features/redis_caching/spec.md
```

**Step 3: Check Consistency**
```bash
ddx check feature:spec --name redis_caching

# Output:
# ✓ Upstream check passed: feature/redis_caching/opportunity
# ✓ Context check passed: product/prd
# ✗ Context check failed: product/sdd
#
# ⚠ Architectural Drift Detected:
# Changes:
#   - New Redis service dependency (external integration)
#   - New distributed caching layer (new component)
#   - Cache invalidation strategy (new data flow)
#   - Network latency impact on read operations (performance)
#
# Recommendation: Update product/sdd sections:
#   - Architecture Overview: Add caching layer diagram
#   - Component Details: Document Redis client and cache manager
#   - Data Model & Storage: Describe cached entity schemas
#   - Integration Points: Document Redis connection and failure modes
#   - Operational Considerations: Add cache monitoring and alerting
#
# Severity: high
#
# This feature is marked as architecturally significant.
# Product SDD must be updated before proceeding.
#
# Exit code: 1 (failed)
```

**Step 4: Update Product SDD**
```bash
ddx continue product:sdd -m "Add distributed caching architecture with Redis. Reference features/redis_caching/spec.md for requirements."

# AI reads:
#   - Upstream: product/prd
#   - Feature context: features/redis_caching/spec.md (as additional context)
# AI updates product/sdd.md with:
#   - Updated architecture diagram showing caching layer
#   - New section: "Caching Strategy"
#   - Updated Component Details: Redis client, cache manager
#   - Updated Integration Points: Redis connection pooling, failure modes
#   - Updated Operational Considerations: Cache hit rate monitoring
```

**Step 5: Re-check Feature Spec**
```bash
ddx check feature:spec --name redis_caching

# Output:
# ✓ Upstream check passed: feature/redis_caching/opportunity
# ✓ Context check passed: product/prd
# ✓ Context check passed: product/sdd
# ✓ All checks passed
#
# Exit code: 0
```

**Step 6: Create Implementation Plan**
```bash
ddx create feature:implementation --name redis_caching

# AI reads:
#   - Upstream: features/redis_caching/spec.md
#   - Context: product/sdd (now includes caching architecture)
# AI creates detailed implementation steps
# AI creates: sotdocs/features/redis_caching/implementation.md
```

**Final State:**
```
sotdocs/
├── product/
│   ├── opportunity_brief.md
│   ├── one_pager.md
│   ├── prd.md
│   └── sdd.md (UPDATED with caching architecture)
└── features/
    └── redis_caching/
        ├── opportunity.md
        ├── spec.md (marked architectural)
        └── implementation.md
```

**Dependency Graph:**
```
product:opportunity_brief → product:one_pager → product:prd → product:sdd
                                                                    ↑
                                                                    | (context ref)
                                                                    |
feature:opportunity:redis_caching → feature:spec:redis_caching → feature:implementation:redis_caching
                                            ↑
                                            | (context ref)
                                            |
                                    product:prd
```

---

## Conclusion

This System Design Document v2.0 integrates multi-level documentation support into DDX's existing four-mode interaction architecture. The key innovation is the **Scope Resolution Engine**, which enables namespace isolation, cross-scope context references, and intelligent architectural drift detection. This design allows teams to scale from single-developer projects to complex multi-feature products while maintaining documentation consistency and architectural discipline.

The scoped architecture is backward-compatible, provides clear migration paths, and balances flexibility with usability. By making architectural significance detection optional but intelligent, the system adapts to both small iterative changes and major architectural features.
