# Opportunity Brief

## What's the problem?
As code evolves, documentation such as requirements, design specs, and architectural decisions, falls out of alignment with reality, leaving teams uncertain about what is authoritative. The risk increases when AI alters the codebase without validating that updates adhere to the defined requirements and architectural constraints.

## Who is affected?
- Product managers who have an idea for a new product or feature and need to clearly define _what_ to build and _why_ it matters through structured documents such as product briefs, one-pagers, PRDs, and PR-FAQs.
- Engineers, tech leads, and architects who are responsible for translating product intent into technical specifications, including solution design documents, system design documents, and architecture decision records (ADRs).
- Builders leveraging AI to develop products or features who want structured, high-quality documentation to guide and ground AI-assisted development.

## What evidence proves it's real?
- Common pattern: Code contains features never mentioned in PRDs, or PRDs specify features never built
- Direct quote: Team members have mentioned that when vibe coding AI drifts from the requirements and adds things that were not originally included in the specs
## What is the impact of the problem?
- Time Cost: When AI implements features that are not defined in the requirements, teams must spend additional time testing, validating, or asking the AI to remove unintended functionality.
- Quality Risk: As unplanned features increase the number of required test cases, not all scenarios are thoroughly validated, leading to gaps in coverage and declining product quality.
- Compliance Risk: Auditability suffers when documentation no longer reflects the actual implementation, breaking traceability and increasing regulatory risk.

## Why now?
- AI assistants (e.g., Claude) can now translate human intent into structured documentation at low cost, making it practical to maintain high-quality artifacts throughout the development lifecycle.
- LLMs enable semantic consistency checks across documents—something that was previously infeasible with rigid, rule-based tooling—allowing teams to detect misalignment beyond simple keyword matching.
- The rise of AI-assisted coding accelerates implementation changes, increasing the risk of documentation drift as humans struggle to keep pace with rapid code generation.

## What happens if we do nothing?
- Vibe coding reduces the quality of the end product
- documentation and implementation will be different causing confusion


## How will we know we solved it?
- Personal adoption: I consistently use the tool across all of my projects because it meaningfully improves clarity, alignment, and efficiency.
- Organic team adoption: Colleagues independently choose to use it for both work and personal projects, indicating that it delivers clear, recurring value without being mandated.
