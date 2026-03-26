# Design: DDX v2 Web Interface

## Architecture Overview

The web interface is a React SPA that communicates with the DDX server (001-core-engine) via REST API and WebSocket.

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (localhost:3000)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  React SPA (Vite + TailwindCSS)                       │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ Pages: Dashboard, Viewer, Creator, Graph      │   │  │
│  │  │ Components: StatusIndicators, Markdown,       │   │  │
│  │  │            ChatInterface, StreamDisplay       │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ Clients:                                       │   │  │
│  │  │ - RestClient (documents, capabilities, graph) │   │  │
│  │  │ - WebSocketClient (streaming responses)       │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │ REST API              │ WebSocket
         ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│         DDX Server (001-core-engine, Express)               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ /api/documents (GET, POST)                            │  │
│  │ /api/documents/:id (GET, PATCH, DELETE)              │  │
│  │ /api/capabilities (GET)                              │  │
│  │ /api/graph (GET)                                     │  │
│  │ /api/validate (POST)                                 │  │
│  │ /ws (WebSocket for streaming)                        │  │
│  │ / (Static serving of React build)                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
    DDX Project Files
    (002-cli, 003-skills, 004-mcp, 005-web-interface)
```

## Page Structure

### Dashboard Page
- **Route**: `/`
- **Purpose**: Overview of all DDX documents and project status
- **Content**:
  - List of all documents with columns: name, status, last modified, actions
  - Quick stats: total documents, completed, in-progress, missing
  - Search/filter bar
  - "New Document" button
  - Action buttons per row: view, edit (launch creator), delete
  - Status indicators with color coding

### Document Viewer Page
- **Route**: `/documents/:id`
- **Purpose**: Read-only display of a single DDX document
- **Content**:
  - Document metadata (title, status, created date, modified date)
  - Full document content rendered as markdown
  - Related documents (dependencies/dependents) as clickable links
  - Breadcrumb navigation
  - Back/next document navigation
  - Copy document ID button

### Document Creator Page
- **Route**: `/create`
- **Purpose**: Guided workflow to create new documents
- **Content**:
  - Phase selector (mandate, define, design, plan)
  - Chat-like interface for interaction
  - Streaming response display area
  - Generated markdown preview (below chat)
  - Save button (enabled when content generated)
  - Cancel button

### Dependency Graph Page
- **Route**: `/graph`
- **Purpose**: Visual representation of document relationships
- **Content**:
  - Interactive graph visualization (canvas or SVG-based)
  - Nodes for each document with status color
  - Edges showing dependencies
  - Node click → navigate to document viewer
  - Legend: colors for status, node size for complexity
  - Zoom/pan controls
  - Filter by capability or status

## Component Hierarchy

```
App
├── Layout
│   ├── Header (logo, nav links, status indicator)
│   └── Sidebar (optional, collapsible)
├── Router
│   ├── Dashboard Page
│   │   ├── DocumentList
│   │   │   ├── DocumentRow
│   │   │   │   └── StatusBadge
│   │   │   └── ActionButtons
│   │   └── QuickStats
│   ├── Viewer Page
│   │   ├── DocumentHeader
│   │   ├── MarkdownRenderer
│   │   └── RelatedDocumentsPanel
│   ├── Creator Page
│   │   ├── PhaseSelector
│   │   ├── ChatInterface
│   │   │   ├── MessageList
│   │   │   └── InputField
│   │   ├── StreamDisplay
│   │   └── PreviewPanel
│   └── Graph Page
│       ├── GraphVisualization
│       ├── Controls (zoom, pan, filter)
│       └── Legend
└── ErrorBoundary
```

## Client Modules

### RestClient (`src/api/rest.ts`)
Encapsulates all REST API calls:
```
GET    /api/documents              → listDocuments()
POST   /api/documents              → createDocument(data)
GET    /api/documents/:id          → getDocument(id)
PATCH  /api/documents/:id          → updateDocument(id, patch)
DELETE /api/documents/:id          → deleteDocument(id)
GET    /api/capabilities           → listCapabilities()
GET    /api/graph                  → getProjectGraph()
POST   /api/validate               → validateProject()
GET    /api/documents/:id/markdown → getDocumentMarkdown(id)
```

Error handling: wraps fetch calls, provides typed responses, handles network errors gracefully.

### WebSocketClient (`src/api/websocket.ts`)
Manages streaming responses for document creation:
```
connect()                  → establish connection
disconnect()               → close connection
createDocumentStream(payload) → send creation request, stream response
on('token', callback)      → listen for streamed tokens
on('done', callback)       → listen for completion
on('error', callback)      → listen for errors
reconnect()                → auto-reconnect on disconnect
```

Handles:
- Connection state management
- Automatic reconnection with exponential backoff
- Message queuing during disconnection
- Token buffering for display (batch small tokens for performance)

## WebSocket Event Handling

**Client → Server**:
```json
{
  "type": "create-document",
  "phase": "define",
  "mandate": "...",
  "context": "..."
}
```

**Server → Client** (streaming):
```json
{"type": "token", "data": "text chunk"}
{"type": "done", "data": {"id": "doc-123", "content": "..."}}
{"type": "error", "data": "error message"}
```

**Reconnection**: Client reconnects automatically if WebSocket closes. In-progress streams resume from server state.

## REST Endpoint Mapping

| Feature | Endpoint | Method |
|---------|----------|--------|
| List all documents | `/api/documents` | GET |
| Create document | `/api/documents` | POST |
| View document | `/api/documents/:id` | GET |
| Update document | `/api/documents/:id` | PATCH |
| Delete document | `/api/documents/:id` | DELETE |
| Get capabilities | `/api/capabilities` | GET |
| Get dependency graph | `/api/graph` | GET |
| Run validation | `/api/validate` | POST |
| Streaming creation | `/ws` | WebSocket |

All endpoints assume JSON request/response bodies. Document IDs are UUIDs or slugs based on title.

## Styling Approach

**TailwindCSS** for rapid styling without custom CSS files:
- Color scheme: light mode (gray-50 to gray-900 palette) with dark mode support
- Spacing: consistent 4px base unit
- Typography: system font stack, sizes for h1-h6, body, code
- Components: use Tailwind utilities directly in JSX (no component library at launch)
- Responsive: mobile-first, breakpoints at sm (640px), md (768px), lg (1024px)
- Status colors: green (complete), blue (in-progress), gray (not started), red (error)

**Layout**:
- Max width: 1200px for dashboard and viewer
- Sidebar (optional): 250px fixed or collapsible
- Dashboard: grid layout (2-3 columns on desktop, 1 on mobile)
- Graph: full viewport width/height with aspect ratio maintained

**Interactive States**:
- Hover: subtle background change, cursor pointer for clickable elements
- Focus: ring outline for keyboard navigation
- Active: color change for selected items
- Disabled: 50% opacity, no pointer

## Data Flow

1. **Dashboard load**: 
   - RestClient.listDocuments() → render DocumentList
   - RestClient.listCapabilities() → render capability stats

2. **Document view**:
   - RestClient.getDocument(id) → render MarkdownRenderer
   - RestClient.getProjectGraph() → render related documents

3. **Create document**:
   - User selects phase, enters prompt
   - WebSocketClient.createDocumentStream(payload)
   - Listen for 'token' events, append to display in real-time
   - Listen for 'done' event, save document, redirect to viewer

4. **Graph view**:
   - RestClient.getProjectGraph() → render visualization
   - Click node → RestClient.getDocument(id) → navigate to viewer

## Error Handling

- Network errors: show toast notification, provide retry button
- 404 (document not found): redirect to dashboard with message
- 500 (server error): show error page, suggest restart
- WebSocket disconnect: auto-reconnect with spinner, show status
- Validation errors (missing fields): highlight inputs, show error message
- LLM failure during creation: show error, allow retry or cancel

## Browser Compatibility

Target: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
Features used: ES2020, fetch, WebSocket, CSS Grid, CSS Custom Properties
No polyfills needed at launch.

## Build & Deployment

- **Dev**: `npm run dev` → Vite dev server on localhost:5173
- **Prod**: `npm run build` → outputs to `dist/`
- **Serving**: DDX server (001-core-engine) serves React build from `/dist` on `/` route
- **Static files**: images, fonts served from `public/` directory
