# DDX v2 Claude Skills: Test Cases

## Test Format

Tests use Given/When/Then format for clarity:

```
Given: <preconditions, setup, state>
When: <user action or query>
Then: <expected outcome and assertions>
```

---

## Happy Path Tests

### Test 1.1: ddx-mandate Triggers on Convention Setup

**Given**: New DDX project with no mandate doc created yet

**When**: User says "Let's document our git workflow and PR process"

**Then**:
- ddx-mandate skill triggers (matches "document our git workflow")
- Does not match negative triggers (not a retrieval query)
- Skill extracts scope: "git workflow + PR process"
- Skill calls `POST /api/v1/documents/mandate` with scope
- Response streams: mandate document with git conventions, PR templates, review criteria
- Completion message shows: file path, version 1.0, next step suggestion ("Ready to define capabilities?")

**Assertion**: Document created in `.ddx/phase-0/mandate.md`

---

### Test 1.2: ddx-define Triggers on Feature Scoping

**Given**: Project has mandate doc, no define doc yet

**When**: User says "I want to add dark mode to the dashboard"

**Then**:
- ddx-define skill triggers (matches "I want to add")
- Scope detection: no define doc exists → create product spec
- Extracted scope: feature "dark mode", parent "dashboard"
- Skill detects optional prerequisite (mandate): found, no warning
- Skill calls `POST /api/v1/documents/define` with scope: "product"
- Response streams: define document with dark mode as first capability
- Document includes: overview, requirements, acceptance criteria
- Completion message offers: "Ready to design? Say yes for ddx-design"

**Assertion**: Document created in `.ddx/phase-1/define.md`

---

### Test 1.3: ddx-design Triggers on Technical Architecture

**Given**: Project has mandate and define docs

**When**: User says "Design the API for the dark mode feature"

**Then**:
- ddx-design skill triggers (matches "Design the API")
- Prerequisite check: mandate ✓, define ✓
- Scope extraction: "api"
- Skill gathers define doc content as context
- Skill calls `POST /api/v1/documents/design` with:
  - scope: "api"
  - upstream_docs: mandate + define content
- Response streams: design document with REST endpoints, request/response schemas, error handling
- Completion references upstream docs: "Based on the define doc..."

**Assertion**: Document created in `.ddx/phase-2/design.md`, references phase-1 content

---

### Test 1.4: ddx-plan Triggers on Work Breakdown

**Given**: Project has mandate, define, and design docs

**When**: User says "Break down the dark mode implementation into steps"

**Then**:
- ddx-plan skill triggers (matches "Break down the implementation")
- Prerequisite check: mandate ✓, define ✓, design ✓
- Scope extraction: "tasks" or "full_breakdown"
- Skill gathers all 3 upstream docs for context
- Skill calls `POST /api/v1/documents/plan` with scope and upstream context
- Response streams: plan document with phases, milestones, dependencies
- Example output: "Phase 1: UI layer, Phase 2: State management, Phase 3: Persistence"
- Completion offers: "Ready to build? Say yes for ddx-build"

**Assertion**: Document created in `.ddx/phase-3/plan.md`, integrates upstream docs

---

### Test 1.5: ddx-build Triggers on Implementation

**Given**: Project has all 4 upstream docs (mandate, define, design, plan)

**When**: User says "Build the dark mode toggle component"

**Then**:
- ddx-build skill triggers (matches "Build the component")
- Prerequisite check: mandate ✓, define ✓, design ✓, plan ✓
- Scope extraction: "dark mode toggle component"
- Skill gathers all 4 upstream docs + code structure
- Skill calls `POST /api/v1/documents/build` with scope and upstream context
- Response streams: implementation guide with:
  - React component code
  - State management approach
  - Styling strategy
  - Testing approach
- Code examples included: actual component skeleton, hooks usage
- Completion references: "Following the design from phase-2..."

**Assertion**: Document created in `.ddx/phase-4/build.md`, includes code snippets

---

### Test 1.6: ddx-derive Triggers on Code Documentation

**Given**: Project has existing codebase with authentication middleware

**When**: User says "Document the architecture of our auth system"

**Then**:
- ddx-derive skill triggers (matches "Document the architecture")
- No prerequisites checked (code-aware skill)
- Skill scans codebase for auth-related code:
  - Reads middleware files
  - Identifies patterns: Express middleware chain, JWT validation, session storage
- Scope extraction: "architecture"
- Skill calls `POST /api/v1/documents/derive` with:
  - scope: "architecture"
  - code_content: parsed auth middleware
  - codebase_path: source of truth
