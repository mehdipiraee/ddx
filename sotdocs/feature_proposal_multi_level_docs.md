# Feature Proposal: Multi-Level Documentation Support

**Author:** System Analysis
**Date:** 2026-02-27
**Status:** Proposal
**Version:** 1.1 (Updated with feedback)

## Executive Summary

This proposal introduces **scope-based organization** to DDX, enabling teams to maintain documentation at different granularity levels (product, feature, component) without namespace collisions or workflow conflicts.

### Key Design Principles (Refined)

1. **Document types can exist at multiple scopes**: Some doc types (like one-pagers and PRDs/specs) are relevant at both product and feature levels, reflecting the reality that specification work happens at different granularities.

2. **Single product-level architecture document**: Teams maintain **one System Design Document (SDD)** at the product level. Features reference it as context and prompt updates when they introduce architectural changes—but SDD is not in every feature's dependency chain.

3. **Conditional architectural updates**: Small features don't require SDD updates. Big features that introduce architectural changes (new services, data models, async workflows, etc.) trigger warnings or requirements to update the product SDD.

4. **Smart drift detection**: DDX uses AI to detect when a feature introduces architectural drift and recommends (or requires) updating the product SDD based on the severity and whether the feature is marked as "architecturally significant."

### What This Enables

- Create product-level docs: `ddx create product:prd`
- Create feature-level docs: `ddx create feature:spec --name git_hooks`
- Multiple features in parallel without conflicts
- Feature docs automatically reference product architecture as context
- Architectural significance detection with optional strict mode

## Problem Statement

DDX currently assumes a single, linear hierarchy of documentation:

```
opportunity_brief → one_pager → PRD → SDD → code
```

This works well for **product-level** documentation where you're planning an entire product from conception to implementation. However, real-world development often requires documentation at different granularity levels:

### Product-Level Documentation
- Describing the entire product vision
- High-level architectural decisions
- Overall product strategy and roadmap
- Example: "Build a documentation tool that ensures consistency"

### Feature-Level Documentation
- Describing a specific feature within an existing product
- Tactical implementation details for one capability
- Scoped to a subset of the system
- Example: "Add git hook integration to DDX"

### Current Pain Points

1. **Namespace Collision**: Only one `one_pager.md` can exist at a time. If you need a one-pager for a new feature, you overwrite the product-level one-pager.

2. **Context Confusion**: When running `ddx check prd`, it's unclear whether this is checking the product-level PRD or a feature-level PRD.

3. **Dependency Ambiguity**: A feature-level PRD should reference the product-level SDD (to ensure consistency with existing architecture), but currently upstream/downstream relationships are flat.

4. **Organization Chaos**: All documents live in a single `sotdocs/` directory with no structure to indicate scope.

5. **Workflow Mismatch**: Creating a small feature shouldn't require going through opportunity_brief → one_pager → PRD. Sometimes you just need feature_spec → implementation_plan.

## Use Cases

### Use Case 1: New Product
**Scenario:** Building DDX from scratch

**Documentation Path:**
```
opportunity_brief → one_pager → prd → sdd → [code]
```

**Current DDX:** ✅ Works perfectly

---

### Use Case 2: Major Feature Addition
**Scenario:** Adding git hooks to existing DDX

**Documentation Path:**
```
[existing product docs]
    ↓
feature_opportunity_brief → feature_spec → implementation_plan
    ↓
[existing sdd - updated]
```

**Current DDX:** ❌ Doesn't support this workflow
- No way to scope documents to a feature
- Can't reference existing product-level docs as context
- Feature docs would overwrite product docs

---

### Use Case 3: Multiple Features in Parallel
**Scenario:** Team working on 3 features simultaneously

**Documentation Needs:**
- Product-level: one_pager, prd, sdd (shared foundation)
- Feature A: feature_spec_git_hooks, implementation_plan_git_hooks
- Feature B: feature_spec_watch_mode, implementation_plan_watch_mode
- Feature C: feature_spec_web_ui, implementation_plan_web_ui

**Current DDX:** ❌ No support for parallel feature documentation

---

### Use Case 4: Multiple Products in Monorepo
**Scenario:** Monorepo with `packages/api/` and `packages/ui/`

**Documentation Needs:**
- Monorepo-level: architecture_overview
- API product: api/one_pager, api/prd, api/sdd
- UI product: ui/one_pager, ui/prd, ui/sdd

**Current DDX:** ❌ No support for multiple products

## Solution Approaches

### Approach 1: Scope-Based Organization

**Concept:** Introduce explicit scopes (product, feature, component) that partition the documentation namespace.

#### Configuration Example

