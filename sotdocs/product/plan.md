# Plan: DDX v2

## Build Order

DDX v2 is decomposed into 5 capabilities, built in progressive complexity. The core engine must work before any client mode is added. Each client mode is a thin layer over the same server.

### Capability Sequence

| Order | Capability | Builds On | Testable Outcome |
|-------|-----------|-----------|-----------------|
| 001 | Core Engine | Nothing | Server starts, API responds, documents can be created/read via HTTP |
| 002 | CLI Interface | 001 | `ddx define`, `ddx design`, etc. work from terminal |
| 003 | Claude Skills | 001 | Skills trigger correctly and produce documents via server API |
| 004 | MCP Server | 001 | MCP tools callable from Claude Code / MCP clients |
| 005 | Web Interface | 001 | Browser UI for document management and creation |

### Progressive Complexity Rationale

**001-core-engine** is the foundation. Every other capability is a thin client that calls the server. If the server works, adding clients is incremental. If the server is broken, nothing else matters.

**002-cli-interface** is the simplest client. Direct process-to-server communication. No protocol translation. This validates that the server API is usable before adding more complex clients.

**003-claude-skills** is next because skills are the primary use case for conversational DDX. They enable the "documentation as side effect of conversation" philosophy. Skills call the server's HTTP API — same as CLI but triggered by natural language.

**004-mcp-server** adds protocol translation (stdio + JSON-RPC). More complex than HTTP clients but enables integration with Claude Code, VS Code, and other MCP hosts.

**005-web-interface** is last because it's the most complex client (React SPA, WebSocket, real-time streaming) and serves the broadest audience (non-technical stakeholders). Build it after the server API is proven stable.

## Verification

After all 5 capabilities are built:

1. Start the DDX server
2. Run `ddx mandate` from CLI → mandate.md created
3. Run `ddx define` from CLI → product/define.md created
4. Trigger `ddx-define` skill from Claude → capability define.md created
5. Call `ddx_design` MCP tool → capability design.md created
6. Open web UI → see all documents, create new ones
7. All operations produce consistent documents regardless of which client mode was used
8. Full test suite passes across all capabilities
