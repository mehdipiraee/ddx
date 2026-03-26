# DDX v2 MCP Server — Define

## What This Does

The DDX v2 MCP Server exposes the DDX platform as a set of Model Context Protocol tools and resources. This enables:
- Claude Code users to run DDX operations within the Claude interface
- VS Code extension users to integrate DDX workflows into their editor
- Any MCP-compatible client to access DDX capabilities programmatically

The server acts as a thin protocol adapter: it receives MCP requests via stdio (JSON-RPC 2.0), translates them to HTTP calls against the DDX core server, and returns results in MCP format.

## Who Uses This

1. **Claude Code Users**: Run DDX commands directly within Claude's chat context to define, design, plan, and build products
2. **VS Code Extension Users**: Access DDX tools from the command palette and sidebar
3. **MCP Client Developers**: Integrate DDX into custom applications that speak MCP
4. **CI/CD Pipelines**: Programmatic access to DDX operations for automated workflows

## Capabilities Exposed

Nine MCP tools:
- `ddx_mandate` — Create or update a project mandate
- `ddx_define` — Define a product or capability
- `ddx_design` — Design a product or capability
- `ddx_plan` — Plan implementation
- `ddx_build` — Execute a build
- `ddx_derive` — Reverse-engineer docs from code
- `ddx_list` — List all DDX documents
- `ddx_check` — Run consistency check
- `ddx_read` — Read a specific DDX document

One MCP resource type:
- `ddx://documents/{path}` — Access any DDX document by path

## Acceptance Criteria

- [ ] All 9 tools are callable and return proper MCP responses
- [ ] Resources at `ddx://documents/{path}` are readable by MCP clients
- [ ] Tool schemas are valid JSON Schema and match tool parameter requirements
- [ ] Tool parameter validation rejects invalid inputs with clear error messages
- [ ] HTTP errors from the DDX server are translated to proper JSON-RPC 2.0 error objects
- [ ] MCP server communicates via stdio with JSON-RPC 2.0 (no TCP, no WebSocket)
- [ ] Server works with Claude Code (via @modelcontextprotocol/sdk)
- [ ] Server works with VS Code MCP extension
- [ ] Streaming tool responses (e.g., from LLMs in `ddx_design`) map correctly to MCP response format