```yaml
# ddx.config.yaml

scopes:
  product:
    description: "Product-level strategic documents"
    documents:
      opportunity_brief:
        name: "Opportunity Brief"
        prompt: "prompts/opportunity_brief_prompt.md"
        template: "templates/opportunity_brief_template.md"
        output: "sotdocs/product/opportunity_brief.md"
        upstream: []
        downstream: ["one_pager"]

      one_pager:
        name: "Product One-Pager"
        prompt: "prompts/one_pager_prompt.md"
        template: "templates/one_pager_template.md"
        output: "sotdocs/product/one_pager.md"
        upstream: ["opportunity_brief"]
        downstream: ["prd"]

      prd:
        name: "Product Requirements Document"
        prompt: "prompts/prd_prompt.md"
        template: "templates/prd_template.md"
        output: "sotdocs/product/prd.md"
        upstream: ["one_pager"]
        downstream: ["sdd"]

      sdd:
        name: "System Design Document"
        prompt: "prompts/sdd_prompt.md"
        template: "templates/sdd_template.md"
        output: "sotdocs/product/sdd.md"
        upstream: ["prd"]
        downstream: []

  feature:
    description: "Feature-level tactical documents"
    documents:
      feature_opportunity:
        name: "Feature Opportunity Brief"
        prompt: "prompts/feature_opportunity_prompt.md"
        template: "templates/feature_opportunity_template.md"
        output: "sotdocs/features/{feature_name}/opportunity.md"
        upstream: []
        downstream: ["feature_spec"]
        context_refs:
          - scope: product
            docs: ["prd", "sdd"]  # Read product docs as context

      feature_spec:
        name: "Feature Specification"
        prompt: "prompts/feature_spec_prompt.md"
        template: "templates/feature_spec_template.md"
        output: "sotdocs/features/{feature_name}/spec.md"
        upstream: ["feature_opportunity"]
        downstream: ["implementation_plan"]
        context_refs:
          - scope: product
            docs: ["sdd"]

      implementation_plan:
        name: "Implementation Plan"
        prompt: "prompts/implementation_plan_prompt.md"
        template: "templates/implementation_plan_template.md"
        output: "sotdocs/features/{feature_name}/implementation.md"
        upstream: ["feature_spec"]
        downstream: []
        context_refs:
          - scope: product
            docs: ["sdd"]
```

#### CLI Usage

```bash
# Product-level commands (unchanged)
ddx create product:opportunity_brief
ddx create product:one_pager
ddx check product:prd

# Feature-level commands (new)
ddx create feature:feature_opportunity --name git_hooks
# Creates sotdocs/features/git_hooks/opportunity.md
# Automatically reads sotdocs/product/prd.md and sdd.md as context

ddx continue feature:feature_spec --name git_hooks
# AI has access to:
# - feature opportunity (upstream)
# - product SDD (context_ref)

ddx list features
# Lists: git_hooks, watch_mode, web_ui

ddx check feature:feature_spec --name git_hooks
# Checks:
# - Upstream: Does spec match feature opportunity?
# - Context: Is spec consistent with product SDD?
# - Downstream: Does implementation plan implement the spec?
```

#### Directory Structure

```
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
    ├── watch_mode/
    │   ├── opportunity.md
    │   └── spec.md
    └── web_ui/
        └── opportunity.md
```

---

### Approach 2: Context-Based References

**Concept:** Keep the flat structure but allow documents to reference "context documents" that aren't in the direct upstream/downstream chain.

#### Configuration Example

```yaml
# ddx.config.yaml

documents:
  # Product-level docs
  opportunity_brief:
    name: "Opportunity Brief"
    output: "sotdocs/opportunity_brief.md"
    upstream: []
    downstream: ["one_pager"]

  prd:
    name: "PRD"
    output: "sotdocs/prd.md"
    upstream: ["one_pager"]
    downstream: ["sdd"]

  sdd:
    name: "System Design"
    output: "sotdocs/sdd.md"
    upstream: ["prd"]
    downstream: []

  # Feature-level docs
  feature_spec_git_hooks:
    name: "Feature Spec: Git Hooks"
    output: "sotdocs/feature_spec_git_hooks.md"
    upstream: []
    downstream: ["impl_plan_git_hooks"]
    context: ["sdd"]  # Reference SDD but not in dependency chain

  impl_plan_git_hooks:
    name: "Implementation Plan: Git Hooks"
    output: "sotdocs/impl_plan_git_hooks.md"
    upstream: ["feature_spec_git_hooks"]
    downstream: []
    context: ["sdd"]
```

#### Pros
- Simpler conceptual model
- Explicit naming makes feature docs obvious
- No new scope abstraction

#### Cons
- Namespace pollution (every feature doc listed at top level)
- Manual naming conventions (git_hooks suffix)
- Doesn't scale to dozens of features
- No way to organize related feature docs together

---

### Approach 3: Hierarchical Document Types

**Concept:** Allow document types to have "variants" at different levels.

#### Configuration Example

