# Plan: DDX v2 Web Interface

## Build Order

The web interface is built incrementally, with each phase enabling the next. Early phases establish infrastructure; later phases deliver user-facing features.

### Phase 1: React App Scaffold (Vite + TailwindCSS + Routing)
**Deliverables**: Working dev environment, basic layout, routing structure

**Tasks**:
1. Initialize Vite project (`npm create vite@latest`)
2. Install dependencies:
   - react, react-dom
   - react-router-dom
   - tailwindcss, autoprefixer, postcss
   - axios (HTTP client)
3. Configure Vite:
   - vite.config.ts (React plugin, development server settings)
   - Environment variables for API base URL
4. Set up TailwindCSS:
   - tailwind.config.ts with color palette
   - globals.css with Tailwind directives
5. Create project structure:
   - src/pages (Dashboard, Viewer, Creator, Graph)
   - src/components (reusable UI components)
   - src/api (client modules)
   - src/App.tsx (router setup)
   - src/main.tsx (entry point)
6. Create Layout component:
   - Header with navigation links
   - Optional sidebar
   - Main content area with responsive layout
7. Implement basic routing:
   - / → Dashboard
   - /documents/:id → Viewer
   - /create → Creator
   - /graph → Graph
   - Catch-all 404 page
8. Placeholder pages (empty, render layout only)

**Definition of Done**:
- `npm run dev` starts dev server successfully
- All 4 main routes are accessible
- Layout renders correctly on desktop and mobile
- No TypeScript or build errors

---

### Phase 2: REST API Client Module
**Deliverables**: Typed HTTP client, API error handling, request/response utilities

