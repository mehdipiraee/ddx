# Test: DDX v2 Web Interface

## Test Cases

All tests use Given/When/Then format. Tests assume a running DDX server with sample documents and an empty or pre-populated project.

---

## Happy Path Tests

### Test 1.1: Dashboard Loads with All Documents
**Given** the web interface is open to the dashboard (`http://localhost:3000`)
**When** the page loads
**Then**
- [ ] All documents in the project are listed in a table/grid
- [ ] Each document shows: name, status (badge), last modified date
- [ ] Document count matches server count
- [ ] Status badges use correct colors (green for complete, blue for in-progress, gray for not started)
- [ ] "New Document" button is visible and clickable
- [ ] Page responds in <2 seconds

---

### Test 1.2: Dashboard Search Filters Documents
**Given** the dashboard has at least 5 documents
**When** user types a document name in the search bar
**Then**
- [ ] Results filter in real-time as user types
- [ ] Only documents matching the search term are displayed
- [ ] Clearing search shows all documents again
- [ ] Search is case-insensitive

---

### Test 1.3: Dashboard Status Filter Works
**Given** the dashboard has documents with different statuses
**When** user selects a status from the filter dropdown
**Then**
- [ ] Only documents with that status are shown
- [ ] Filtering works with search simultaneously
- [ ] "All" option shows all documents

---

### Test 1.4: Document Viewer Renders Markdown
**Given** user clicks "View" on a document with markdown content
**When** the document viewer loads
**Then**
- [ ] Document title and metadata are visible (status, created date, modified date)
- [ ] Markdown content is rendered correctly:
  - [ ] Headings (h1-h6) display with proper sizes
  - [ ] Bold and italic text formatted correctly
  - [ ] Lists (ordered and unordered) render properly
  - [ ] Code blocks display with syntax highlighting
  - [ ] Tables render with borders and proper alignment
  - [ ] Links are blue and clickable
- [ ] Internal links (to other documents) navigate to `/documents/:id`
- [ ] External links open in a new tab
- [ ] Page responds in <2 seconds

---

### Test 1.5: Document Viewer Shows Related Documents
**Given** user is viewing a document
**When** the page loads
**Then**
- [ ] "Related Documents" panel shows:
  - [ ] Documents that reference this one (dependents)
  - [ ] Documents this one references (dependencies)
- [ ] Each related document is a clickable link
- [ ] Clicking a related document navigates to its viewer

---

### Test 1.6: Document Viewer Navigation Works
**Given** user is viewing a document
**When** user clicks back button
**Then**
- [ ] User navigates back to previous page (browser history)

**When** user clicks previous/next buttons (if present)
**Then**
- [ ] Navigation cycles through documents in order

---

### Test 1.7: Document Creator Initiates Streaming
**Given** user navigates to `/create`
**When** user selects a phase (define, design, plan, mandate) and enters a prompt, then clicks "Create"
**Then**
- [ ] WebSocket connection is established (no errors in console)
- [ ] Request is sent to server
- [ ] Streaming begins immediately (spinner shows, or first token appears)
- [ ] Tokens display in real-time in the StreamDisplay area
- [ ] Tokens appear at >100 tokens/second (fast enough to see typing)
- [ ] No visible lag between token arrival and display

---

### Test 1.8: Document Creator Saves After Streaming
**Given** document creation streaming completes
**When** user clicks "Save"
**Then**
- [ ] Document is saved to the server
- [ ] User is redirected to the viewer page for the new document
- [ ] Document appears in the dashboard with correct status
- [ ] Document can be viewed and edited (re-created)

---

### Test 1.9: Streaming Preview Updates in Real-Time
**Given** document creation is streaming
**When** tokens arrive
**Then**
- [ ] Preview panel updates with rendered markdown (debounced)
- [ ] Headings, lists, code blocks render as they appear
- [ ] Preview does not lag significantly behind streaming

---

### Test 1.10: Dependency Graph Renders
**Given** user navigates to `/graph`
**When** page loads
**Then**
- [ ] Graph visualization displays
- [ ] Nodes represent documents
- [ ] Nodes are colored by status (green for complete, blue for in-progress, gray for not started)
- [ ] Edges represent dependencies
- [ ] Graph layout is readable (no overlapping nodes, reasonable spacing)
- [ ] Legend shows color meanings

---

### Test 1.11: Dependency Graph Interaction
**Given** user is viewing the dependency graph
**When** user clicks on a node
**Then**
- [ ] User navigates to `/documents/:id` for that document

