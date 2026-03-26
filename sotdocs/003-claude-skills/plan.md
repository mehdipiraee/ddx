# DDX v2 Claude Skills: Implementation Plan

## Overview

This plan establishes the build sequence for DDX v2 Claude Skills. The work is organized in 9 phases, with Phase 3-8 handling individual skill implementation and Phase 9 dedicated to integration testing.

**Critical Path**: YAML descriptions (Phase 2) must be completed before any skill can be tested. These descriptions drive triggering behavior and are non-negotiable for achieving >90% trigger accuracy.

## Phase 1: Skill Folder Structure & Templates

**Goal**: Create the six skill folders with a standard SKILL.md template

**Tasks**:
- [ ] Create folder: `ddx-mandate/`
- [ ] Create folder: `ddx-define/`
- [ ] Create folder: `ddx-design/`
- [ ] Create folder: `ddx-plan/`
- [ ] Create folder: `ddx-build/`
- [ ] Create folder: `ddx-derive/`
- [ ] Create template `SKILL.md` with YAML frontmatter + body structure
- [ ] Copy template to each skill folder

**Acceptance**: All 6 folders exist, each contains a SKILL.md file with valid YAML structure (name, description, triggers, examples required)

**Effort**: 30 minutes

---

## Phase 2: YAML Frontmatter for All 6 Skills

**Goal**: Write comprehensive, accurate YAML descriptions that drive triggering behavior

**Critical**: This phase determines >80% of trigger accuracy. Invest time in precise trigger phrases and negative triggers.

**Tasks**:

### 2.1: ddx-mandate YAML
- [ ] Write name, description (1-3 sentences)
- [ ] Define 10-12 trigger phrases (e.g., "set up project rules", "establish naming conventions")
- [ ] Define 4-5 negative triggers (e.g., "what are the current rules", "show me the mandate")
- [ ] Provide 2-3 input/output examples
- [ ] Specify API endpoint: `POST /api/v1/documents/mandate`
- [ ] Specify supported flags: `-f`, `-q`, `-d`, `-v`, `-n`
- [ ] List prerequisites: (none)
- [ ] List generated documents: ["mandate"]

### 2.2: ddx-define YAML
- [ ] Write description emphasizing scope detection ("if no spec exists, creates one; if one exists, refines it")
- [ ] Define triggers: "I want to add...", "we need to build...", "define the feature", "scope this out", etc. (12+ phrases)
- [ ] Negative triggers: "how does the dashboard work", "explain this feature", "design the database schema" (avoid >triggering on retrieval)
- [ ] Specify `scope_detection: true` attribute
- [ ] Prerequisites: ["mandate"] (suggested, not required)
- [ ] Examples: "I want to add dark mode to the dashboard" → capability definition with acceptance criteria

### 2.3: ddx-design YAML
- [ ] Description: technical solution (API, schema, architecture)
- [ ] Triggers: "design the API", "spec the database schema", "architect the system", "define the data model" (12+ phrases)
- [ ] Negative triggers: "what's the current architecture", "explain the database schema", "how does the API work" (avoid ddx-derive confusion)
- [ ] Prerequisites: ["mandate", "define"] (both required)
- [ ] Examples: "Design the API for the dark mode feature" → REST endpoints, schemas, error handling

### 2.4: ddx-plan YAML
- [ ] Description: break work into steps, milestones, dependencies
- [ ] Triggers: "break down the work", "create a plan", "what are the steps", "sequence the implementation", "plan the rollout" (12+ phrases)
- [ ] Negative triggers: "show me the plan", "what's the current plan", "are we on schedule" (retrieval, not creation)
- [ ] Prerequisites: ["mandate", "define", "design"] (all required for effective planning)
- [ ] Examples: "Break down the dark mode implementation into steps" → phases with sequencing

### 2.5: ddx-build YAML
- [ ] Description: implementation guides, code templates, step-by-step instructions
- [ ] Triggers: "build the feature", "implement the login", "start coding", "generate the template", "write the code" (12+ phrases)
- [ ] Negative triggers: "show me the code", "explain the implementation", "how does this work" (use ddx-derive for code explanation)
- [ ] Attribute: `prerequisite_check: true` (strict checking)
- [ ] Prerequisites: ["mandate", "define", "design"] (all required, can draft if missing)
- [ ] Examples: "Build the dark mode toggle component" → component code, state management, styling

