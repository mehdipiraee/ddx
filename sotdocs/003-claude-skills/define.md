# DDX v2 Claude Skills: Definition

## Overview

DDX v2 exposes its core operations as Claude Skills—integrations within Anthropic's skill system that allow users to trigger structured documentation workflows through natural conversation. When a user chats with Claude about product development, infrastructure planning, or code implementation, the appropriate DDX skill activates automatically, routes the request to the DDX server's HTTP API, and produces timestamped, version-controlled documents as a side effect of the conversation.

This capability bridges the gap between exploratory conversation and formal documentation, eliminating the friction of switching between chat and CLI tools.

## Who Uses This

- **Product Managers & Designers**: Use `ddx-define` and `ddx-design` to document product specs and designs while discussing them
- **Engineering Teams**: Use `ddx-build` to generate implementation guides, `ddx-plan` to break work into steps, `ddx-derive` to auto-document existing code
- **Project Leads**: Use `ddx-mandate` to establish team conventions, then trigger other skills contextually
- **Any Claude User**: Anyone with Claude access and a running DDX server can invoke skills without learning CLI syntax

## The Problem This Solves

Without skills: User must manually switch between chat and CLI, remembering command syntax (`ddx define -n "Feature X" -q`), losing conversational context, and re-explaining their intent in structured format.

With skills: "I want to add dark mode to the dashboard" → Claude recognizes this as a define trigger (no product spec exists), invokes `ddx-define` with inferred scope, routes to DDX server, document appears in the project automatically, conversation continues naturally.

## Capabilities Overview

### ddx-mandate
Establish or update project rules, conventions, and team agreements. Triggers on requests to set up standards, define naming conventions, establish git workflows, or document team practices.

### ddx-define
Capture product or capability-level scope, requirements, and acceptance criteria. Triggers on requests to define features, scope work, establish product direction, or clarify what needs to be built.

### ddx-design
Specify the technical solution—architecture, API contracts, database schema, component hierarchy. Triggers on requests to design systems, spec APIs, plan implementation approach, or define technical constraints.

### ddx-plan
Break work into actionable steps, milestones, and dependencies. Triggers on requests to plan implementation, create roadmaps, break down epics, or establish task sequences.

### ddx-build
Generate implementation guides, code templates, and step-by-step build instructions guided by upstream docs (mandate, define, design, plan). Triggers on requests to implement, build, start coding, or generate templates.

### ddx-derive
Reverse-engineer documentation from existing code—extract patterns, infer architecture, document conventions observed in the codebase. Triggers on requests to document code, extract patterns, audit compliance, or understand existing systems.

## Acceptance Criteria

### Trigger Accuracy
- [ ] Each skill has a YAML description (name, triggers, negative triggers, examples)
- [ ] All 6 skills trigger on 90%+ of semantically relevant queries
- [ ] No skill over-triggers (e.g., `ddx-design` doesn't trigger on "what's the design?" questions about existing systems—that's `ddx-derive`)
- [ ] Ambiguous triggers correctly route to the most likely skill or ask for clarification

### API Integration
- [ ] Skills call the DDX server's HTTP API (`POST /api/v1/documents/<skill>`)
- [ ] API calls include request body with extracted scope, flags, and context
- [ ] Streaming responses work correctly (documents appear progressively in conversation)
- [ ] Error responses from server are handled gracefully with user feedback

### Flag Support
- [ ] Skills parse natural language flags: `-f` (force overwrite), `-q` (quiet, no output), `-d` (draft), `-v` (verbose), `-l` (list mode), `-n` (no commit)
- [ ] Flags are extracted from user input ("Create a mandate, but don't save it" → `-d` + `-n`)
- [ ] Conflicting flags are detected and reported

### Natural Language Routing
- [ ] "Build me a dashboard" → `ddx-define` (no spec exists), then offers to move to `ddx-design`
- [ ] "Implement the login flow" → `ddx-build` (spec exists), checks prerequisites, generates guide
- [ ] "Document our git workflow" → `ddx-mandate` (establishes convention)
- [ ] "Explain this codebase" → `ddx-derive` (reverses docs from code)
- [ ] User can invoke any skill explicitly: "Use ddx-design to spec the API"

### Document Quality & Consistency
- [ ] Documents created via skills have identical structure to CLI-created documents
- [ ] Documents include metadata (skill, timestamp, version, context)
- [ ] All 6 skills produce documents that pass validation (required sections present, proper formatting)
- [ ] Documents are immediately visible in `ddx list` output

### Integration with CLI
- [ ] Documents created via skills are visible in CLI: `ddx list`, `ddx show <name>`
- [ ] User can create doc via skill, then edit/refine via CLI
- [ ] Skill workflows reference documents created by upstream skills

## Success Metrics

- Skill triggering accuracy > 90% on held-out test set
- Average time from "I want to build X" to structured document: < 2 messages
- Zero context switches required (conversation → document flow is seamless)
- 100% of 6 skills have passing test suites
