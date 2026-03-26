# DDX v2 Claude Skills: Technical Design

## Architecture Overview

### Skill Organization

```
003-claude-skills/
├── define.md                 (this document: what the capability does)
├── design.md                 (technical design)
├── plan.md                   (build order and tasks)
├── test.md                   (test cases and validation)
├── ddx-mandate/
│   └── SKILL.md             (skill instructions for Claude)
├── ddx-define/
│   └── SKILL.md
├── ddx-design/
│   └── SKILL.md
├── ddx-plan/
│   └── SKILL.md
├── ddx-build/
│   └── SKILL.md
└── ddx-derive/
    └── SKILL.md
```

Each skill folder contains:
- `SKILL.md`: The Claude skill definition with YAML frontmatter (metadata) and markdown body (execution instructions)
- The YAML frontmatter defines triggering behavior, routing logic, and metadata
- The markdown body contains step-by-step instructions for Claude on how to execute the workflow

### YAML Frontmatter Structure

Every SKILL.md file follows this structure:

```yaml
---
name: ddx-<phase>
description: |
  <1-3 sentence overview of what the skill does>
triggers:
  - "set up project rules"
  - "establish naming conventions"
  - "define team practices"
  - "document standards"
negative_triggers:
  - "what are the current rules"        (retrieval, not creation)
  - "show me the mandate"               (retrieval, not creation)
  - "are we following conventions"      (audit, not creation)
examples:
  - input: "Let's document our git workflow"
    output: "Created mandate document with git conventions"
  - input: "Set up coding standards for this project"
    output: "Generated mandate with style guides and naming rules"
api_endpoint: "POST /api/v1/documents/mandate"
supports_flags: ["-f", "-q", "-d", "-v", "-n"]
prerequisite_documents: []
generated_documents: ["mandate"]
---
```

## Individual Skill YAML Descriptions

### ddx-mandate

```yaml
---
name: ddx-mandate
description: |
  Establish or update project-level rules, conventions, and team agreements.
  Captures coding standards, naming conventions, git workflows, PR processes,
  documentation requirements, and other team practices. Activates when users
  discuss setting up standards or defining how the team works.
triggers:
  - "set up project rules"
  - "establish naming conventions"
  - "define team practices"
  - "document our git workflow"
  - "create coding standards"
  - "what should our conventions be"
  - "how should we name things"
  - "establish team agreements"
  - "define the project standards"
  - "document team practices"
negative_triggers:
  - "what are the current rules"        (ddx-derive if code exists, retrieval else)
  - "show me the mandate"               (retrieval, not creation)
  - "are we following conventions"      (audit question, no generation)
  - "build the feature"                 (use ddx-build, not mandate)
examples:
  - input: "Let's document our git workflow and code review process"
    output: "Generated mandate with git conventions, PR templates, and review criteria"
  - input: "Set up naming standards for our React components"
    output: "Created mandate with component naming conventions and folder structure"
api_endpoint: "POST /api/v1/documents/mandate"
supports_flags: ["-f", "-q", "-d", "-v", "-n"]
prerequisite_documents: []
generated_documents: ["mandate"]
---
```

### ddx-define

```yaml
---
name: ddx-define
description: |
  Capture product or capability-level scope, requirements, and acceptance criteria.
  Triggered when users discuss what to build, describe features, or scope work.
  Performs scope detection: if no product spec exists, creates one; if one exists,
  adds or refines individual capability definitions. Prevents over-defining by
  detecting "tell me about" requests (use ddx-derive for existing code audit).
triggers:
  - "I want to add"
  - "we need to build"
  - "define the feature"
  - "what should the dashboard do"
  - "scope this out"
  - "what are the requirements"
  - "create a spec for"
  - "let's plan the feature"
  - "I want to implement"
  - "break down the epic"
  - "what needs to be built"
negative_triggers:
  - "how does the dashboard work"         (ddx-derive if code exists)
  - "explain this feature"                (retrieval/explanation, not creation)
  - "does the feature support"            (clarification question)
  - "design the database schema"          (use ddx-design, not ddx-define)
  - "create implementation steps"         (use ddx-plan, not ddx-define)
examples:
  - input: "I want to add dark mode to the dashboard"
    output: "Created capability definition: dark mode with theme switching, acceptance criteria"
  - input: "Scope out the login flow with MFA support"
    output: "Generated define doc: authentication requirements, MFA options, security criteria"
api_endpoint: "POST /api/v1/documents/define"
supports_flags: ["-f", "-q", "-d", "-v", "-n"]
prerequisite_documents: ["mandate"]
generated_documents: ["define"]
scope_detection: true
---
```

### ddx-design

