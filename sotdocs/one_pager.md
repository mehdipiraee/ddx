# Product One-Pager

## Who are we building for?

- **Product managers** who have an idea for a new product or feature and need to clearly define _what_ to build and _why_ it matters through structured documents such as product briefs, one-pagers, PRDs, and PR-FAQs.
- **Engineers, tech leads, and architects** who are responsible for translating product intent into technical specifications, including solution design documents, system design documents, and architecture decision records (ADRs).
- **Builders leveraging AI** to develop products or features who want structured, high-quality documentation to guide and ground AI-assisted development.

## What problem are we solving for them?

As code evolves, documentation such as requirements, design specs, and architectural decisions falls out of alignment with reality, leaving teams uncertain about what is authoritative. The risk increases when AI alters the codebase without validating that updates adhere to the defined requirements and architectural constraints.

## How do we know it's a real problem?

- **Common pattern**: Code contains features never mentioned in PRDs, or PRDs specify features never built.
- **Direct observation**: Team members report that when using AI for development ("vibe coding"), AI drifts from the requirements and adds things that were not originally included in the specs.

## How do we know it's an urgent problem?

- **AI assistants** (e.g., Claude) can now translate human intent into structured documentation at low cost, making it practical to maintain high-quality artifacts throughout the development lifecycle.
- **LLMs enable semantic consistency checks** across documents—something that was previously infeasible with rigid, rule-based tooling—allowing teams to detect misalignment beyond simple keyword matching.
- **The rise of AI-assisted coding accelerates implementation changes**, increasing the risk of documentation drift as humans struggle to keep pace with rapid code generation.

## What is the impact of the problem?

- **Time Cost**: When AI implements features that are not defined in the requirements, teams must spend additional time testing, validating, or asking the AI to remove unintended functionality.
- **Quality Risk**: As unplanned features increase the number of required test cases, not all scenarios are thoroughly validated, leading to gaps in coverage and declining product quality.
- **Compliance Risk**: Auditability suffers when documentation no longer reflects the actual implementation, breaking traceability and increasing regulatory risk.

## What happens if we do nothing?

- **Vibe coding reduces the quality of the end product**: Unchecked AI-assisted development will continue to drift from intended specifications.
- **Documentation and implementation divergence causes confusion**: Teams will lack a reliable source of truth, leading to misalignment, rework, and wasted effort.

## What's our proposed solution (product)?

DDX (Document Dependency eXchange) is an AI-powered documentation orchestration tool that maintains alignment across the software development lifecycle. It consists of:

1. **AI-Guided Document Creation**: Interactive workflows that guide users through creating structured documents (opportunity briefs, one-pagers, PRDs, design docs) using AI assistants that understand context and dependencies.

2. **Dependency Tracking**: A graph-based system that tracks relationships between documents (e.g., one-pager → PRD → design doc → code), ensuring upstream changes propagate awareness downstream and preventing orphaned decisions.

3. **Consistency Checking**: Semantic validation powered by LLMs that detects when downstream documents drift from upstream sources—catching conflicts that keyword matching would miss (e.g., PRD specifies "read-only mode" but design doc implements full editing).

**Core Technology**: A unified engine providing AI-guided creation, dependency tracking, and consistency checking that powers multiple product experiences.

## How will we measure success?

- **Personal adoption**: I consistently use DDX across all of my projects because it meaningfully improves clarity, alignment, and efficiency.
- **Organic team adoption**: Colleagues independently choose to use it for both work and personal projects, indicating that it delivers clear, recurring value without being mandated.
- **Documentation-code alignment**: Teams report reduced incidents of "code contains features never mentioned in PRDs" or vice versa.
- **Time savings**: Measurable reduction in time spent reconciling documentation drift or removing unintended AI-generated features.

## How and when will we ship it?

**Phased rollout leveraging shared core technology:**

**Phase 1: CLI Tool (Current/MVP)**
- **What**: Terminal-based commands (`ddx create`, `ddx check`, `ddx continue`)
- **When**: Available now (v0.1.5)
- **Why first**: Fastest path to validate core workflows; direct integration with developers' existing environments
- **Target users**: Early adopters comfortable with command-line tools

**Phase 2: Interactive REPL**
- **What**: Command-line interactive interface with conversational workflow
- **When**: 1-2 months after Phase 1 stabilization
- **Why next**: Lowers friction for iterative document creation; better for exploratory workflows
- **Target users**: Developers and PMs who prefer interactive sessions over discrete commands

**Phase 3: MCP Server**
- **What**: Model Context Protocol server enabling DDX integration into AI coding assistants (Claude Desktop, VS Code extensions, etc.)
- **When**: 2-3 months after Phase 2
- **Why next**: Meets users where they already work with AI; enables seamless doc-code workflows
- **Target users**: Teams using AI assistants for development; enables in-IDE documentation workflows

**Phase 4: Web Interface**
- **What**: Browser-based UI for document creation, visualization, and collaboration
- **When**: 4-6 months after Phase 3
- **Why last**: Broadest accessibility; enables non-technical stakeholders (PMs, executives) to participate
- **Target users**: Product managers, cross-functional teams, non-technical stakeholders

**Shipping Strategy**: Each phase builds on the shared core (AI-guided creation, dependency tracking, consistency checking) while expanding accessibility. Early phases validate workflows with technical users; later phases democratize access across the organization.