- Response streams: derived documentation with:
  - Extracted architecture patterns
  - Middleware structure diagram
  - JWT validation flow
  - Session handling approach
- Completion shows: "Reverse-engineered from: /src/middleware/auth.js"

**Assertion**: Document created in `.ddx/derived/auth-architecture.md`, references source files

---

## Input Validation Tests

### Test 2.1: Ambiguous Trigger Routes to Most Likely Skill

**Given**: User input could match multiple skills

**When**: User says "What's the plan for building the login feature?"

**Then**:
- Could match: ddx-plan (plan), ddx-build (building)
- Skill detection: Determines "plan" is primary verb
- ddx-plan skill is most likely
- Skill triggers with clarification: "I'm detecting you want to plan the login feature. Say yes to continue or 'build' to implement instead"
- User can correct routing: "Actually, just build it"
- Skill switches to ddx-build

**Assertion**: Ambiguous queries resolved without false positives

---

### Test 2.2: Negative Trigger Prevents False Activation

**Given**: User asks a retrieval question about existing docs

**When**: User says "Show me the mandate document"

**Then**:
- Does NOT trigger ddx-mandate (matches negative trigger: "show me")
- Skill recognizes: this is retrieval, not creation
- Response: "I can show you the mandate. Let me read it..." (fetch + display)
- No new document created

**Assertion**: Negative triggers prevent over-triggering

---

### Test 2.3: Missing Scope Information Detected

**Given**: User input is too vague

**When**: User says "Define something"

**Then**:
- ddx-define could trigger (contains "define")
- Skill detects: scope is empty or unclear
- Skill asks clarifying question: "What would you like to define? (e.g., a feature, a capability, the product scope)"
- Waits for clarification before invoking API

**Assertion**: Vague inputs handled gracefully, not passed to API as-is

---

### Test 2.4: Server Unavailable Handled Gracefully

**Given**: DDX server is down or unreachable

**When**: User triggers any skill (e.g., "Set up project rules")

**Then**:
- Skill attempts API call to `POST /api/v1/documents/mandate`
- Connection fails or timeout occurs
- Skill catches error and responds: "The DDX server isn't reachable right now. I can create a draft document locally and save it when the server is back. Want to proceed?"
- If yes: saves draft with `-d` flag, shows file path
- If no: skips document creation

**Assertion**: Graceful error handling, draft mode offered as fallback

---

## Failure Scenarios

### Test 3.1: Missing Prerequisites Prevent Incorrect Workflow

**Given**: User wants to invoke ddx-design without mandate doc