```yaml
---
name: ddx-design
description: |
  Specify the technical solution—architecture, API contracts, database schema,
  component hierarchy, and implementation approach. Triggered when users discuss
  how to build something technically. Checks prerequisites: requires mandate
  (conventions) and define (scope). Does NOT trigger on retrieval queries about
  existing design or architecture questions about code—use ddx-derive for those.
triggers:
  - "design the API"
  - "spec the database schema"
  - "architect the system"
  - "design the component structure"
  - "what's the technical approach"
  - "define the data model"
  - "design the workflow"
  - "how should we structure this"
  - "design the integration"
  - "what's the implementation plan"
negative_triggers:
  - "what's the current architecture"     (ddx-derive for existing code)
  - "explain the database schema"         (retrieval/explanation)
  - "how does the API work"               (ddx-derive if code exists)
  - "create implementation steps"         (use ddx-plan, not ddx-design)
  - "build the feature"                   (use ddx-build)
examples:
  - input: "Design the API for the dark mode feature"
    output: "Generated design doc: REST endpoints, request/response schemas, error handling"
  - input: "Spec the database for the authentication system"
    output: "Created design: schema, indexes, relationships, migration strategy"
api_endpoint: "POST /api/v1/documents/design"
supports_flags: ["-f", "-q", "-d", "-v", "-n"]
prerequisite_documents: ["mandate", "define"]
generated_documents: ["design"]
---
```

### ddx-plan

```yaml
---
name: ddx-plan
description: |
  Break work into actionable steps, milestones, and dependencies. Triggered when
  users discuss implementation sequencing, roadmaps, or breaking down work.
  Requires upstream docs (define, design) to plan effectively. Distinguishes
  between "plan the implementation" (ddx-plan) and "show me the plan" (retrieval).
triggers:
  - "break down the work"
  - "create a plan"
  - "what are the steps"
  - "sequence the implementation"
  - "plan the rollout"
  - "what should we do first"
  - "establish milestones"
  - "identify dependencies"
  - "create a roadmap"
  - "plan the phases"
negative_triggers:
  - "show me the plan"                    (retrieval, not creation)
  - "what's the current plan"             (retrieval)
  - "are we on schedule"                  (status question)
  - "design the system"                   (use ddx-design, not ddx-plan)
  - "what should we build"                (use ddx-define)
examples:
  - input: "Break down the dark mode implementation into steps"
    output: "Generated plan: phase 1 UI layer, phase 2 state management, phase 3 persistence"
  - input: "What's the sequence to launch the auth system"
    output: "Created plan: database setup, API implementation, frontend integration, testing phases"
api_endpoint: "POST /api/v1/documents/plan"
supports_flags: ["-f", "-q", "-d", "-v", "-n"]
prerequisite_documents: ["mandate", "define", "design"]
generated_documents: ["plan"]
---
```

### ddx-build

```yaml
---
name: ddx-build
description: |
  Generate implementation guides, code templates, and step-by-step build instructions.
  Triggered when users request code, implementation, or templates. Checks prerequisites:
  requires mandate, define, and design. If prerequisites missing, offers to create them
  or proceeds in draft mode with warnings. Does NOT trigger on code retrieval or
  explanation queries—use ddx-derive for understanding existing code.
triggers:
  - "build the feature"
  - "implement the login"
  - "start coding"
  - "generate the template"
  - "write the code"
  - "create the component"
  - "let's start building"
  - "generate implementation guide"
  - "scaffold the project"
  - "implement the API"
negative_triggers:
  - "show me the code"                    (retrieval)
  - "explain the implementation"          (explanation, use ddx-derive for code)
  - "how does this work"                  (explanation)
  - "design the API"                      (use ddx-design, not ddx-build)
  - "what should we build"                (use ddx-define)
examples:
  - input: "Build the dark mode toggle component"
    output: "Generated guide with React component code, state management, styling approach"
  - input: "Implement the login API endpoint"
    output: "Created guide: endpoint structure, request validation, error handling, testing"
api_endpoint: "POST /api/v1/documents/build"
supports_flags: ["-f", "-q", "-d", "-v", "-n"]
prerequisite_documents: ["mandate", "define", "design"]
generated_documents: ["build"]
prerequisite_check: true
---
```

### ddx-derive

```yaml
---
name: ddx-derive
description: |
  Reverse-engineer documentation from existing code—extract patterns, infer architecture,
  document conventions observed in the codebase. Triggered when users ask to understand,
  explain, or audit existing code and systems. Operates on real code (reads from repo).
  Complements build-forward skills by documenting what exists.
triggers:
  - "document this code"
  - "what's the architecture"
  - "explain the current implementation"
  - "extract the patterns"
  - "document our existing system"
  - "how does this work"
  - "audit the codebase"
  - "reverse engineer the design"
  - "what conventions are we using"
  - "document the folder structure"
negative_triggers:
  - "design the system"                   (use ddx-design for new design)
  - "build the feature"                   (use ddx-build)
  - "what should we build"                (use ddx-define)
  - "create implementation steps"         (use ddx-plan for forward planning)
examples:
  - input: "Document the architecture of our auth system"
    output: "Generated doc: extracted patterns, middleware structure, session handling"
  - input: "What conventions are we following in the codebase"
    output: "Created doc: naming patterns, folder structure, import organization observed"
api_endpoint: "POST /api/v1/documents/derive"
supports_flags: ["-f", "-q", "-d", "-v", "-n"]
prerequisite_documents: []
generated_documents: ["derive"]
code_aware: true
---
```

## API Integration

### Server Endpoint