```yaml
# ddx.config.yaml

document_types:
  opportunity_brief:
    levels:
      product:
        name: "Product Opportunity Brief"
        prompt: "prompts/product_opportunity_prompt.md"
        output: "sotdocs/product_opportunity_brief.md"

      feature:
        name: "Feature Opportunity Brief"
        prompt: "prompts/feature_opportunity_prompt.md"
        output: "sotdocs/features/{name}/opportunity_brief.md"
        inherits_context: ["product.sdd"]

  spec:
    levels:
      product:
        name: "Product Requirements Document (PRD)"
        prompt: "prompts/prd_prompt.md"
        output: "sotdocs/prd.md"

      feature:
        name: "Feature Specification"
        prompt: "prompts/feature_spec_prompt.md"
        output: "sotdocs/features/{name}/spec.md"
        inherits_context: ["product.spec", "product.design"]

dependencies:
  product:
    opportunity_brief → spec → design

  feature:
    opportunity_brief → spec → implementation
```

#### CLI Usage

```bash
ddx create opportunity_brief --level product
ddx create spec --level product

ddx create opportunity_brief --level feature --name git_hooks
ddx create spec --level feature --name git_hooks
```

#### Pros
- Recognizes that similar document types exist at different levels
- Clear inheritance model
- Reusable prompts/templates with level-specific customization

#### Cons
- More complex config structure
- Mixes level and type concerns
- Unclear how to handle documents that don't have multi-level variants

---

## Recommended Approach: **Approach 1 (Scope-Based)**

### Why Scope-Based is Best

1. **Clear Mental Model**: "Product" vs "Feature" is intuitive and matches how teams think about work.

2. **Scalability**: Works for any number of features without namespace collision.

3. **Flexible Context**: `context_refs` allows feature docs to reference product docs without forcing them into the dependency chain.

4. **Organizational Clarity**: Directory structure (`sotdocs/product/` vs `sotdocs/features/git_hooks/`) makes it obvious what level you're working at.

5. **Extensible**: Easy to add more scopes later (e.g., `component`, `team`, `platform`).

6. **Parallel Development**: Multiple teams can work on different features without conflicts.

### Key Design Decisions

#### 0. Document Types Can Exist at Multiple Scopes

**Important principle:** Some document types (like "spec documents") are relevant at both product and feature levels:

- **Product one-pager / PRD**: Overall vision and requirements for the entire product
- **Feature one-pager / feature spec**: Scoped requirements for a single capability

This is not duplication—it reflects the reality that specification work happens at different granularities.

**Configuration approach:**

```yaml
scopes:
  product:
    documents:
      one_pager:
        name: "Product One-Pager"
        prompt: "prompts/product/one_pager_prompt.md"
        template: "templates/product/one_pager_template.md"
        output: "sotdocs/product/one_pager.md"

      prd:
        name: "Product Requirements Document"
        prompt: "prompts/product/prd_prompt.md"
        template: "templates/product/prd_template.md"
        output: "sotdocs/product/prd.md"

  feature:
    documents:
      one_pager:
        name: "Feature One-Pager"
        prompt: "prompts/feature/one_pager_prompt.md"  # Scoped version
        template: "templates/feature/one_pager_template.md"
        output: "sotdocs/features/{feature_name}/one_pager.md"
        params: ["feature_name"]
        context_refs:
          - scope: product
            docs: ["prd"]  # Reference product-level context

      spec:
        name: "Feature Specification"  # Can rename to avoid confusion
        prompt: "prompts/feature/spec_prompt.md"
        template: "templates/feature/spec_template.md"
        output: "sotdocs/features/{feature_name}/spec.md"
        params: ["feature_name"]
        context_refs:
          - scope: product
            docs: ["prd", "sdd"]
```

**Usage:**
```bash
ddx create product:one_pager    # Product-level vision
ddx create feature:one_pager --name git_hooks  # Feature-level vision
ddx create feature:spec --name git_hooks       # Feature spec (renamed from PRD)
```

This allows the same "type" of work (creating a specification document) to happen at the appropriate level without confusion.

#### 1. Parameterized Output Paths

```yaml
output: "sotdocs/features/{feature_name}/spec.md"
```

The `{feature_name}` parameter is provided via CLI:

```bash
ddx create feature:feature_spec --name git_hooks
```

#### 2. Context References vs. Dependencies

**Dependencies** (upstream/downstream):
- Create a chain of derived documents
- Changes in upstream docs should trigger consistency checks in downstream docs
- Example: `one_pager` → `prd` → `sdd`

**Context References** (`context_refs`):
- Provide additional information but don't create dependency obligations
- Used for grounding feature docs in product reality
- Example: Feature spec references product SDD to ensure architectural consistency

#### 2.1. The Special Case: Single Product-Level SDD