**When**: User says "Design the API" (mandate doesn't exist)

**Then**:
- Skill prerequisites check: mandate (required) - MISSING
- Skill blocks: "I need the project mandate (conventions, standards) before designing. Would you like me to create it first?"
- Options presented:
  1. Create mandate now, then design
  2. Proceed with design in draft mode (warnings shown)
- If option 1: Auto-trigger ddx-mandate, then continue to ddx-design
- If option 2: Proceed with warning: "Creating design without conventions—some standards may be missing"

**Assertion**: Prerequisite chain enforced, user guided through correct order

---

### Test 3.2: ddx-build Fails Gracefully Without Upstream Docs

**Given**: User invokes ddx-build with only mandate doc (missing define, design, plan)

**When**: User says "Build the login component" (define, design, plan missing)

**Then**:
- Skill checks prerequisites: mandate ✓, define ✗, design ✗, plan ✗
- Skill informs: "I have the mandate but I'm missing the product definition, design, and plan. I can build in draft mode, but it won't be complete."
- Show what's missing: "Missing: product spec (define), technical design (design), implementation plan (plan)"
- Options:
  1. Create missing docs first (triggers them in order)
  2. Build in draft mode (adds disclaimers)
  3. Cancel
- If option 2: Builds with warning header: "⚠️ Building without full upstream context. This guide is provisional."

**Assertion**: Strict prerequisite checking, fallback to draft mode offered

---

### Test 3.3: LLM Error During Skill Execution

**Given**: Server returns malformed response or LLM generation fails

**When**: Skill executes and server response is invalid JSON

**Then**:
- Skill parsing fails: expected JSON, got invalid format
- Skill catches error: "Document generation failed with an unexpected error. Details: [error message]"
- Skill offers: "Retry the generation? Or save what we have as a draft?"
- If retry: re-invokes API call
- If draft: saves partial document with error annotation

**Assertion**: Streaming failures don't crash skill, user can retry or save partial work

---

### Test 3.4: API Validation Error Reported to User

**Given**: User input missing required fields for API

**When**: Skill calls API with incomplete scope

**Then**:
- Server returns 400: `{ "error": "scope required" }`
- Skill parses error response and shows: "I need more information: what specific aspect should be designed?"
- Skill asks follow-up question to extract missing info
- Re-invokes API with complete request

**Assertion**: API errors surface as user-friendly questions, not technical stack traces

---

## Edge Cases

### Test 4.1: User Says "Build" but Means "Define"

**Given**: User input "build me a dashboard" but no product spec exists

**When**: Skill routing logic determines best fit

**Then**:
- "Build" suggests ddx-build
- But prerequisites missing: no define doc
- Skill detects contradiction: can't build without defining
- Skill clarifies: "I can help you build, but first I need to understand what the dashboard should do. Let me start with define."
- Routes to ddx-define instead
- After define completes, offers to continue to ddx-build

**Assertion**: Skill detects impossible routing and corrects course

---

### Test 4.2: Multiple Skills Could Trigger—Ask Which One

**Given**: User input matches triggers for 2+ skills equally

**When**: User says "Plan the API design"

**Then**:
- "Plan" matches ddx-plan (break down work)
- "Design" matches ddx-design (specify API)
- Ambiguity detected: equal match confidence for both
- Skill asks: "Are you asking to design the API first (ddx-design) or plan how to implement it (ddx-plan)? Or both?"
- User clarifies: "Design the API first"
- Routes to ddx-design

**Assertion**: Ambiguous triggers resolved interactively, user guides routing

---

### Test 4.3: Skill Invoked with Conflicting Flags

**Given**: User input includes conflicting flags

**When**: User says "Create mandate quietly and detailed"

**Then**:
- Flag parsing detects: `-q` (quiet) and `-v` (verbose) both present
- Conflict detected: can't be quiet AND verbose
- Skill reports: "You asked for both quiet output and verbose details. Which do you prefer?"
- Options: quiet, verbose, normal
- User selects: verbose
- Proceeds with correct flag set

**Assertion**: Conflicting flags detected and resolved via user choice

---

### Test 4.4: Skill-Created Doc Visible in CLI

**Given**: User creates mandate via skill

**When**: User later runs `ddx list` in terminal

**Then**:
- Skill created: `.ddx/phase-0/mandate.md`
- CLI lists it: "phase-0: mandate (created 2026-03-21 by Claude Skill)"
- User can view: `ddx show mandate`
- User can edit: `ddx edit mandate`
- Document metadata includes: creator (Claude Skill), timestamp, version

**Assertion**: Skill-created docs integrate seamlessly with CLI

---

### Test 4.5: User Creates Doc via Skill, Then CLI

**Given**: User creates mandate via skill in conversation

**When**: User later uses CLI to add design doc: `ddx design -f "API Design"`

**Then**:
- CLI reads existing mandate (created by skill)
- CLI uses it as context for new design doc
- CLI-created design references mandate: "Follows conventions from mandate..."
- Both docs coexist peacefully: `.ddx/phase-0/mandate.md` + `.ddx/phase-2/design.md`

**Assertion**: CLI and skills work together seamlessly

---

## Integration Tests: Skills with 001 & 002

### Test 5.1: Skill-Created Documents Match CLI Document Structure

**Given**: Same project, same input to both skill and CLI

**When**: Create mandate via skill: "Set up coding standards" vs. CLI: `ddx mandate -f "Coding Standards"`

**Then**:
- Both create `.ddx/phase-0/mandate.md`
- Both documents have identical structure:
  - Metadata block: phase, timestamp, version, status
  - Required sections: Overview, Standards, Examples
  - Validation: all required fields present
- Documents differ only in: creator field (Claude Skill vs. user name)

**Assertion**: Skill and CLI outputs are structurally identical

---

### Test 5.2: Skill-Created Docs Visible in CLI List

**Given**: Project has mandate created via skill

**When**: User runs CLI command: `ddx list`

**Then**:
- CLI output shows: "phase-0: mandate (v1.0, created 2026-03-21 by Claude Skill, active)"
- Metadata correctly recorded: skill name, timestamp, version
- Document is selectable: `ddx show mandate`

**Assertion**: CLI recognizes and displays skill-created documents

---

### Test 5.3: CLI Can Edit Skill-Created Documents

**Given**: Mandate created via skill

**When**: User edits via CLI: `ddx edit mandate`

**Then**:
- CLI opens document in editor
- User modifies content, saves
- Document updated: version bumped to 1.1
- CLI metadata updated: modified timestamp, version
- Skill can still read it: subsequent ddx-design call uses updated mandate as context

**Assertion**: Full bidirectional compatibility (skill ↔ CLI)

---

### Test 5.4: Streaming Works End-to-End

**Given**: User invokes ddx-define skill

**When**: Skill streams response from server

**Then**:
- Streaming begins: first chunk received within 1 second
- Document content appears progressively in chat
- User sees: "Creating define document... [streaming]"
- After completion: "Done! Document saved to .ddx/phase-1/define.md"
- No delay or buffering: content appears as it's generated

**Assertion**: Real-time streaming working correctly

---

## Flag Tests

### Test 6.1: Force Flag Overwrites Existing Document

**Given**: Mandate document exists (v1.0)

**When**: User says "Recreate the mandate, replace the old one" (detect `-f` flag)

**Then**:
- Flag parsing detects: "overwrite", "replace", "redo" → `-f` flag
- Skill sets: force = true
- Skill calls API with force flag
- Server overwrites existing mandate with new version
- Document version bumped: 1.0 → 2.0
- Metadata updated: creation timestamp, "replaced"

**Assertion**: Force flag allows document replacement

---

### Test 6.2: Quiet Flag Suppresses Output

**Given**: User invokes skill with quiet flag intent

**When**: User says "Just create the mandate, no explanation" (detect `-q`)

**Then**:
- Flag parsing detects: "just create", "no explanation" → `-q` flag
- Skill sets: quiet = true
- Skill calls API with quiet flag
- Response minimal: "Mandate created: .ddx/phase-0/mandate.md"
- No verbose details or explanations

**Assertion**: Quiet flag produces minimal output

---

### Test 6.3: Draft Flag Prevents Saving

**Given**: User wants to test document generation

**When**: User says "Draft a mandate without saving it" (detect `-d` flag)

**Then**:
- Flag parsing detects: "draft", "don't save", "provisional" → `-d` flag
- Skill sets: draft = true
- Skill generates document but doesn't save to disk
- Response shows: "[DRAFT] Mandate document (not saved)"
- Document shown in chat but not written to `.ddx/`

**Assertion**: Draft flag prevents file creation

---

### Test 6.4: Verbose Flag Includes Details

**Given**: User wants detailed output

**When**: User says "Create the mandate with lots of detail" (detect `-v`)

**Then**:
- Flag parsing detects: "detailed", "comprehensive", "with examples" → `-v` flag
- Skill sets: verbose = true
- Skill calls API with verbose flag
- Response includes: full sections, examples, rationale for each section
- Output longer and more comprehensive than normal

**Assertion**: Verbose flag produces detailed output

---

### Test 6.5: No-Commit Flag Prevents Version Control

**Given**: Project uses version control integration

**When**: User says "Create mandate but don't commit it" (detect `-n` flag)

**Then**:
- Flag parsing detects: "don't commit", "don't save to git", "preview" → `-n` flag
- Skill sets: no_commit = true
- Skill saves document to disk but skips git commit
- Document file exists but not staged: `git status` shows untracked
- User can review, then manually commit

**Assertion**: No-commit flag skips version control integration

---

## Natural Language Routing Tests

### Test 7.1: Feature Request Routes to Define

**Given**: User describes a new feature

**When**: User says "I want to add a search bar to the dashboard"

**Then**:
- Input parsed: "I want to add" + "search bar" = feature addition
- Skill determination: ddx-define (capture scope)
- Not ddx-build (no "implement", "code", "build")
- Not ddx-design (no "design", "API", "schema")
- ddx-define invoked with scope: "search bar for dashboard"

**Assertion**: Feature requests consistently route to define

---

### Test 7.2: Technical Question Routes to Derive (Not Design)

**Given**: Existing codebase

**When**: User says "How does the authentication work in our system?"

**Then**:
- Input parsed: "how does" = explanation, not creation
- Matches negative trigger for ddx-design: "how does the API work"
- Skill determination: ddx-derive (explain existing code)
- ddx-derive invoked: reads code, extracts patterns
- NOT ddx-design invoked (that's for NEW design)

**Assertion**: Explanation questions route to derive, not design

---

### Test 7.3: Implementation Request Routes to Build (After Checks)

**Given**: All upstream docs exist

**When**: User says "Implement the search feature"

**Then**:
- Input parsed: "implement" = build action
- Skill determination: ddx-build (implementation guide)
- Prerequisite check: mandate ✓, define ✓, design ✓, plan ✓
- All present: proceed with ddx-build
- NOT routed to define or design (already done)

**Assertion**: Implementation requests correctly route to build with prerequisite validation

---

### Test 7.4: Sequential Workflow Routes Correctly

**Given**: Multi-step request in single message

**When**: User says "Let's add dark mode to the dashboard. Start with scope, then design, then build."

**Then**:
- Skill detects three sequential requests: define → design → build
- Step 1: Trigger ddx-define for dark mode
- After completion: "Define done. Ready for design?"
- User confirms: trigger ddx-design
- After completion: "Design done. Ready to build?"
- User confirms: trigger ddx-build
- Three documents created in correct order and interdependence

**Assertion**: Sequential workflows guided through correct skill chain

---

## Trigger Accuracy Benchmark (Target: 90%+)

### Test 8.1: ddx-mandate Trigger Accuracy

Test cases covering 10+ queries:

| Query | Expected | Should Trigger? | Notes |
|-------|----------|-----------------|-------|
| "Set up project rules" | mandate | YES | Matches trigger exactly |
| "Define our naming conventions" | mandate | YES | Matches trigger pattern |
| "What are the current rules?" | (none) | NO | Negative trigger: retrieval |
| "Show me the mandate" | (none) | NO | Negative trigger: retrieval |
| "Build the feature" | build | NO | Wrong skill |
| "Document our git workflow" | mandate | YES | Matches trigger |
| "Are we following conventions?" | (none) | NO | Negative trigger: audit |
| "Establish team agreements" | mandate | YES | Matches trigger |
| "Create coding standards" | mandate | YES | Matches trigger |
| "Explain our standards" | derive | NO | Explanation, not creation |

**Assertion**: 90%+ accuracy on trigger detection (9/10 correct in above)

---

### Test 8.2: ddx-define Trigger Accuracy

| Query | Expected | Should Trigger? | Notes |
|-------|----------|-----------------|-------|
| "I want to add dark mode" | define | YES | Matches "I want to add" |
| "Scope out the auth feature" | define | YES | Matches "scope" |
| "Define requirements" | define | YES | Matches "define" |
| "How does the dashboard work?" | derive | NO | Negative trigger: retrieval |
| "Design the API" | design | NO | Wrong skill |
| "What should we build?" | define | YES | Matches "what should we build" |
| "We need a search feature" | define | YES | Matches "we need to build" |
| "Explain this feature" | derive | NO | Negative trigger: explanation |
| "Break down the work" | plan | NO | Wrong skill |
| "Create a spec for login" | define | YES | Matches "create a spec" |

**Assertion**: 90%+ accuracy (9/10 correct)

---

### Test 8.3: ddx-derive Trigger Accuracy

| Query | Expected | Should Trigger? | Notes |
|-------|----------|-----------------|-------|
| "Document this code" | derive | YES | Matches trigger exactly |
| "What's the architecture?" | derive | YES | Matches trigger pattern |
| "Explain the auth system" | derive | YES | Matches "explain" trigger |
| "Design the API" | design | NO | Wrong skill |
| "Build the feature" | build | NO | Wrong skill |
| "How does this work?" | derive | YES | Matches trigger (with code context) |
| "Extract the patterns" | derive | YES | Matches trigger |
| "What conventions are we using?" | derive | YES | Matches trigger |
| "What should we build?" | define | NO | Wrong skill |
| "Audit the codebase" | derive | YES | Matches trigger |

**Assertion**: 90%+ accuracy (9/10 correct)

---

## Summary

Total test cases: 57 (across all categories)
- Happy Path: 6 tests
- Input Validation: 4 tests
- Failure Scenarios: 4 tests
- Edge Cases: 5 tests
- Integration (001/002): 4 tests
- Flag Tests: 5 tests
- Routing Tests: 4 tests
- Trigger Accuracy: 3 benchmarks × 10 queries = 30 test cases

**Pass Criteria**:
- All happy path tests pass (6/6)
- Input validation handles edge cases gracefully (4/4)
- Failure scenarios fail safely (4/4)
- Trigger accuracy > 90% across all 6 skills
- Integration tests confirm bidirectional compatibility
- All flags parsed correctly
- Natural language routing works

**Overall Target**: 90%+ of test cases pass; trigger accuracy > 90% on each skill
