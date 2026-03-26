# DDX v2 MCP Server — Design

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ MCP Clients (Claude Code, VS Code, other MCP-compatible apps)  │
└────────────────────────────┬────────────────────────────────────┘
                             │ stdio (JSON-RPC 2.0)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ DDX v2 MCP Server (@modelcontextprotocol/sdk)                  │
│  • Listens on stdin, writes to stdout                           │
│  • Dispatches RPC calls to tool/resource handlers               │
│  • Translates between MCP protocol and HTTP API                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ DDX Core Server (HTTP API)                                      │
│  • POST /mandate                                                │
│  • POST /define                                                 │
│  • POST /design                                                 │
│  • POST /plan                                                   │
│  • POST /build                                                  │
│  • POST /derive                                                 │
│  • GET  /list                                                   │
│  • POST /check                                                  │
│  • GET  /document/{path}                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Tool Definitions with JSON Schema

### ddx_mandate

Create or update a project mandate.

```json
{
  "name": "ddx_mandate",
  "description": "Create or update a project mandate. A mandate defines the purpose, scope, and constraints of the project.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": {
        "type": "string",
        "description": "Unique identifier for the project"
      },
      "mandate_content": {
        "type": "string",
        "description": "The mandate text: purpose, scope, constraints, stakeholders, success criteria"
      },
      "update_if_exists": {
        "type": "boolean",
        "default": false,
        "description": "If true, update existing mandate; if false, fail if mandate exists"
      }
    },
    "required": ["project_id", "mandate_content"]
  }
}
```

**Maps to HTTP**: `POST /mandate`  
**Request body**: `{ project_id, mandate_content, update_if_exists }`  
**Response**: `{ success: boolean, mandate_path: string, message: string }`

---

### ddx_define

Define a product or capability.

```json
{
  "name": "ddx_define",
  "description": "Define a product or capability. Captures what exists, who uses it, and how it creates value.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": {
        "type": "string",
        "description": "Project ID"
      },
      "capability_name": {
        "type": "string",
        "description": "Name of the capability to define"
      },
      "definition_content": {
        "type": "string",
        "description": "Definition: what it is, who uses it, what problems it solves, dependencies"
      },
      "parent_capability": {
        "type": "string",
        "description": "Optional: parent capability for hierarchical organization"
      }
    },
    "required": ["project_id", "capability_name", "definition_content"]
  }
}
```

**Maps to HTTP**: `POST /define`  
**Request body**: `{ project_id, capability_name, definition_content, parent_capability }`  
**Response**: `{ success: boolean, definition_path: string, message: string }`

---

### ddx_design

Design a product or capability.

```json
{
  "name": "ddx_design",
  "description": "Design a product or capability. Captures architecture, interfaces, constraints, and implementation details.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": {
        "type": "string",
        "description": "Project ID"
      },
      "capability_name": {
        "type": "string",
        "description": "Name of the capability to design"
      },
      "design_content": {
        "type": "string",
        "description": "Design document: architecture, interfaces, constraints, trade-offs, implementation notes"
      }
    },
    "required": ["project_id", "capability_name", "design_content"]
  }
}
```

**Maps to HTTP**: `POST /design`  
**Request body**: `{ project_id, capability_name, design_content }`  
**Response**: `{ success: boolean, design_path: string, message: string }`  
**Note**: May stream responses if DDX core uses LLM-assisted design.

---

### ddx_plan

Plan implementation of a capability.

```json
{
  "name": "ddx_plan",
  "description": "Plan the implementation of a capability. Breaks down work into phases, tasks, and milestones.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": {
        "type": "string",
        "description": "Project ID"
      },
      "capability_name": {
        "type": "string",
        "description": "Name of the capability to plan"
      },
      "plan_content": {
        "type": "string",
        "description": "Implementation plan: phases, tasks, dependencies, timeline, resource requirements"
      }
    },
    "required": ["project_id", "capability_name", "plan_content"]
  }
}
```

**Maps to HTTP**: `POST /plan`  
**Request body**: `{ project_id, capability_name, plan_content }`  
**Response**: `{ success: boolean, plan_path: string, message: string }`

---

### ddx_build

Execute a build.

```json
{
  "name": "ddx_build",
  "description": "Execute a build. Runs the implementation plan and produces artifacts.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": {
        "type": "string",
        "description": "Project ID"
      },
      "capability_name": {
        "type": "string",
        "description": "Name of the capability to build"
      },
      "build_config": {
        "type": "object",
        "description": "Build configuration (tool-specific, e.g., compiler flags, environment variables)",
        "additionalProperties": true
      }
    },
    "required": ["project_id", "capability_name"]
  }
}
```

**Maps to HTTP**: `POST /build`  
**Request body**: `{ project_id, capability_name, build_config }`  
**Response**: `{ success: boolean, build_artifacts: [string], build_log: string, message: string }`

---

### ddx_derive

Reverse-engineer documentation from code.

```json
{
  "name": "ddx_derive",
  "description": "Derive DDX documentation from existing code. Reverse-engineers define, design, and plan docs from implementation.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": {
        "type": "string",
        "description": "Project ID"
      },
      "code_path": {
        "type": "string",
        "description": "Path to code to derive documentation from (can be file or directory)"
      },
      "capability_name": {
        "type": "string",
        "description": "Name to assign to derived capability"
      }
    },
    "required": ["project_id", "code_path", "capability_name"]
  }
}
```