**Key principle:** Teams typically maintain **one product-level System Design Document (SDD)** that describes the overall architecture.

Feature-level work does **not** create separate feature SDDs. Instead:

1. **Feature docs reference the product SDD as context**
   ```yaml
   feature:
     documents:
       spec:
         context_refs:
           - scope: product
             docs: ["sdd"]
   ```

2. **Big features may require updating the product SDD**

   A feature is "architecturally significant" if it:
   - Adds a new service/component or changes module boundaries
   - Introduces a new data model or storage pattern
   - Adds async workflows (queues, events, pub/sub)
   - Changes auth/permissions/security model
   - Impacts performance/scalability assumptions
   - Adds external integrations or compliance constraints

3. **SDD updates are conditional, not automatic**

   **Default behavior:**
   ```bash
   ddx check feature:spec --name git_hooks
   ```
   Output:
   ```
   ✓ Upstream check passed: feature/git_hooks/one_pager
   ✓ Context consistency: product/prd
   ⚠ Architectural drift detected: product/sdd

   This feature introduces:
   - New git hook execution workflow (async)
   - New .git/hooks/ filesystem integration

   Recommendation: Update product/sdd to document:
   - Hook lifecycle and error handling
   - Integration points with git operations
   ```

   **Strict mode for architecturally significant features:**
   ```bash
   ddx check feature:spec --name git_hooks --require-context-update product:sdd
   ```
   Output:
   ```
   ✗ Context update required: product/sdd not updated

   This feature is marked as architecturally significant.
   Update product/sdd before proceeding.
   ```

4. **Workflow pattern for architectural features**

   ```bash
   # 1. Create feature spec
   ddx create feature:spec --name git_hooks
   ddx continue feature:spec --name git_hooks

   # 2. Check reveals architectural drift
   ddx check feature:spec --name git_hooks
   # ⚠ Warns about architectural changes

   # 3. Update product SDD to reflect architectural changes
   ddx continue product:sdd -m "Update to include git hook integration architecture"

   # 4. Re-check now passes
   ddx check feature:spec --name git_hooks
   # ✓ All checks passed

   # 5. Proceed with implementation
   ddx create feature:implementation_plan --name git_hooks
   ```

This pattern ensures:
- Small features don't get bogged down with unnecessary SDD updates
- Big features properly update the architectural documentation
- The product SDD remains the single source of truth for system architecture
- Feature teams are prompted (not forced) to update architecture docs when appropriate

#### 3. Marking Features as Architecturally Significant

Features can optionally declare themselves as architecturally significant:

```yaml
# In feature spec document or via CLI flag
ddx create feature:spec --name git_hooks --architectural
```

Or in the document frontmatter:

```markdown
---
architectural_significance: true
architectural_changes:
  - New git hook execution workflow
  - New filesystem integration with .git/hooks/
  - Error handling for hook failures
---

# Feature Specification: Git Hooks Integration
...
```

When a feature is marked as architecturally significant:
- `ddx check` will require product SDD to be updated before passing
- Helps enforce architectural documentation discipline for big changes
- Optional—default behavior is to warn, not fail

#### 4. Scope Prefixing

CLI uses `scope:document_type` syntax:

```bash
ddx create product:prd          # Creates product-level PRD
ddx create feature:spec # Creates feature-level spec
```

This avoids ambiguity and makes the command's intent explicit.

#### 5. Default Scope

For backward compatibility:

```bash
ddx create prd
# Equivalent to:
ddx create product:prd
```

If no scope is specified, DDX uses the default scope (configurable, defaults to `product`).

### Implementation Details

#### Type System Changes

```typescript
// src/types.ts

export interface DocumentConfig {
  name: string;
  prompt: string;
  template: string;
  output: string;  // May contain {param} placeholders
  upstream: string[];  // References within same scope
  downstream: string[];
  context_refs?: ContextReference[];  // NEW: References across scopes
  params?: string[];  // NEW: Required parameters for this doc type
}

export interface ContextReference {
  scope: string;
  docs: string[];
  description?: string;
}

export interface ScopeConfig {
  description: string;
  documents: Record<string, DocumentConfig>;
}

export interface DDXConfig {
  scopes: Record<string, ScopeConfig>;  // CHANGED from flat documents
  default_scope?: string;  // NEW
  llm: LLMConfig;
  workflow: WorkflowConfig;
}
```

#### Config Loader Changes

