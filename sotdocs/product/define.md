# Define: DDX v2

## What are we building?

DDX is an AI-powered documentation orchestration tool that maintains source-of-truth documentation throughout the software development lifecycle. It guides users through defining capabilities, designing solutions, planning work, and building code — with structured documents produced at each phase. All interaction modes connect to a shared server that owns the logic.

## Who is it for?

- **Product managers** who need to define what to build and why, with structured documents that stay aligned with implementation.
- **Engineers and architects** who translate product intent into technical specs and want those specs to remain the source of truth as code evolves.
- **AI-assisted builders** who use LLMs to write code and want structured documentation to guide and constrain the LLM's output, preventing drift from requirements.

## What problem does it solve?

As code evolves — especially with AI-assisted development — documentation drifts from reality. Requirements say one thing, code does another, and nobody knows which is authoritative. DDX makes documentation the source of truth by:
1. Structuring it into a dependency chain (mandate → define → design → plan → test → code)
2. Using AI to guide creation so documents are complete and consistent
3. Providing multiple access modes so documentation workflows integrate into how people already work

## How do we know it's a real problem?

- Code contains features never mentioned in requirements, or requirements specify features never built.
- Teams report that AI-assisted development ("vibe coding") produces drift from specs.
- Document maintenance is treated as overhead rather than as part of the development process.

## What does success look like?

- DDX is used consistently across projects because it reduces confusion and rework.
- Documentation stays aligned with code throughout the development lifecycle.
- Teams can onboard new members by pointing them to the `ddx/` directory.

## Acceptance Criteria

### Must Have

1. A server that handles all DDX logic (document CRUD, dependency tracking, LLM interactions, consistency checking)
2. CLI mode that connects to the server for all operations (mandate, define, design, plan, build, derive)
3. Claude Skills mode that exposes DDX operations as skills (ddx-mandate, ddx-define, ddx-design, ddx-plan, ddx-build, ddx-derive)
4. MCP server mode that exposes DDX operations as MCP tools
5. Document dependency tracking (upstream/downstream relationships)
6. AI-guided document creation using prompts and templates
7. Auto-detection of product vs capability level based on existing documents
8. Numbered capability folders with auto-increment (001-name, 002-name)
9. Prerequisite checking in build (generate missing upstream docs if needed)
10. Progressive complexity decomposition for non-trivial products

### Should Have

1. Web interface for browser-based document management
2. Consistency checking between documents (semantic validation via LLM)
3. Conversation state persistence for resuming interrupted workflows
4. Derive command that reverse-engineers docs from existing code

### Won't Have

1. Real-time collaboration (multiple users editing same document simultaneously)
2. Multi-LLM-provider support (Anthropic only at launch)
3. Authentication or multi-tenancy in web mode
4. Database backend (file system only at launch)
5. Integration with external project management tools (Jira, Linear, etc.)

## Dependencies

### Upstream
- Node.js runtime
- Anthropic Claude API
- @modelcontextprotocol/sdk

### Downstream
- Teams adopting DDX for their projects
- Future integrations with CI/CD, linters, and project management tools

## Constraints

- Must work as a single Node.js process (no microservices)
- Must be installable via npm
- Must work offline for local operations (only LLM calls require network)
- State stored on file system — no database dependency at launch