### 2.6: ddx-derive YAML
- [ ] Description: reverse-engineer from existing code, extract patterns, document conventions
- [ ] Triggers: "document this code", "what's the architecture", "explain the current implementation", "extract the patterns", "how does this work" (12+ phrases)
- [ ] Negative triggers: "design the system", "build the feature", "what should we build" (avoid mixing with forward-design skills)
- [ ] Attribute: `code_aware: true` (reads from codebase)
- [ ] Prerequisites: (none)
- [ ] Examples: "Document the architecture of our auth system" → extracted patterns, middleware structure

**Acceptance**: All 6 YAML frontmatters complete, each with 10+ trigger phrases, 4+ negative triggers, valid YAML syntax

**Effort**: 2 hours (detail work)

---

## Phase 3: SKILL.md Instructions for ddx-mandate

**Goal**: Write step-by-step execution instructions for Claude

**Context**: This is the foundational skill with no prerequisites. It establishes project conventions.

**Tasks**:
- [ ] **Trigger Recognition**: Detect trigger phrases from Phase 2
- [ ] **Scope Extraction**: Parse user input to identify:
  - What convention is being established (naming, git, PR process, etc.)
  - Scope level (project-wide vs. team vs. component)
- [ ] **API Call**: Format and send request to `POST /api/v1/documents/mandate` with:
  - scope: extracted convention type
  - context: user input, detected intent
  - flags: parsed from natural language
- [ ] **Response Streaming**: Display document as it's generated
- [ ] **Completion**: Show file path, version, next steps ("Ready to define capabilities? Say yes...")
- [ ] **Error Handling**: Handle server unavailable, missing fields, API errors
- [ ] **Flag Parsing**: Detect `-f` (overwrite), `-q` (quiet), `-d` (draft), `-v` (verbose), `-n` (no commit)

**Acceptance**: Skill correctly invokes API, streams response, shows completion metadata, handles errors gracefully

**Effort**: 90 minutes

---

## Phase 4: SKILL.md Instructions for ddx-define (with Scope Detection Logic)

**Goal**: Write execution instructions with scope detection—the hardest part

**Context**: Define is the entry point for most workflows. It must detect whether to create a product spec or add a capability.

**Critical Logic**:
```
IF user says "I want to add dark mode"
  AND no define doc exists
  THEN: Create product spec with dark mode as first capability
  
IF user says "I want to add dark mode"
  AND define doc exists (product spec)
  THEN: Add dark mode as new capability, append to existing spec

IF user says "How does dark mode work" (explain pattern)
  AND code exists
  THEN: Don't invoke ddx-define, offer ddx-derive instead
```

**Tasks**:
- [ ] **Trigger Recognition**: Detect "I want to", "we need to build", "define the feature", etc.
- [ ] **Scope Detection** (critical):
  - Check if `define` document already exists
  - If no: parse for product name, capabilities, scope
  - If yes: parse for new capability, extract name/requirements
  - Build request body with detected scope