```typescript
// src/config.ts

export class ConfigLoader {
  getDocumentConfig(fullDocType: string, params?: Record<string, string>) {
    const [scope, docType] = this.parseScopedType(fullDocType);
    const scopeConfig = this.config.scopes[scope];

    if (!scopeConfig) {
      throw new Error(`Unknown scope: ${scope}`);
    }

    const docConfig = scopeConfig.documents[docType];

    if (!docConfig) {
      throw new Error(`Unknown document type '${docType}' in scope '${scope}'`);
    }

    // Validate required params
    if (docConfig.params) {
      for (const param of docConfig.params) {
        if (!params || !params[param]) {
          throw new Error(`Missing required parameter: ${param}`);
        }
      }
    }

    // Substitute params in output path
    let outputPath = docConfig.output;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        outputPath = outputPath.replace(`{${key}}`, value);
      }
    }

    return {
      ...docConfig,
      output: outputPath,
      scope,
      docType,
    };
  }

  private parseScopedType(fullDocType: string): [string, string] {
    if (fullDocType.includes(':')) {
      const [scope, docType] = fullDocType.split(':');
      return [scope, docType];
    }

    // Use default scope
    const defaultScope = this.config.default_scope || 'product';
    return [defaultScope, fullDocType];
  }
}
```

#### CLI Changes

```typescript
// src/cli.ts

program
  .command('create <document-type>')
  .description('Create a new document (format: scope:doc_type or just doc_type)')
  .option('-n, --name <name>', 'Name for parameterized documents (e.g., feature name)')
  .option('--params <json>', 'Parameters as JSON object')
  .action(async (documentType: string, options) => {
    const params: Record<string, string> = {};

    if (options.name) {
      params.feature_name = options.name;
    }

    if (options.params) {
      Object.assign(params, JSON.parse(options.params));
    }

    const workflow = new WorkflowOrchestrator(documentType, params);
    await workflow.create();
  });
```

#### Workflow Changes

When loading context references:

```typescript
// src/workflow.ts

async loadUpstreamDocuments(): Promise<string[]> {
  const docs: string[] = [];

  // Load direct upstream dependencies (within same scope)
  for (const upstreamType of this.docConfig.upstream) {
    const upstreamConfig = this.configLoader.getDocumentConfig(
      `${this.scope}:${upstreamType}`,
      this.params
    );
    const content = await this.fileManager.read(upstreamConfig.output);
    docs.push(content);
  }

  // Load context references (across scopes)
  if (this.docConfig.context_refs) {
    for (const contextRef of this.docConfig.context_refs) {
      for (const docType of contextRef.docs) {
        const contextConfig = this.configLoader.getDocumentConfig(
          `${contextRef.scope}:${docType}`
        );
        const content = await this.fileManager.read(contextConfig.output);
        docs.push(content);
      }
    }
  }

  return docs;
}
```

#### Consistency Checking with Architectural Significance

```typescript
// src/workflow.ts

interface ConsistencyCheckResult {
  passed: boolean;
  upstream_checks: CheckResult[];
  context_checks: CheckResult[];
  architectural_drift?: ArchitecturalDrift;
}

interface CheckResult {
  doc: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
}

interface ArchitecturalDrift {
  detected: boolean;
  changes: string[];
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

async checkConsistency(requireContextUpdate: boolean = false): Promise<ConsistencyCheckResult> {
  const result: ConsistencyCheckResult = {
    passed: true,
    upstream_checks: [],
    context_checks: [],
  };

  // Check upstream dependencies (within scope)
  for (const upstreamType of this.docConfig.upstream) {
    const check = await this.checkAgainstUpstream(upstreamType);
    result.upstream_checks.push(check);
    if (check.status === 'failed') {
      result.passed = false;
    }
  }

  // Check context references (across scopes)
  if (this.docConfig.context_refs) {
    for (const contextRef of this.docConfig.context_refs) {
      for (const docType of contextRef.docs) {
        const check = await this.checkAgainstContext(contextRef.scope, docType);
        result.context_checks.push(check);

        // Detect architectural drift for SDD
        if (docType === 'sdd') {
          const drift = await this.detectArchitecturalDrift(
            `${contextRef.scope}:${docType}`,
            check
          );
          result.architectural_drift = drift;

          // Check if feature is marked as architecturally significant
          const isArchitecturalFeature = await this.isArchitecturallySignificant();

          if (drift.detected) {
            if (requireContextUpdate || isArchitecturalFeature) {
              // Strict mode: fail the check
              result.passed = false;
              check.status = 'failed';
              check.message = `Context update required: ${contextRef.scope}/${docType} not updated for architectural changes`;
            } else {
              // Default mode: warn but don't fail
              check.status = 'warning';
              check.message = `Architectural drift detected. Consider updating ${contextRef.scope}/${docType}`;
            }
          }
        }
      }
    }
  }

  return result;
}

async detectArchitecturalDrift(sddRef: string, contextCheck: CheckResult): Promise<ArchitecturalDrift> {
  const currentDoc = await this.fileManager.read(this.docConfig.output);
  const sddConfig = this.configLoader.getDocumentConfig(sddRef);
  const sddContent = await this.fileManager.read(sddConfig.output);

  // Use LLM to detect architectural changes
  const prompt = `