**When** user hovers over a node
**Then**
- [ ] Related nodes (connected by edges) are highlighted

**When** user uses zoom controls
**Then**
- [ ] Graph zooms in/out correctly
- [ ] Mouse wheel scroll also zooms

**When** user drags the background
**Then**
- [ ] Graph pans smoothly

---

### Test 1.12: Dependency Graph Filtering
**Given** user is viewing the dependency graph
**When** user filters by status (e.g., show only "completed" documents)
**Then**
- [ ] Only nodes and edges for that status are visible
- [ ] Other nodes fade or disappear
- [ ] Clearing filter shows all nodes

---

### Test 1.13: Dashboard Delete Document
**Given** user clicks the delete button on a document in the dashboard
**When** confirmation modal appears and user clicks "Confirm"
**Then**
- [ ] Document is deleted from the server
- [ ] Document disappears from the dashboard
- [ ] Dashboard count updates

---

### Test 1.14: Cross-Interface Document Visibility
**Given** user creates a document via CLI (or skills/MCP)
**When** user views the web interface dashboard
**Then**
- [ ] Newly created document is visible in the list
- [ ] Document status is correct
- [ ] Document can be viewed and edited via web interface

**Given** user creates a document via web interface
**When** user checks the CLI
**Then**
- [ ] Document is visible via `ddx list` or similar command
- [ ] Document can be edited and viewed via CLI

---

## Input Validation Tests

### Test 2.1: Navigate to Non-Existent Document
**Given** user manually enters URL `/documents/nonexistent-id`
**When** page attempts to load
**Then**
- [ ] 404 error message is displayed
- [ ] User is offered option to go back to dashboard
- [ ] No console errors
- [ ] Page does not crash

---

### Test 2.2: Creator Phase Selection is Required
**Given** user is on the creator page
**When** user attempts to submit without selecting a phase
**Then**
- [ ] Form validation error is shown
- [ ] "Create" button is disabled or error message prevents submission

---

### Test 2.3: Creator Prompt is Required
**Given** user has selected a phase
**When** user clicks "Create" without entering a prompt
**Then**
- [ ] Validation error is shown
- [ ] Request is not sent

---