**Tasks**:
1. Create `src/api/rest.ts`:
   - Base client setup (axios or fetch wrapper)
   - Environment variable for API base URL (default: http://localhost:3001/api)
2. Implement CRUD endpoints:
   - `listDocuments()` → GET /api/documents
   - `getDocument(id)` → GET /api/documents/:id
   - `createDocument(payload)` → POST /api/documents
   - `updateDocument(id, patch)` → PATCH /api/documents/:id
   - `deleteDocument(id)` → DELETE /api/documents/:id
3. Implement graph/capability endpoints:
   - `getProjectGraph()` → GET /api/graph
   - `listCapabilities()` → GET /api/capabilities
   - `validateProject()` → POST /api/validate
4. Error handling:
   - Catch and normalize errors (network, 4xx, 5xx)
   - Return typed error objects with code and message
5. Create TypeScript interfaces:
   - Document, Capability, GraphNode, GraphEdge, ValidationResult
6. Create utility functions:
   - formatDate(timestamp): format document dates
   - getStatusColor(status): map status to Tailwind color class
7. Add logging (development only, disabled in production)

**Definition of Done**:
- All 8 API functions are type-safe and tested manually via console
- Error responses are normalized
- API base URL is configurable via environment variable
- No API calls fail unexpectedly (proper error boundaries)

---

### Phase 3: WebSocket Client Module
**Deliverables**: Streaming connection management, token handling, reconnection logic

**Tasks**:
1. Create `src/api/websocket.ts`:
   - WebSocketClient class with connection state management
   - Environment variable for WebSocket URL (default: ws://localhost:3001)
2. Implement core methods:
   - `connect()` → establish connection
   - `disconnect()` → close gracefully
   - `createDocumentStream(payload)` → send creation request, stream response
   - `reconnect()` → re-establish after disconnect
3. Implement event system:
   - `on(event, callback)` for 'token', 'done', 'error', 'connected', 'disconnected'
   - `off(event, callback)` to remove listeners
4. Implement resilience:
   - Automatic reconnection with exponential backoff (1s, 2s, 4s, max 30s)
   - Message queue for events sent while disconnected
   - Connection state exposed to UI (connecting, connected, disconnected, error)
5. Token buffering:
   - Batch small tokens for performance (buffer 100ms or 20 tokens)
   - Prevent rapid DOM updates during high-frequency streaming
6. Error handling:
   - Distinguish network errors from application errors
   - Expose error state to UI for user feedback

**Definition of Done**:
- WebSocket connects and receives messages successfully
- Token events are queued and fired in order
- Reconnection works after network disconnect (simulate with browser dev tools)
- No memory leaks (proper cleanup in disconnect)
- Works offline without crashing

---

### Phase 4: Dashboard Page (Document List, Status Indicators)
**Deliverables**: Main page showing all documents with actions, functional search/filter

**Tasks**:
1. Create Dashboard page component (`src/pages/Dashboard.tsx`)
2. Create DocumentList component:
   - Table/grid layout of documents (responsive)
   - Columns: name, status (badge), last modified, actions
3. Create DocumentRow component:
   - Renders single document in list
   - Status badge with color (green/blue/gray/red)
4. Create ActionButtons component:
   - View button (navigate to viewer)
   - Edit button (navigate to creator with prefill)
   - Delete button (with confirmation modal)
5. Create QuickStats component:
   - Total document count
   - Completed count
   - In-progress count
   - Not started count
6. Implement search/filter:
   - Text search by name/title
   - Filter by status dropdown
   - Real-time results as user types
7. Create "New Document" button:
   - Navigates to /create
8. Implement loading state:
   - Spinner while fetching documents
   - Error message if fetch fails
9. Implement real-time updates:
   - Refetch documents on interval (5s) or on page focus
   - Use `RestClient.listDocuments()` from Phase 2
10. Create DeleteConfirmModal component:
    - Confirm before delete
    - Refetch list after successful delete

**Definition of Done**:
- Dashboard loads and displays all documents
- Search filters documents in real-time
- Status filter works
- View/Edit/Delete buttons are clickable
- Error states are handled gracefully
- Layout is responsive (mobile, tablet, desktop)
- No console errors

---

### Phase 5: Document Viewer Page (Markdown Rendering)
**Deliverables**: Document display with markdown, metadata, related documents

**Tasks**:
1. Create Viewer page component (`src/pages/Viewer.tsx`)
2. Extract document ID from URL params
3. Fetch document using `RestClient.getDocument(id)`
4. Create DocumentHeader component:
   - Title
   - Status badge
   - Created date, last modified date
   - Copy ID button
   - Breadcrumb navigation (if applicable)
5. Create MarkdownRenderer component:
   - Parse and render markdown using react-markdown library
   - Support: h1-h6, paragraphs, lists, code blocks, tables, links, bold, italic
   - Syntax highlighting for code blocks (use highlight.js or prism)
   - Link handling: internal (navigate to /documents/:id) vs external (new tab)
6. Create RelatedDocumentsPanel component:
   - Fetch graph data using `RestClient.getProjectGraph()`
   - Show documents that reference this one
   - Show documents this one references
   - Clickable navigation to related documents
7. Implement back/previous navigation:
   - Back button (history)
   - Previous/next buttons (in document order)
8. Implement error handling:
   - 404 → redirect to dashboard with message
   - Network error → show error message, retry button
9. Implement loading state:
   - Skeleton loader while fetching
10. Responsive layout:
    - Single column on mobile, two columns (content + sidebar) on desktop

**Definition of Done**:
- Document loads and displays correctly
- Markdown renders without errors (headings, lists, code blocks, links)
- Related documents are clickable and navigate correctly
- Metadata is displayed
- 404 errors are handled
- Responsive on all screen sizes
- No console errors

---

### Phase 6: Document Creator Page (Chat Interface, Streaming Display)
**Deliverables**: Guided document creation with real-time streaming responses

**Tasks**:
1. Create Creator page component (`src/pages/Creator.tsx`)
2. Create PhaseSelector component:
   - 4 buttons/tabs: mandate, define, design, plan
   - Selected phase stored in state
   - Each phase has different prompt guidance (optional)
3. Create ChatInterface component:
   - Chat message display area (similar to ChatGPT)
   - Input field at bottom
   - Messages alternate: user prompt, assistant response
4. Create StreamDisplay component:
   - Display area for tokens as they arrive
   - Connected to WebSocketClient (Phase 3)
   - Renders tokens with word wrapping
5. Create PreviewPanel component:
   - Shows generated markdown preview
   - Markdown rendered using component from Phase 5
   - Below chat area
6. Implement document creation flow:
   - User fills phase and enters prompt
   - Click "Create" button
   - WebSocketClient.createDocumentStream(payload) called
   - Listen for 'token' events, append to StreamDisplay
   - Listen for 'done' event → document created
   - Auto-save document
   - Redirect to viewer or show success message
7. Implement error handling:
   - LLM error → show error message, allow retry
   - Network error (WebSocket disconnect) → show reconnecting indicator
   - Auto-retry on reconnection
8. Implement markdown preview:
   - Update preview as tokens arrive (debounced)
   - Syntax highlighting in preview
9. Create SaveButton:
   - Enabled only when content generated
   - Disabled during streaming
10. Implement cancel flow:
    - Cancel button clears state, redirects to dashboard or creator

**Definition of Done**:
- Creator page loads without errors
- Phase selector works
- Document creation sends request successfully
- Streaming tokens display in real-time
- Preview updates as tokens arrive
- Save works after streaming completes
- Error handling works (LLM error, network disconnect)
- Responsive layout
- No console errors

---

### Phase 7: Dependency Graph Visualization
**Deliverables**: Interactive graph of document relationships with filtering

**Tasks**:
1. Create Graph page component (`src/pages/Graph.tsx`)
2. Choose visualization library:
   - Option A: D3.js (powerful, steep learning curve)
   - Option B: vis.js (easier, good for network graphs)
   - Option C: Cytoscape.js (good balance)
   - Recommendation: Start with vis.js or Cytoscape for speed
3. Fetch graph data:
   - `RestClient.getProjectGraph()` → returns nodes and edges
4. Create GraphVisualization component:
   - Render nodes (documents) with status color
   - Render edges (dependencies) as lines
   - Node size scales with complexity (optional)
5. Implement interaction:
   - Click node → navigate to document viewer
   - Hover node → highlight related nodes
   - Drag to pan
6. Implement controls:
   - Zoom in/out (mouse wheel, buttons)
   - Pan (drag background)
   - Fit to view button
   - Reset button
7. Create Legend component:
   - Color meanings (completed, in-progress, not started, error)
   - Node size explanation
8. Implement filtering:
   - Filter by capability (optional at launch, can add later)
   - Filter by status
   - Filter by search term
9. Implement responsive layout:
   - Full viewport height/width
   - Graph scales on smaller screens
10. Implement loading state:
    - Show spinner while loading graph data

**Definition of Done**:
- Graph loads without errors
- Nodes and edges render correctly
- Clicking node navigates to document
- Zoom and pan work smoothly
- Layout is responsive
- Legend is visible and clear
- No console errors

---

### Phase 8: Express Static Serving Integration (Serve React Build from DDX Server)
**Deliverables**: React build served by 001-core-engine, production-ready deployment

**Tasks**:
1. Build React app:
   - `npm run build` → outputs to `dist/`
2. Configure Express server (001-core-engine):
   - Add middleware to serve React build: `express.static('path/to/dist')`
   - Route all non-API requests to `index.html` (SPA routing)
3. Update server configuration:
   - Ensure CORS is not blocking React requests to API
   - Set correct base URL for API in React build (via build-time variables)
4. Test production build:
   - `npm run build` in React app
   - Start Express server
   - Visit http://localhost:3000
   - Verify all routes load correctly
   - Verify API calls work
   - Verify WebSocket works
5. Create deployment documentation:
   - Build instructions
   - Environment variable setup
   - Port configuration
6. Optimize build:
   - Code splitting (lazy load pages)
   - Tree-shaking for unused code
   - Asset minification
   - Source maps for debugging

**Definition of Done**:
- React app builds without errors
- Express serves React build at /
- All routes are accessible
- API endpoints work from production build
- WebSocket works in production
- No 404 errors for React routes
- Performance is acceptable (pages load in <2s)
- Production build is smaller than dev build

---

## Dependencies Between Phases

- **Phase 1** must complete before all others (foundation)
- **Phase 2** and **Phase 3** are independent; can parallelize
- **Phase 4** requires Phase 1 and Phase 2
- **Phase 5** requires Phase 1, Phase 2, and Phase 4 (for routing/layout)
- **Phase 6** requires Phase 1, Phase 2, Phase 3, and Phase 5
- **Phase 7** requires Phase 1, Phase 2, and Phase 4
- **Phase 8** requires all previous phases complete

**Recommended Execution Order**: 1 → (2, 3 in parallel) → 4 → 5 → 6 → 7 → 8

## Estimated Timeline

| Phase | Tasks | Estimated Duration |
|-------|-------|-------------------|
| 1 | React setup, layout, routing | 1 day |
| 2 | REST client, types, error handling | 1 day |
| 3 | WebSocket client, reconnection, resilience | 1 day |
| 4 | Dashboard list, search, filters, actions | 2 days |
| 5 | Viewer, markdown, metadata, related docs | 2 days |
| 6 | Creator, chat, streaming, preview | 2 days |
| 7 | Graph visualization, interaction, filtering | 2 days |
| 8 | Build integration, optimization, deployment | 1 day |
| **Total** | | **12 days** |

Timeline assumes 1 developer, 8 hours/day, no interruptions. Adjust based on team size and priorities.

## Success Criteria

- All 4 main pages are functional (Dashboard, Viewer, Creator, Graph)
- Documents created via web interface are visible in CLI and other interfaces
- Documents created via CLI/skills/MCP are visible in web interface
- Real-time streaming works without lag
- Error handling is graceful (no silent failures)
- Responsive layout works on desktop, tablet, mobile
- No console errors or warnings in production build
- WebSocket reconnection is transparent to user
- Performance is acceptable (page load <2s, interactions <100ms)