All skills call a unified endpoint:

```
POST /api/v1/documents/<skill>
```

Where `<skill>` is one of: mandate, define, design, plan, build, derive

### Request Body Structure

```json
{
  "skill": "define",
  "scope": "dark mode feature",
  "context": {
    "user_input": "I want to add dark mode to the dashboard",
    "conversation_history": ["...", "..."],
    "detected_intent": "create_capability",
    "flags": {
      "force": false,
      "quiet": false,
      "draft": false,
      "verbose": false,
      "list": false,
      "no_commit": false
    }
  },
  "metadata": {
    "invoked_from": "claude_skill",
    "timestamp": "2026-03-21T14:30:00Z",
    "session_id": "skill-session-abc123"
  }
}
```

### Response Handling

Responses stream as they're generated. The SKILL.md instructions include:
1. Start streaming the response to user
2. Parse server response line-by-line
3. Accumulate document content
4. Display completion status and next steps

### Error Handling

- **Server unavailable**: Graceful error message, offer to save as draft locally
- **Missing prerequisites**: Detect, inform user, offer to create them or proceed in draft mode
- **API validation errors**: Parse error response, show user what's missing
- **Streaming failures**: Attempt retry, save partial document, inform user

## Natural Language Routing & Scope Detection

### Routing Logic (in each SKILL.md)

```
IF user input matches trigger phrases
  AND user input does NOT match negative triggers
  AND prerequisites are satisfied (or can be auto-created)
THEN invoke this skill
ELSE consider other skills or ask for clarification
```

### Scope Detection (ddx-define specific)

When ddx-define is invoked:
1. Check if `define` document already exists
2. If no: Create new product spec document
3. If yes: Parse user input for new capability scope
4. Extract: feature name, requirements, acceptance criteria
5. Call API with full or partial spec (depending on -q flag)

### Routing Examples in Code

```markdown
## Determining which skill to invoke

Given the user says: "Build me a dashboard"

1. Parse: contains "build" verb + "dashboard" noun
2. Check capabilities:
   - No existing define doc → needs ddx-define first
   - No existing design doc → will need ddx-design after
   - No existing build doc → will need ddx-build after

3. Strategy: Invoke ddx-define with inferred scope
   - Scope: "dashboard"
   - After completion, offer: "Ready to design? Say yes to move to ddx-design"

If user says: "Implement the login flow" AND login already defined:
   - Check: define doc exists (yes) ✓
   - Check: design doc exists (maybe) → if not, warn but offer draft mode
   - Invoke: ddx-build with prereq check
```

## Flag Parsing from Natural Language

### Flag Detection

Skills parse natural language for flag indicators:

- `-f` / `--force`: "overwrite", "replace", "regenerate", "redo"
- `-q` / `--quiet`: "just create it", "no explanation", "silent"
- `-d` / `--draft`: "don't save", "provisional", "draft", "tentative"
- `-v` / `--verbose`: "detailed", "comprehensive", "with examples"
- `-l` / `--list`: "show me", "what exists", "list"
- `-n` / `--no-commit`: "don't save", "don't commit", "preview only"

### Implementation

In each SKILL.md, include:

```markdown
## Flag Detection & Parsing

Scan user input for:
- "overwrite" or "replace" → set force = true
- "don't save" or "draft" → set draft = true, no_commit = true
- "detailed" or "comprehensive" → set verbose = true
- Check for conflicting flags (quiet + verbose = error)
```

## Document Structure Consistency

All documents produced by skills follow the template structure from DDX v2 core (001-phase-based-structure):

- **Metadata block**: skill, timestamp, version, author (Claude)
- **Phase identifier**: which phase this belongs to
- **Content sections**: per-phase required sections
- **Validation**: all required fields present

Example:

```markdown
# Dashboard Dark Mode | Define

**Metadata**
- Phase: 1 (Define)
- Created: 2026-03-21 by Claude Skill (ddx-define)
- Version: 1.0
- Status: active

## Overview
...

## Requirements
...

## Acceptance Criteria
...
```

## Streaming & Real-Time Updates

Skills support streaming by:
1. Skill initiates skill execution
2. Server begins generating document
3. Response streamed line-by-line to Claude
4. Claude displays content progressively in conversation
5. Upon completion, metadata and file path shown
6. Document immediately visible in CLI: `ddx list`

## Prerequisite Checking Strategy

| Skill | Requires | Behavior |
|-------|----------|----------|
| mandate | (none) | Creates first doc always |
| define | mandate (suggested) | Can create without, warns user |
| design | mandate, define | Checks before proceeding, offers auto-create in draft |
| plan | mandate, define, design | Checks all three, fails gracefully if missing |
| build | mandate, define, design, plan | Prerequisite check strict, can proceed in draft if user OK |
| derive | (none) | Operates on code, no doc dependencies |

## Integration Points with 001 & 002

- Skills produce documents with identical structure to CLI-created docs
- Documents stored in same location: `.ddx/phase-N/doc-name.md`
- CLI can list/view/edit skill-created documents
- Skills can read documents created by previous skills or CLI
- Version numbering: CLI and skills use same versioning scheme