**Maps to HTTP**: `POST /derive`  
**Request body**: `{ project_id, code_path, capability_name }`  
**Response**: `{ success: boolean, derived_docs: { definition_path: string, design_path: string, plan_path: string }, message: string }`

---

### ddx_list

List all DDX documents in a project.

```json
{
  "name": "ddx_list",
  "description": "List all DDX documents in a project.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": {
        "type": "string",
        "description": "Project ID"
      },
      "filter": {
        "type": "string",
        "enum": ["all", "mandate", "define", "design", "plan"],
        "default": "all",
        "description": "Filter by document type"
      }
    },
    "required": ["project_id"]
  }
}
```

**Maps to HTTP**: `GET /list?project_id={id}&filter={filter}`  
**Response**: `{ success: boolean, documents: [{ path: string, type: string, name: string, created_at: string }], message: string }`

---

### ddx_check

Run consistency check on DDX documents.

```json
{
  "name": "ddx_check",
  "description": "Run a consistency check. Validates that DDX documents are complete and coherent.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "project_id": {
        "type": "string",
        "description": "Project ID"
      },
      "capability_name": {
        "type": "string",
        "description": "Optional: check specific capability; if omitted, check entire project"
      }
    },
    "required": ["project_id"]
  }
}
```

**Maps to HTTP**: `POST /check`  
**Request body**: `{ project_id, capability_name }`  
**Response**: `{ success: boolean, issues: [{ severity: string, message: string, path: string }], summary: string }`

---

### ddx_read

Read a specific DDX document.

```json
{
  "name": "ddx_read",
  "description": "Read the content of a specific DDX document by path.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Path to the document (e.g., 'projects/my-project/define/capability-name.md')"
      }
    },
    "required": ["path"]
  }
}
```

**Maps to HTTP**: `GET /document/{path}`  
**Response**: `{ success: boolean, content: string, metadata: { created_at: string, modified_at: string, type: string }, message: string }`

---

## Resource Patterns

### ddx://documents/{path}

Provides read-only access to any DDX document by path.

**URI Pattern**: `ddx://documents/{project_id}/{doc_type}/{capability_name}.md`

**Examples**:
- `ddx://documents/my-project/define/auth-service.md`
- `ddx://documents/my-project/design/api-gateway.md`
- `ddx://documents/my-project/mandate/mandate.md`

**MCP Resource Handler Implementation**:
1. Parse the URI to extract project_id, doc_type, and capability_name
2. Call HTTP GET `/document/projects/{project_id}/{doc_type}/{capability_name}.md`
3. Return content as `TextResourceContents`

---

## Tool Call to HTTP Endpoint Mapping

| MCP Tool | HTTP Method | HTTP Endpoint | Request Body | Maps Tool Parameter(s) |
|----------|-----------|-------------|---|---|
| ddx_mandate | POST | /mandate | { project_id, mandate_content, update_if_exists } | All parameters |
| ddx_define | POST | /define | { project_id, capability_name, definition_content, parent_capability } | All parameters |
| ddx_design | POST | /design | { project_id, capability_name, design_content } | All parameters |
| ddx_plan | POST | /plan | { project_id, capability_name, plan_content } | All parameters |
| ddx_build | POST | /build | { project_id, capability_name, build_config } | All parameters |
| ddx_derive | POST | /derive | { project_id, code_path, capability_name } | All parameters |
| ddx_list | GET | /list?project_id={id}&filter={filter} | (none, query params) | project_id, filter |
| ddx_check | POST | /check | { project_id, capability_name } | All parameters |
| ddx_read | GET | /document/{path} | (none, path parameter) | path |

---

## Error Handling

HTTP errors are translated to JSON-RPC 2.0 error objects:

| HTTP Status | JSON-RPC Error Code | Example |
|---|---|---|
| 400 Bad Request | -32602 (Invalid params) | Missing required parameter |
| 404 Not Found | -32603 (Internal error) | Document path does not exist |
| 401 Unauthorized | -32700 (Parse error) | Auth token invalid |
| 500 Server Error | -32603 (Internal error) | Unexpected server error |
| Timeout | -32000 | Request timed out |

**JSON-RPC Error Response Example**:
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "details": "Missing required parameter: capability_name",
      "http_status": 400
    }
  },
  "id": "request-id"
}
```

---

## Streaming Responses

For long-running operations (e.g., `ddx_design` with LLM assistance), the MCP server:
1. Accepts the tool call
2. Opens an HTTP stream to the DDX server
3. Buffers streamed chunks from the HTTP response
4. Returns accumulated content in the tool result once complete

Clients consuming the tool call see the full response once available. Streaming is transparent at the MCP level but improves responsiveness for long operations.

---

## Configuration

The MCP server reads configuration from environment variables:

- `DDX_SERVER_URL` (default: `http://localhost:8080`) — Base URL of DDX core server
- `DDX_SERVER_TIMEOUT` (default: `30000`) — HTTP request timeout in milliseconds
- `MCP_LOG_LEVEL` (default: `info`) — Logging verbosity (debug, info, warn, error)

