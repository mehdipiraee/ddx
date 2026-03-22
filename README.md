# DDX - Document Dependency eXchange

AI-human collaboration tool for maintaining source of truth documentation with bidirectional traceability.

## TL;DR

**Install DDX globally:**
```bash
cd ddx
npm install && npm run build && npm link
```

**Use in any project:**
```bash
cd my-project
ddx init                       # Scaffold DDX files
echo "ANTHROPIC_API_KEY=your_key" > .env

ddx create opportunity_brief   # AI guides you through questions
# Edit sotdocs/opportunity_brief.md
ddx continue opportunity_brief # AI reads your edits and continues

ddx create one_pager           # AI uses opportunity_brief as context
ddx check one_pager            # Check for conflicts with upstream/downstream docs
```

## What is DDX?

DDX streamlines collaboration between AI and humans to create and maintain a hierarchy of "source of truth" documents. It ensures consistency across your documentation (requirements, design specs, implementation) by tracking dependencies and automatically detecting drift.

## Features

- **Guided Document Creation**: AI guides you through structured document creation using customizable prompts and templates
- **Bidirectional Traceability**: Track dependencies between documents (opportunity brief → one pager → PRD → design → code)
- **Consistency Checking**: Automatically detect when changes in one document conflict with upstream/downstream documents
- **Workflow State Management**: Resume document creation workflows at any time
- **Extensible**: Add your own document types, prompts, and templates

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd ddx

# Install dependencies
npm install

# Build the project
npm run build

# Create .env file with your Anthropic API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# (Optional) Link for global usage
npm link
```

## Quick Start

### 1. List Available Document Types

```bash
ddx list
```

### 2. Create an Opportunity Brief

```bash
ddx create opportunity_brief
```

The AI will guide you through the creation process. After each AI response, you can:
- Edit the generated document directly in your editor
- Run `ddx continue opportunity_brief` to proceed

### 3. Continue the Workflow

```bash
ddx continue opportunity_brief
```

The AI will read your edits and continue the conversation.

### 4. Create Downstream Documents

Once your opportunity brief is complete, create a one-pager:

```bash
ddx create one_pager
```

DDX automatically reads the upstream document (opportunity_brief) and uses it as context.

### 5. Check Consistency

After making changes to a document, check for consistency issues:

```bash
ddx check one_pager
```

DDX will analyze both upstream and downstream documents for conflicts.

## Project Structure

```
ddx/
├── prompts/              # Prompt guides for each document type
│   ├── opportunity_brief_prompt.md
│   ├── one_pager_prompt.md
│   ├── prd_prompt.md
│   └── sdd_prompt.md
├── templates/            # Document templates
│   ├── opportunity_brief_template.md
│   ├── one_pager_template.md
│   ├── prd_template.md
│   └── sdd_template.md
├── sotdocs/              # Source of truth documents (generated)
│   ├── opportunity_brief.md
│   └── one_pager.md
├── src/                  # Source code
│   ├── cli.ts           # CLI entry point
│   ├── config.ts        # Configuration loader
│   ├── workflow.ts      # Workflow orchestration
│   ├── llm-client.ts    # Claude API client
│   ├── file-manager.ts  # File operations
│   └── state-manager.ts # State persistence
├── ddx.config.yaml      # Document type definitions
└── package.json
```

## Configuration

Edit `ddx.config.yaml` to:
- Add new document types
- Define dependencies between documents
- Configure LLM settings
- Customize output paths

Example:

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

## Commands

### `ddx init`

Initialize DDX in the current directory. Creates:
- `ddx.config.yaml` - Configuration file
- `prompts/` - Prompt guides for document types
- `templates/` - Document templates
- `sotdocs/` - Output directory for source of truth documents
- `.env.example` - API key template
- `.gitignore` - Adds DDX-specific ignores

**Options:**
- `-f, --force`: Overwrite existing files

### `ddx create <document-type>`

Start creating a new document. The AI will follow the prompt guide and interact with you to fill in the template.

### `ddx continue <document-type>`

Resume document creation after you've made edits. The AI reads your changes and proceeds with the next step.

**Options:**
- `-m, --message <message>`: Send a message to the AI along with your edits

### `ddx check <document-type>`

Check document consistency:
- **Upstream check**: Ensures your document doesn't deviate from upstream documents
- **Downstream check**: Ensures downstream documents implement your document's requirements

### `ddx list`

List all available document types with their dependencies.

## Workflow Example

```bash
# 0. Initialize DDX in your project
cd my-project
ddx init
echo "ANTHROPIC_API_KEY=your_key" > .env

# 1. Create opportunity brief
ddx create opportunity_brief
# AI asks questions, you respond by editing the file
# Edit sotdocs/opportunity_brief.md

# 2. Continue after editing
ddx continue opportunity_brief
# Repeat until complete

# 3. Create one-pager (reads opportunity_brief automatically)
ddx create one_pager
# Edit sotdocs/one_pager.md

# 4. Continue one-pager
ddx continue one_pager

# 5. Check consistency
ddx check one_pager

# 6. Create PRD
ddx create prd
```

## Customization

### Adding a New Document Type

1. Create prompt file: `prompts/my_doc_prompt.md`
2. Create template file: `templates/my_doc_template.md`
3. Add to `ddx.config.yaml`:

```yaml
documents:
  my_doc:
    name: "My Document"
    prompt: "prompts/my_doc_prompt.md"
    template: "templates/my_doc_template.md"
    output: "sotdocs/my_doc.md"
    upstream: ["prd"]
    downstream: []
```

### Writing Prompts

Prompts guide the AI through document creation. See existing prompts in `prompts/` for examples.

Key elements:
- **Goal**: What the document achieves
- **Mode**: Step-by-step instructions for the AI
- **Rules**: Constraints and formatting requirements

### Writing Templates

Templates define document structure. Use markdown with placeholder comments.

## Updating DDX

If you've installed DDX globally and there are updates:

```bash
cd /path/to/ddx       # Go to DDX source directory
npm run build         # Rebuild TypeScript

# That's it! The global ddx command now uses the new code
```

**Starting fresh in a project:**
```bash
cd my-project
rm -rf .ddx sotdocs/*  # Clear state and old docs
ddx create opportunity_brief  # Start fresh
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run locally
npm start -- create opportunity_brief
```

## How DDX Works

1. **Document Creation**: AI reads prompt + template + upstream documents → guides you through filling it out
2. **State Management**: Workflow state persisted in `.ddx/` directory
3. **Consistency Checking**: LLM analyzes documents semantically for conflicts (not rigid rule matching)
4. **Human in the Loop**: You always have final say - edit files directly, AI adapts

## Roadmap

- [x] MVP: 2 document types (opportunity_brief → one_pager)
- [ ] V1: Add PRD and system design documents
- [ ] V1: Multi-document consistency reports
- [ ] V1: Review/critique workflow with second AI agent
- [ ] V2: Code-level integration
- [ ] V2: Git hooks for automatic drift detection
- [ ] V3: Web interface

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
