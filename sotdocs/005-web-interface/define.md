# Define: DDX v2 Web Interface

## What It Does

The DDX v2 Web Interface is a browser-based React single-page application (SPA) that provides a graphical interface for document management, creation, and visualization. It exposes the same DDX capabilities available through the CLI and programmatic APIs, but optimized for non-technical stakeholders, product managers, and developers who prefer visual workflows.

Core capabilities:
- **Dashboard**: Centralized view of all DDX documents with real-time status indicators
- **Document Viewer**: Read any DDX document with full markdown rendering and metadata display
- **Document Creator**: Guided workflow for creating documents through a chat-like interface with real-time streaming responses
- **Dependency Graph**: Visual representation of document relationships, status, and completeness
- **Capability Status**: Display of capability definitions, designs, plans, and build status across the project
- **Consistency Checker Results**: Results from validation and consistency checks against the current DDX project

## Who Uses It

- **Product Managers**: Non-technical stakeholders who need to view project status, documents, and dependencies without CLI knowledge
- **Technical Leads**: Developers who prefer UI-based workflows for creating and managing documents
- **Stakeholders**: Team members across non-engineering roles who need read access to DDX documentation
- **Developers**: Engineering teams who want to visualize project structure and dependencies

## Acceptance Criteria

### Dashboard
- [ ] Displays all DDX documents from the current project
- [ ] Shows document status (defined, designed, planned, built)
- [ ] Real-time updates when documents are created or modified
- [ ] Responsive layout on desktop and tablet screens
- [ ] Search/filter capability by document name or status

### Document Viewer
- [ ] Renders DDX documents with full markdown support (headings, lists, code blocks, links, tables)
- [ ] Displays document metadata (created date, last modified, status)
- [ ] Navigation between related documents via dependency links
- [ ] Readable typography and layout on all screen sizes

### Document Creator
- [ ] Guided flow supports mandate, define, design, and plan phases
- [ ] Chat-like interface for natural interaction
- [ ] Real-time streaming display of LLM responses (token-by-token)
- [ ] Document saved automatically when creation completes
- [ ] Error handling for failed requests with retry capability

### Dependency Graph
- [ ] Visual representation of document relationships
- [ ] Color-coded status indicators (completed, in-progress, not started)
- [ ] Interactive: click to navigate to documents
- [ ] Renders correctly for projects with 1-100+ documents

### Capability List
- [ ] Displays all DDX capabilities with current status
- [ ] Status indicators show defined, designed, planned, built states
- [ ] Linked to corresponding capability documents
- [ ] Responsive layout

### Consistency Check Results
- [ ] Displays validation results in a readable format
- [ ] Shows affected documents and specific issues
- [ ] Allows navigation to problematic documents for correction

## Technical Constraints

- Runs as React SPA served by the DDX Express server (001-core-engine)
- Uses WebSocket for real-time streaming responses from LLM
- Uses REST API endpoints exposed by 001-core-engine (no special backend logic needed)
- No authentication at launch (assumes trusted local network)
- Localhost default (`http://localhost:3000`)
- Must work offline (graceful degradation when server unavailable)
- Styling via TailwindCSS for rapid development and consistency

## Out of Scope

- User authentication and authorization (v2 launch)
- Multi-user collaboration (single-user at launch)
- Document export to external formats
- Advanced rich-text editing (markdown input only)
- Analytics or audit logging