### Test 2.4: Search Handles Special Characters
**Given** user enters special characters (e.g., `@`, `#`, `$`) in search
**When** search executes
**Then**
- [ ] Search does not crash
- [ ] No results are shown (if special characters don't match document names)
- [ ] No error message (graceful handling)

---

## Failure Scenarios

### Test 3.1: Server Unavailable on Dashboard Load
**Given** the DDX server is stopped or unreachable
**When** user visits the dashboard
**Then**
- [ ] Error message is displayed: "Cannot connect to server"
- [ ] Retry button is provided
- [ ] Page does not crash or hang
- [ ] User can still navigate to other pages (if they were cached)

---

### Test 3.2: Server Unavailable on Document Load
**Given** user is viewing a document and the server stops
**When** related document fetch fails
**Then**
- [ ] Error message is shown in the related documents panel
- [ ] Main document content remains visible
- [ ] Retry button is provided

---

### Test 3.3: WebSocket Disconnect During Streaming
**Given** document creation is streaming
**When** WebSocket connection is lost (simulate with DevTools or server stop)
**Then**
- [ ] "Reconnecting..." indicator appears
- [ ] Streaming pauses (no new tokens display)
- [ ] On reconnection, streaming resumes from where it left off
- [ ] User is not required to restart the creation

---

### Test 3.4: WebSocket Reconnection Works
**Given** WebSocket is disconnected
**When** connection is re-established
**Then**
- [ ] Indicator changes from "Reconnecting..." to "Connected"
- [ ] Any pending messages are sent
- [ ] Streaming resumes without user intervention
- [ ] No data loss

---

### Test 3.5: LLM Error During Document Creation
**Given** document creation is initiated
**When** the LLM returns an error (e.g., rate limit, invalid prompt)
**Then**
- [ ] Error message is displayed: "Failed to create document: [error details]"
- [ ] Streaming stops
- [ ] "Retry" button allows user to resubmit
- [ ] "Cancel" button clears the interface

---

### Test 3.6: Network Timeout on API Call
**Given** user attempts to fetch documents
**When** API request times out (>30 seconds)
**Then**
- [ ] Timeout error is displayed
- [ ] Retry button is provided
- [ ] Page does not hang indefinitely

---

### Test 3.7: Server Error (500)
**Given** API request is made
**When** server returns 500 error
**Then**
- [ ] Error message is displayed
- [ ] Specific error details are shown (if available)
- [ ] Retry button is provided
- [ ] User can navigate away

---

## Edge Cases

### Test 4.1: Empty Project (No Documents)
**Given** a DDX project with no documents
**When** user visits the dashboard
**Then**
- [ ] Empty state message is displayed: "No documents yet. Create one to get started."
- [ ] "New Document" button is visible and clickable
- [ ] No errors or blank states without context

---

### Test 4.2: Very Long Document
**Given** a document with >10,000 words
**When** user opens the document viewer
**Then**
- [ ] Page loads without significant delay (<3 seconds)
- [ ] Scrolling is smooth
- [ ] Markdown renders correctly
- [ ] No performance degradation

---

### Test 4.3: Rapid Streaming Tokens
**Given** document creation is streaming
**When** LLM sends >100 tokens per second
**Then**
- [ ] Display keeps up with tokens (no visible lag)
- [ ] UI remains responsive
- [ ] No dropped tokens
- [ ] No memory leaks (page memory usage does not grow unbounded)

---

### Test 4.4: Large Dependency Graph (100+ Documents)
**Given** a project with 100+ documents and complex dependencies
**When** user opens the graph page
**Then**
- [ ] Graph loads within 3 seconds
- [ ] Graph renders without crashing
- [ ] Zoom/pan/filter operations are smooth
- [ ] No visible lag in interaction

---

### Test 4.5: Rapid Switching Between Pages
**Given** user is on the web interface
**When** user rapidly clicks between dashboard, viewer, creator, and graph pages
**Then**
- [ ] Pages load correctly
- [ ] No race conditions (old data overwrites new data)
- [ ] Pending requests are canceled if user navigates away
- [ ] No memory leaks or crashes

---

### Test 4.6: Document Created During User Session
**Given** user has dashboard open
**When** another user (or CLI) creates a new document in the project
**Then**
- [ ] Dashboard automatically refreshes (or after 5s polling)
- [ ] New document appears in the list
- [ ] Existing documents are not affected

---

### Test 4.7: Mobile/Tablet Responsiveness
**Given** user views the web interface on mobile (320px width) or tablet (768px width)
**When** pages load
**Then**
- [ ] Layout is responsive (single column on mobile, appropriate for tablet)
- [ ] Touch interactions work (tap, scroll, long-press)
- [ ] No horizontal scrolling required
- [ ] Buttons and links are large enough to tap
- [ ] Text is readable without zooming

---

### Test 4.8: Offline Mode
**Given** user is on the web interface with a cached page
**When** network is lost (SimulateOffline in DevTools)
**Then**
- [ ] Pages that were cached remain visible
- [ ] Error messages indicate offline status
- [ ] User can navigate between cached pages
- [ ] API calls show "offline" error, not timeout

---

### Test 4.9: Dark Mode Support (Optional)
**Given** user has dark mode enabled in OS settings
**When** user visits the web interface
**Then**
- [ ] Interface automatically switches to dark mode (if supported)
- [ ] Text and backgrounds are readable
- [ ] No contrast issues
- [ ] User can toggle dark mode in settings

---

## Integration Tests

### Test 5.1: CLI-Created Document Visible in Web Interface
**Given** user creates a document via DDX CLI
**When** user refreshes the web dashboard
**Then**
- [ ] Document appears in the list
- [ ] All metadata (title, status, date) is correct
- [ ] Document can be viewed and edited

---

### Test 5.2: Web-Created Document Visible in CLI
**Given** user creates a document via web interface
**When** user runs DDX CLI commands (e.g., `ddx list`)
**Then**
- [ ] Document appears in the list
- [ ] `ddx view <doc-id>` displays the document content
- [ ] Document can be updated via CLI

---

### Test 5.3: Dependency Graph Reflects CLI Changes
**Given** user updates a document via CLI (changing dependencies)
**When** user refreshes the graph page
**Then**
- [ ] Graph reflects the new dependencies
- [ ] Nodes are repositioned correctly
- [ ] No stale data

---

### Test 5.4: Validation Results from Web Match CLI
**Given** user runs validation via web interface
**When** validation completes
**Then**
- [ ] Results match `ddx validate` CLI output
- [ ] Issues are listed with affected documents
- [ ] Issues can be navigated to in document viewer

---

### Test 5.5: Cross-Mode Streaming Consistency
**Given** user creates a document via web interface with streaming
**When** document creation completes
**Then**
- [ ] Streamed content matches what would be generated via CLI
- [ ] No differences in formatting or structure

---

## Regression Tests

### Test 6.1: No Data Loss After Page Refresh
**Given** user is creating a document with streaming
**When** user refreshes the page mid-stream
**Then**
- [ ] If document is saved, it persists
- [ ] If document is not saved, user is warned before refresh
- [ ] Streamed content is not lost if already saved

---

### Test 6.2: Session Persistence Across Tabs
**Given** user has web interface open in two browser tabs
**When** user creates a document in tab 1
**Then**
- [ ] Tab 2 shows the new document after refresh
- [ ] No conflicts or duplication

---

### Test 6.3: Back Button Works Correctly
**Given** user navigates through multiple pages
**When** user clicks browser back button
**Then**
- [ ] Navigation history is correct
- [ ] Previous page content loads without making new API calls (if cached)
- [ ] Scroll position is restored (if applicable)

---

## Performance Tests

### Test 7.1: Dashboard Load Time
**Given** a project with 50 documents
**When** dashboard loads
**Then**
- [ ] Page is interactive in <2 seconds
- [ ] Document list is visible in <3 seconds
- [ ] Search is responsive (<100ms per keystroke)

---

### Test 7.2: Document Viewer Load Time
**Given** a document with 5,000 words
**When** document viewer loads
**Then**
- [ ] Page is interactive in <2 seconds
- [ ] Markdown rendering completes in <1 second
- [ ] Related documents panel populates in <1 second

---

### Test 7.3: Graph Rendering Performance
**Given** a project with 100 documents
**When** graph page loads
**Then**
- [ ] Graph renders in <3 seconds
- [ ] Zoom/pan operations have <100ms latency
- [ ] Filter operations complete in <500ms

---

### Test 7.4: Streaming Token Display Performance
**Given** document creation is streaming at 200 tokens/second
**When** tokens display
**Then**
- [ ] UI remains responsive (no jank, smooth scrolling)
- [ ] Token display latency <100ms
- [ ] CPU usage does not exceed 50% on a mid-range machine

---

## Accessibility Tests

### Test 8.1: Keyboard Navigation
**Given** user is on the web interface
**When** user navigates using only keyboard (Tab, Enter, arrow keys)
**Then**
- [ ] All buttons and links are reachable via Tab
- [ ] Focus ring is visible on all interactive elements
- [ ] Enter activates buttons
- [ ] Escape closes modals

---

### Test 8.2: Screen Reader Compatibility
**Given** user has a screen reader enabled (e.g., NVDA, JAWS)
**When** user navigates the web interface
**Then**
- [ ] Page headings are announced
- [ ] Images have alt text (if any)
- [ ] Form labels are associated with inputs
- [ ] No misleading or redundant announcements

---

### Test 8.3: Color Contrast
**Given** user is viewing the web interface
**When** examining text and backgrounds
**Then**
- [ ] All text has sufficient contrast ratio (>4.5:1 for normal text)
- [ ] Status colors are not the only way to convey information (labels also present)
- [ ] No color-only links

---

## Test Execution Plan

**Pre-Test Setup**:
1. Start DDX server (`npm start` in 001-core-engine)
2. Start web interface dev server (`npm run dev` in 005-web-interface) or build and serve (`npm run build`, then server static files)
3. Populate test project with 10-20 sample documents (via CLI or skills)
4. Clear browser cache and cookies
5. Open browser DevTools (F12) for error monitoring

**Test Execution**:
- Run happy path tests first (1.1-1.14) to verify baseline functionality
- Run input validation tests (2.1-2.4) to verify error handling
- Run failure scenario tests (3.1-3.7) with server/network simulation
- Run edge case tests (4.1-4.9) with various data and conditions
- Run integration tests (5.1-5.5) with CLI/skills/MCP
- Run regression and performance tests (6.1-7.4) in production build
- Run accessibility tests (8.1-8.3) with assistive technology

**Test Environment**:
- Browser: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Devices: Desktop (1920x1080), Laptop (1366x768), Tablet (768x1024), Mobile (375x667)
- Network: Broadband (fast), 4G (medium), 3G (slow, for timeout testing)

**Automation Approach**:
- Manual testing for happy path and user workflows (exploratory testing)
- Automated testing (Cypress, Playwright) for regression and performance
- Manual testing with screen reader for accessibility
