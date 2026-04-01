#!/bin/bash
# Claude Code PostToolUse hook: refresh ddx plan.md status dashboards
# after state-changing beads commands.
#
# Receives JSON on stdin with tool_input.command and tool_response.
# Only acts when a bd write-command succeeds.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_response.stdout // "" | if test("exit code") then "1" else "0" end' 2>/dev/null)

# Also check for explicit exit_code field
ACTUAL_EXIT=$(echo "$INPUT" | jq -r '.tool_response.exit_code // 0' 2>/dev/null)
if [ "$ACTUAL_EXIT" != "0" ] && [ "$ACTUAL_EXIT" != "null" ]; then
  exit 0
fi

# Only act on state-changing bd commands
STATE_CHANGING="^bd\s+(close|update|create|reopen|delete|set-state|priority|assign|dep|link|tag|label)"
if ! echo "$COMMAND" | grep -qE "$STATE_CHANGING"; then
  exit 0
fi

# Find the project root (where ddx/ lives)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
DDX_DIR="$PROJECT_DIR/ddx"

if [ ! -d "$DDX_DIR" ]; then
  exit 0
fi

# Check beads tracking is enabled
CONFIG="$PROJECT_DIR/.ddx-tooling/config.yaml"
if [ ! -f "$CONFIG" ]; then
  exit 0
fi

# Simple YAML check for tracking enabled (avoid pulling in a YAML parser)
if ! grep -q 'provider:.*beads' "$CONFIG" 2>/dev/null; then
  exit 0
fi
if ! grep -q 'enabled:.*true' "$CONFIG" 2>/dev/null; then
  exit 0
fi

# Refresh plan.md for each scope
refresh_scope() {
  local scope="$1"
  local label="ddx:$scope"
  local plan_path="$DDX_DIR/$scope/plan.md"

  # For product scope, use product-plan label
  if [ "$scope" = "product" ]; then
    label="ddx:product-plan"
  fi

  # Get tasks as JSON
  local tasks
  tasks=$(bd list --label "$label" --all --limit 0 --flat --json 2>/dev/null) || return 0

  # Check we got valid JSON array with entries
  local count
  count=$(echo "$tasks" | jq 'length' 2>/dev/null) || return 0
  if [ "$count" = "0" ] || [ -z "$count" ]; then
    return 0
  fi

  # Build the dashboard
  local header table

  if [ "$scope" = "product" ]; then
    header="# Product Plan — Status"
  else
    # Capitalize scope for display
    local display_scope
    display_scope=$(echo "$scope" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
    header="# $display_scope — Build Plan Status"
  fi

  # Generate table rows from JSON
  table=$(echo "$tasks" | jq -r '
    . as $tasks |
    ["| # | Task | Status | Priority | Description |",
     "|---|------|--------|----------|-------------|"] +
    [$tasks | to_entries[] |
      {i: (.key + 1), t: .value} |
      "| \(.i) | \(.t.title // "—") | \(.t.status // "—") | \(.t.priority // "—") | \(.t.description // "—" | split("\n")[0] | if length > 80 then .[0:77] + "..." else . end) |"
    ] | .[]
  ' 2>/dev/null) || return 0

  cat > "$plan_path" << EOF
$header

> Auto-generated from Beads. Source of truth: \`bd list --label $label\`
> Last refreshed: $(date -u '+%Y-%m-%d %H:%M UTC')

$table

## Details

For full step details: \`bd show {task-id}\`
For live status: \`bd list --label $label\`
EOF
}

# Iterate over all scopes
for scope_dir in "$DDX_DIR"/*/; do
  [ -d "$scope_dir" ] || continue
  scope=$(basename "$scope_dir")
  refresh_scope "$scope"
done

exit 0