You are analyzing whether a feature specification introduces architectural changes
that should be documented in the System Design Document (SDD).

Feature Specification:
${currentDoc}

Current System Design Document:
${sddContent}

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
  "recommendation": "specific recommendation for updating SDD",
  "severity": "low/medium/high"
}
`;

  const response = await this.llmClient.sendMessage(prompt);
  return JSON.parse(response);
}

async isArchitecturallySignificant(): Promise<boolean> {
  const content = await this.fileManager.read(this.docConfig.output);

  // Check for frontmatter flag
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    if (frontmatter.includes('architectural_significance: true')) {
      return true;
    }
  }

  // Check for CLI flag (stored in workflow state)
  const state = this.stateManager.load(this.documentType);
  if (state?.context?.architectural === true) {
    return true;
  }

  return false;
}
```

#### CLI Updates for Architectural Features

```typescript
// src/cli.ts

program
  .command('create <document-type>')
  .option('-n, --name <name>', 'Name for parameterized documents')
  .option('--architectural', 'Mark this feature as architecturally significant')
  .action(async (documentType: string, options) => {
    const params: Record<string, string> = {};
    const context: Record<string, any> = {};

    if (options.name) {
      params.feature_name = options.name;
    }

    if (options.architectural) {
      context.architectural = true;
    }

    const workflow = new WorkflowOrchestrator(documentType, params, context);
    await workflow.create();
  });

program
  .command('check <document-type>')
  .option('-n, --name <name>', 'Name for parameterized documents')
  .option('--require-context-update <refs>', 'Require specific context docs to be updated (e.g., product:sdd)')
  .action(async (documentType: string, options) => {
    const params: Record<string, string> = {};

    if (options.name) {
      params.feature_name = options.name;
    }

    const workflow = new WorkflowOrchestrator(documentType, params);
    const requireContextUpdate = options.requireContextUpdate !== undefined;

    const result = await workflow.checkConsistency(requireContextUpdate);

    // Display results
    console.log('\nConsistency Check Results:\n');

    for (const check of result.upstream_checks) {
      const icon = check.status === 'passed' ? '✓' : '✗';
      console.log(`${icon} Upstream: ${check.doc} - ${check.message}`);
    }

    for (const check of result.context_checks) {
      const icon = check.status === 'passed' ? '✓' : check.status === 'warning' ? '⚠' : '✗';
      console.log(`${icon} Context: ${check.doc} - ${check.message}`);
    }

    if (result.architectural_drift?.detected) {
      console.log('\n⚠ Architectural Drift Detected:\n');
      for (const change of result.architectural_drift.changes) {
        console.log(`  - ${change}`);
      }
      console.log(`\nRecommendation: ${result.architectural_drift.recommendation}`);
      console.log(`Severity: ${result.architectural_drift.severity}`);
    }

    process.exit(result.passed ? 0 : 1);
  });
```

### Migration Path

#### Phase 1: Backward Compatibility (v0.2.0)

1. Support both old and new config formats
2. Old format automatically migrated to `product` scope
3. CLI accepts both `ddx create prd` and `ddx create product:prd`

Example migration:

```yaml
# Old config (still supported)
documents:
  prd:
    name: "PRD"
    output: "sotdocs/prd.md"

# Internally converted to:
scopes:
  product:
    documents:
      prd:
        name: "PRD"
        output: "sotdocs/prd.md"
```

#### Phase 2: Feature Scope Introduction (v0.3.0)

1. Add `feature` scope to default templates
2. Update `ddx init` to scaffold both product and feature scopes
3. Documentation and examples for feature-level workflows

#### Phase 3: Advanced Scopes (v0.4.0+)

1. Support arbitrary custom scopes
2. Add `ddx scope list` command
3. Visual scope/dependency graphing
4. Import/export scope configurations

### Example Workflow

#### 1. Initialize Project

```bash
ddx init
```

Generates:

```
ddx.config.yaml        # With product and feature scopes
prompts/
├── product/
│   ├── opportunity_brief_prompt.md
│   ├── one_pager_prompt.md
│   └── prd_prompt.md
└── feature/
    ├── feature_opportunity_prompt.md
    ├── feature_spec_prompt.md
    └── implementation_plan_prompt.md
templates/
├── product/
└── feature/
sotdocs/
├── product/
└── features/
```

#### 2. Create Product Docs

```bash
ddx create product:opportunity_brief
ddx continue product:opportunity_brief

ddx create product:one_pager
ddx continue product:one_pager

ddx create product:prd
```

Result:
```
sotdocs/product/
├── opportunity_brief.md
├── one_pager.md
└── prd.md
```

#### 3. Create Feature Docs