- [ ] **Negative Trigger Avoidance**:
  - "How does the dashboard work?" → Not a trigger (it's explanation)
  - "Explain this feature" → Offer ddx-derive if code exists
  - "Design the API" → Suggest ddx-design instead
- [ ] **Prerequisite Checking**:
  - Check for mandate doc (optional, warn if missing)
  - Can proceed without it, but suggest creating first
- [ ] **API Call**: Send to `POST /api/v1/documents/define` with:
  - scope: "product" or "capability"
  - scope_name: extracted feature/product name
  - context: full conversation history
- [ ] **Response Streaming**: Display generated spec as it arrives
- [ ] **Completion**: Show generated document, offer next skill ("Ready to design? Say yes for ddx-design...")
- [ ] **Error Handling**: Server errors, missing scope, ambiguous input

**Acceptance**: Skill correctly detects product vs. capability scope, invokes API with proper scope, avoids false triggers on explanation requests

**Effort**: 2 hours (most complex routing logic)

---

## Phase 5: SKILL.md Instructions for ddx-design

**Goal**: Write execution instructions for design phase

**Context**: Requires mandate + define prerequisites. Translates product spec into technical decisions.

**Tasks**:
- [ ] **Trigger Recognition**: Detect "design the API", "spec the database", "architect the system", etc.
- [ ] **Prerequisite Checking** (strict):
  - Check for mandate doc (required)
  - Check for define doc (required)
  - If missing, inform user and offer to create in draft mode
  - Show what's missing: "I need the product definition to design the solution"
- [ ] **Scope Extraction**: Parse which aspect to design:
  - "Design the API" → scope: "api"
  - "Spec the database" → scope: "database"
  - "Design the workflow" → scope: "workflow"
- [ ] **Context Assembly**: Gather define doc content as context for design
- [ ] **API Call**: Send to `POST /api/v1/documents/design` with:
  - scope: extracted aspect (api, database, workflow, etc.)
  - upstream_docs: mandate + define content
  - context: conversation history
- [ ] **Response Streaming**: Display design document progressively
- [ ] **Completion**: Show file path, reference upstream docs, offer ddx-plan
- [ ] **Error Handling**: Missing prerequisites, server errors, invalid scope

**Acceptance**: Skill checks prerequisites, gathers context, invokes API correctly, handles missing docs gracefully

**Effort**: 90 minutes

---

## Phase 6: SKILL.md Instructions for ddx-plan

**Goal**: Write execution instructions for planning phase

**Context**: Requires mandate + define + design. Creates implementation roadmap.

**Tasks**:
- [ ] **Trigger Recognition**: Detect "break down the work", "create a plan", "what are the steps", "sequence the implementation", etc.
- [ ] **Prerequisite Checking** (strict):
  - Check for mandate, define, design (all 3 required)
  - If any missing, inform and offer draft mode
  - Explain why each is needed: "I need the design to plan the build"
- [ ] **Scope Extraction**: What aspect to plan:
  - "Plan the rollout" → scope: "rollout"
  - "Break down the work" → scope: "tasks" or "full_breakdown"
- [ ] **Context Assembly**: Gather all upstream docs for planning context
- [ ] **API Call**: Send to `POST /api/v1/documents/plan` with:
  - scope: extracted planning type
  - upstream_docs: mandate + define + design content
  - context: conversation
- [ ] **Response Streaming**: Display plan as it's generated
- [ ] **Completion**: Show phases, milestones, dependencies; offer ddx-build next
- [ ] **Error Handling**: Missing prerequisites, server errors

**Acceptance**: Skill checks all 3 prerequisites, gathers upstream context, invokes API

**Effort**: 90 minutes

---

## Phase 7: SKILL.md Instructions for ddx-build (with Prerequisite Checking)

**Goal**: Write execution instructions for implementation phase

**Context**: Requires mandate + define + design + plan. Generates code templates and implementation guides.

**Critical**: Prerequisite checking is stricter here. Build requires full upstream context.

**Tasks**:
- [ ] **Trigger Recognition**: Detect "build the feature", "implement the login", "start coding", "write the code", etc.
- [ ] **Prerequisite Checking** (strict):
  - Check all 4 upstream docs: mandate, define, design, plan
  - If all exist: proceed to build
  - If some missing: inform user, offer draft mode ("I can build without the plan, but it won't be sequenced")
  - Show what's available: "I have the design but not the plan..."
- [ ] **Scope Extraction**: What component to build:
  - "Build the authentication" → scope: "authentication"
  - "Implement the API" → scope: "api"
- [ ] **Context Assembly**: Gather all 4 upstream docs + code structure
- [ ] **API Call**: Send to `POST /api/v1/documents/build` with:
  - scope: extracted component
  - upstream_docs: mandate + define + design + plan
  - context: conversation, code structure
  - flags: parsed from input
- [ ] **Response Streaming**: Display implementation guide progressively
- [ ] **Code Templates**: Include code snippets, imports, setup instructions
- [ ] **Completion**: Show generated guide, file path, link to design/plan for reference
- [ ] **Error Handling**: Missing prerequisites, server errors, code generation failures
- [ ] **Draft Mode**: If prerequisite missing, build with warning ("Building without the full plan—some sequencing may be missing")

**Acceptance**: Skill checks all prerequisites strictly, offers draft mode, generates implementation guide with code

**Effort**: 2 hours (complex prerequisite logic + code generation)

---

## Phase 8: SKILL.md Instructions for ddx-derive

**Goal**: Write execution instructions for reverse-engineering documentation from code

**Context**: No prerequisites. Operates on actual codebase (reads from filesystem).

**Tasks**:
- [ ] **Trigger Recognition**: Detect "document this code", "what's the architecture", "explain the current implementation", etc.
- [ ] **Code Detection**: Find and read relevant code:
  - If user mentions specific file/folder: read that
  - If user mentions "architecture": scan for structure patterns
  - If user mentions "conventions": scan codebase for patterns
- [ ] **Pattern Extraction**: Identify:
  - Folder structure and organization
  - Naming conventions observed
  - Architecture patterns (MVC, microservices, etc.)
  - Key components and their relationships
  - Middleware, interceptors, utilities
- [ ] **Scope Extraction**: What to document:
  - "Document this code" → scope: "full_codebase"
  - "What's the architecture" → scope: "architecture"
  - "What conventions are we using" → scope: "conventions"
- [ ] **API Call**: Send to `POST /api/v1/documents/derive` with:
  - scope: extracted aspect
  - code_content: relevant source code or structure
  - context: conversation
  - codebase_path: where to find code
- [ ] **Response Streaming**: Display derived documentation
- [ ] **Completion**: Show file path, extracted patterns, reverse-engineered architecture
- [ ] **Error Handling**: Code not found, parsing errors, inaccessible directories

**Acceptance**: Skill reads code, extracts patterns, invokes API, generates derive documentation

**Effort**: 2 hours (file I/O, pattern recognition)

---

## Phase 9: Testing & Integration

**Goal**: Test all 6 skills for triggering accuracy, API integration, and CLI visibility

**Tasks**:

### 9.1: Trigger Accuracy Testing
- [ ] Test ddx-mandate with 10+ queries (trigger accuracy benchmark)
- [ ] Test ddx-define with 10+ queries (including scope detection)
- [ ] Test ddx-design with 10+ queries (including prerequisite checking)
- [ ] Test ddx-plan with 10+ queries
- [ ] Test ddx-build with 10+ queries (including draft mode)
- [ ] Test ddx-derive with 10+ queries
- [ ] Target: 90%+ accuracy on each skill

### 9.2: API Integration Testing
- [ ] Each skill calls the correct endpoint
- [ ] Request bodies are well-formed
- [ ] Streaming responses display progressively
- [ ] Error handling works (server unavailable, bad response)

### 9.3: CLI Integration Testing
- [ ] Documents created via skills appear in `ddx list`
- [ ] Documents created via skills can be viewed with `ddx show`
- [ ] Skill-created documents have correct structure
- [ ] Metadata (creator: Claude Skill, timestamp) present

### 9.4: Flag Testing
- [ ] `-f` flag works (force overwrite)
- [ ] `-q` flag works (quiet, no output)
- [ ] `-d` flag works (draft, don't save)
- [ ] `-v` flag works (verbose output)
- [ ] `-n` flag works (no commit)
- [ ] Conflicting flags detected and reported

### 9.5: Natural Language Routing Testing
- [ ] "Build me a dashboard" → routes to ddx-define (no spec exists)
- [ ] "Implement the login" → routes to ddx-build (spec exists)
- [ ] "Document our git workflow" → routes to ddx-mandate
- [ ] "Explain this codebase" → routes to ddx-derive
- [ ] "Design the API" → routes to ddx-design, checks prerequisites

### 9.6: Edge Case Testing
- [ ] User says "build" but means "define" → skill detects and clarifies
- [ ] Multiple skills could trigger → skill asks which one user means
- [ ] Ambiguous input → skill asks clarifying questions
- [ ] Server unavailable → graceful error + draft mode offer

**Acceptance**: 90%+ trigger accuracy, all API calls successful, documents visible in CLI, flags work, routing logic sound

**Effort**: 4 hours (comprehensive testing)

---

## Timeline Summary

| Phase | Task | Duration | Cumulative |
|-------|------|----------|------------|
| 1 | Folder structure + template | 30 min | 30 min |
| 2 | YAML descriptions (all 6) | 2 hours | 2.5 hours |
| 3 | ddx-mandate SKILL.md | 90 min | 4 hours |
| 4 | ddx-define SKILL.md | 2 hours | 6 hours |
| 5 | ddx-design SKILL.md | 90 min | 7.5 hours |
| 6 | ddx-plan SKILL.md | 90 min | 9 hours |
| 7 | ddx-build SKILL.md | 2 hours | 11 hours |
| 8 | ddx-derive SKILL.md | 2 hours | 13 hours |
| 9 | Testing + integration | 4 hours | 17 hours |

**Total Effort**: ~17 hours (2-3 days with focused work)

---

## Critical Path Dependencies

```
Phase 1 (folders)
  ↓
Phase 2 (YAML) ← CRITICAL: blocks all testing
  ↓
Phase 3-8 (individual skills, can be parallelized)
  ↓
Phase 9 (testing)
```

Phase 2 is the critical path. Invest time in precise trigger phrases and negative triggers to achieve >90% accuracy.

---

## Success Criteria

- [ ] All 6 skill folders created
- [ ] All 6 YAML frontmatters complete and valid
- [ ] All 6 SKILL.md files written with execution instructions
- [ ] Trigger accuracy > 90% on test queries
- [ ] Skill-created documents visible in CLI
- [ ] API calls successful and streaming works
- [ ] Prerequisites checked correctly (define → design → plan → build chain)
- [ ] Natural language routing works (ambiguous queries routed correctly)
- [ ] Flag parsing detects all 6 flags
- [ ] Error handling graceful for server errors and missing prerequisites
