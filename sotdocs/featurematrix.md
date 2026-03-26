# DDX Feature Matrix

## Product-Level Documents

| Document | Status |
|----------|--------|
| `product/opportunity_brief.md` | Complete |
| `product/one_pager.md` | Complete |
| `product/prd.md` | **Empty shell** (just headings, no content) |
| `product/ssd.md` | Complete (v1 architecture — CLI/REPL/Web/MCP) |
| `product/ssd2.md` | Complete (v2 architecture — server-centric) |
| `product/ssd_original.md` | Complete (earliest version) |
| `product/define.md` | Complete (v2 product definition) |
| `product/design.md` | Complete (v2 server-centric design) |
| `product/plan.md` | Complete (v2 build order: 5 capabilities) |
| `product/context_management.md` | Complete (technical deep-dive, 5 strategies) |
| `product/high_level_context_management.md` | Complete (non-technical version) |
| `product/edit_method.md` | Complete (CLI+file editing hybrid workflow) |
| `product/feature_proposal_multi_level_docs.md` | Complete (multi-scope proposal) |

## Capability-Level Documents

| Capability | define | design | plan | test |
|-----------|--------|--------|------|------|
| 001-core-engine | Done | Done | Done | Done |
| 002-cli-interface | Done | Done | Done | Done |
| 003-claude-skills | Done | Done | Done | Done |
| 004-mcp-server | Done | Done | Done | Done |
| 005-web-interface | Done | Done | Done | Done |

All 20 capability docs are fully written out.

## Implementation Status

### Implemented (v1 CLI Prototype)

| Feature | Status |
|---------|--------|
| CLI (`init`, `create`, `continue`, `check`, `list`) | Yes |
| Config loader (YAML) | Yes |
| File manager | Yes |
| LLM client (Anthropic, non-streaming) | Yes |
| State manager (JSON persistence) | Yes |
| Document service (CRUD, templates, upstream/downstream) | Yes |
| Conversation service (create/continue) | Yes |
| Consistency service (semantic check) | Yes |
| Workflow engine (orchestrates CLI output) | Yes |

### Not Implemented (v2 Architecture)

| Feature | Status |
|---------|--------|
| Express.js server (core engine) | Not started |
| Named commands (`mandate`, `define`, `design`, `plan`, `build`, `derive`) | Not started |
| Scope auto-detection (product vs capability) | Not started |
| Auto-numbering (001-name, 002-name) | Not started (orphaned JS in dist/) |
| Prerequisite enforcement (mandate before define, etc.) | Not started |
| SSE streaming | Not started |
| Claude Skills | Not started |
| MCP Server | Not started |
| Web Interface (React) | Not started |
| Context window management (auto-reset or sliding window) | Not started |

## Summary

Docs are way ahead of code. All 5 capabilities are fully specced (define, design, plan, test) but only a v1 CLI prototype exists. The v2 architecture (server-centric with 4 client modes) hasn't been started. The code still uses the old `create/continue/check` workflow with flat document types (opportunity_brief, one_pager, prd, sdd) rather than the v2 `mandate > define > design > plan > test > code` lifecycle with product/capability scoping.

The PRD is also still empty — it's just section headings with no content.

src/core/          ← shared services (config, file manager, LLM, state, document, conversation,        
  consistency)                                                                                           
  src/cli/           ← imports core directly                                                             
  src/mcp/           ← imports core directly (stdio process)                                             
  src/server/        ← Express wrapper around core (added when web UI needed)                          
  src/web/           ← React SPA, talks to Express                                                       
                                                                                                         
  CLI and MCP import core/ directly — no server overhead. When you build the web UI, Express just wraps  
  the same core/ services with HTTP routes. Nothing changes for CLI or MCP.                              
                                                                                                         
  The only thing to be careful about is the state conflict issue I mentioned — if someone has the MCP    
  server running and also uses the web UI simultaneously, both are writing state files. But that's
  solvable with file locking or per-user state when you actually get there.