```bash
ddx create feature:feature_opportunity --name git_hooks
# AI has access to product/prd.md and product/sdd.md as context

ddx continue feature:feature_opportunity --name git_hooks

ddx create feature:feature_spec --name git_hooks
# AI has access to:
# - Upstream: features/git_hooks/opportunity.md
# - Context: product/sdd.md

ddx continue feature:feature_spec --name git_hooks
```

Result:
```
sotdocs/
├── product/
│   ├── opportunity_brief.md
│   ├── one_pager.md
│   └── prd.md
└── features/
    └── git_hooks/
        ├── opportunity.md
        └── spec.md
```

#### 4. Check Consistency

```bash
# Check feature against upstream and context
ddx check feature:feature_spec --name git_hooks

# Output:
# ✓ Upstream check passed: feature_opportunity
# ✓ Context check passed: product/prd
# ⚠ Architectural drift detected: product/sdd
#
# This feature introduces:
# - New git hook execution workflow (async)
# - New .git/hooks/ filesystem integration
#
# Recommendation: Update product/sdd to document:
# - Hook lifecycle and error handling
# - Integration points with git operations
#
# Severity: medium
```

#### 5. Update Product SDD for Architectural Feature

```bash
# Update the product SDD to reflect the new architecture
ddx continue product:sdd -m "Add git hooks integration architecture section"

# AI reads the feature spec and updates the SDD with:
# - Hook execution lifecycle
# - Error handling strategy
# - Integration with git operations
# - Security considerations
```

#### 6. Re-check and Proceed

```bash
# Re-check now passes
ddx check feature:feature_spec --name git_hooks
# Output:
# ✓ Upstream check passed: feature_opportunity
# ✓ Context check passed: product/prd
# ✓ Context check passed: product/sdd
# ✓ All checks passed

# Proceed with implementation
ddx create feature:implementation_plan --name git_hooks
```

## Real-World Workflow Examples

### Example 1: Small Non-Architectural Feature

**Feature:** Add a new command-line flag `--verbose` to increase logging output

```bash
# 1. Create feature spec (no opportunity doc needed for small feature)
ddx create feature:spec --name verbose_flag

# 2. Continue with AI guidance
ddx continue feature:spec --name verbose_flag

# 3. Check consistency
ddx check feature:spec --name verbose_flag
# Output:
# ✓ Context check passed: product/prd
# ✓ Context check passed: product/sdd
# ✓ No architectural changes detected

# 4. Proceed to implementation
ddx create feature:implementation_plan --name verbose_flag

# Note: No SDD update required—this is purely a local change
```

### Example 2: Major Architectural Feature

**Feature:** Add distributed caching with Redis

```bash
# 1. Create feature opportunity (recommended for big features)
ddx create feature:one_pager --name redis_caching --architectural

# 2. Create feature spec (marked as architectural)
ddx create feature:spec --name redis_caching --architectural

# 3. Check reveals architectural drift
ddx check feature:spec --name redis_caching
# Output:
# ✗ Context update required: product/sdd not updated for architectural changes
#
# This feature introduces:
# - New Redis service dependency
# - New distributed caching layer
# - New failure modes and consistency requirements
# - Performance/latency impact on read operations
#
# Recommendation: Update product/sdd sections:
# - Data flow diagrams
# - Cache invalidation strategy
# - Deployment topology
# - Monitoring and alerting
#
# Severity: high
#
# This feature is marked as architecturally significant.
# Product SDD must be updated before proceeding.

# 4. Update product SDD (REQUIRED due to --architectural flag)
ddx continue product:sdd -m "Add distributed caching architecture with Redis"

# 5. Re-check now passes
ddx check feature:spec --name redis_caching
# ✓ All checks passed

# 6. Proceed to implementation
ddx create feature:implementation_plan --name redis_caching
```

### Example 3: Multiple Features in Parallel

**Scenario:** Team of 3 working on different features

```bash
# Developer 1: Git hooks feature
ddx create feature:spec --name git_hooks
ddx continue feature:spec --name git_hooks

# Developer 2: Watch mode feature
ddx create feature:spec --name watch_mode
ddx continue feature:spec --name watch_mode

# Developer 3: Web UI feature
ddx create feature:one_pager --name web_ui --architectural
ddx create feature:spec --name web_ui --architectural

# Directory structure:
sotdocs/
├── product/
│   ├── opportunity_brief.md
│   ├── one_pager.md
│   ├── prd.md
│   └── sdd.md
└── features/
    ├── git_hooks/
    │   └── spec.md
    ├── watch_mode/
    │   └── spec.md
    └── web_ui/
        ├── one_pager.md
        └── spec.md

# Each developer works independently
# No namespace conflicts
# Each feature references the same product SDD as context
# Only web_ui requires SDD update (architectural)
```

## Alternative Use Cases Supported

### Monorepo with Multiple Products

```yaml
scopes:
  platform:
    documents:
      architecture_overview:
        output: "docs/platform/architecture.md"

  api_product:
    documents:
      prd:
        output: "docs/products/api/prd.md"
        context_refs:
          - scope: platform
            docs: ["architecture_overview"]

  ui_product:
    documents:
      prd:
        output: "docs/products/ui/prd.md"
        context_refs:
          - scope: platform
            docs: ["architecture_overview"]
```

Usage:
```bash
ddx create platform:architecture_overview
ddx create api_product:prd
ddx create ui_product:prd
```

### Component-Level Documentation

```yaml
scopes:
  product:
    # ... product-level docs

  component:
    description: "Component-level design documents"
    documents:
      component_spec:
        output: "sotdocs/components/{component_name}/spec.md"
        params: ["component_name"]
        context_refs:
          - scope: product
            docs: ["sdd"]
```

Usage:
```bash
ddx create component:component_spec --name auth_service
ddx create component:component_spec --name api_gateway
```

## Open Questions

### Q1: Should features have their own subdirectory or share a flat namespace?

**Option A: Hierarchical (Recommended)**
```
sotdocs/features/git_hooks/opportunity.md
sotdocs/features/git_hooks/spec.md
```

**Option B: Flat with naming convention**
```
sotdocs/features/git_hooks_opportunity.md
sotdocs/features/git_hooks_spec.md
```

**Decision:** Option A. Hierarchical is cleaner and allows features to have arbitrary numbers of documents without namespace pollution.

### Q2: How should `ddx list` work with scopes?

```bash
# Option 1: List all scopes and their documents
ddx list
# Output:
# Scopes:
#   product: opportunity_brief, one_pager, prd, sdd
#   feature: feature_opportunity, feature_spec, implementation_plan

# Option 2: List by scope
ddx list product
ddx list features  # Lists feature instances (git_hooks, watch_mode, etc.)

# Option 3: List everything
ddx list --all
```

**Decision:** Support all three. `ddx list` shows scopes overview, `ddx list <scope>` shows details, `ddx list features` shows feature instances.

### Q3: How should consistency checking work across scopes?

When you check a feature doc, should it:
1. Check only within-scope dependencies (feature_opportunity → feature_spec)?
2. Also check context references (feature_spec vs. product/sdd)?
3. Allow manual specification?

**Decision:** Do both 1 and 2 by default. Context references are checked for consistency but not dependency compliance (i.e., warn but don't fail).

### Q4: Should scopes be nestable?

```yaml
scopes:
  product:
    scopes:
      backend:
        documents: ...
      frontend:
        documents: ...
```

**Decision:** Not in v1. Keep it simple with flat scopes. Can add nesting later if needed.

## Success Metrics

This feature will be considered successful if:

1. **Documentation Organization**: Users can easily distinguish product-level from feature-level docs
2. **Parallel Development**: 3+ features can be documented simultaneously without conflicts
3. **Context Awareness**: Feature docs can reference product docs without manual copy-paste
4. **Migration Ease**: Existing DDX users can upgrade without breaking changes
5. **Intuitive CLI**: New users understand `scope:doc_type` syntax without reading docs

## Next Steps

1. ✅ Get feedback on this proposal
2. Prototype scope-based config loading
3. Update CLI to support scope:doc_type syntax
4. Implement context_refs loading in workflow
5. Update templates with product/feature variants
6. Write migration guide for v0.1.x → v0.2.0
7. Test with real-world multi-feature scenario

## Appendix: Config File Comparison

### Current Config (v0.1.x)

```yaml
documents:
  opportunity_brief:
    name: "Opportunity Brief"
    prompt: "prompts/opportunity_brief_prompt.md"
    template: "templates/opportunity_brief_template.md"
    output: "sotdocs/opportunity_brief.md"
    upstream: []
    downstream: ["one_pager"]
```

### Proposed Config (v0.2.0+)

```yaml
default_scope: product

scopes:
  product:
    description: "Product-level strategic documents"
    documents:
      opportunity_brief:
        name: "Opportunity Brief"
        prompt: "prompts/product/opportunity_brief_prompt.md"
        template: "templates/product/opportunity_brief_template.md"
        output: "sotdocs/product/opportunity_brief.md"
        upstream: []
        downstream: ["one_pager"]

  feature:
    description: "Feature-level tactical documents"
    documents:
      feature_opportunity:
        name: "Feature Opportunity Brief"
        prompt: "prompts/feature/feature_opportunity_prompt.md"
        template: "templates/feature/feature_opportunity_template.md"
        output: "sotdocs/features/{feature_name}/opportunity.md"
        params: ["feature_name"]
        upstream: []
        downstream: ["feature_spec"]
        context_refs:
          - scope: product
            docs: ["prd", "sdd"]
            description: "Reference product docs for consistency"
```
