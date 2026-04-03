#!/bin/bash
# Claude Code PostToolUse hook: refresh ddx plan.md status dashboards
# after state-changing beads commands.
#
# Receives JSON on stdin with tool_input.command and tool_response.
# Only acts when a bd write-command succeeds.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0

# Skip if the command failed
ACTUAL_EXIT=$(echo "$INPUT" | jq -r '.tool_response.exit_code // 0' 2>/dev/null)
if [ "$ACTUAL_EXIT" != "0" ] && [ "$ACTUAL_EXIT" != "null" ]; then
  exit 0
fi

# Only act on state-changing bd commands
STATE_CHANGING="^bd[[:space:]]+(close|update|create|reopen|delete|set-state|priority|assign|dep|link|tag|label)"
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

# Parse tracking.enabled from the YAML config using awk.
TRACKING_ENABLED=$(awk '
  /^tracking:/ { in_tracking=1; next }
  in_tracking && /^[^ ]/ { exit }
  in_tracking && /enabled:/ { gsub(/.*enabled:[[:space:]]*/, ""); print; exit }
' "$CONFIG" 2>/dev/null)

if [ "$TRACKING_ENABLED" != "true" ]; then
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
    header="# $scope — Build Plan Status"
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

  local refreshed
  refreshed=$(date -u '+%Y-%m-%d %H:%M UTC')

  printf '%s\n\n> Auto-generated from Beads. Source of truth: `bd list --label %s`\n> Last refreshed: %s\n\n%s\n\n## Details\n\nFor full step details: `bd show {task-id}`\nFor live status: `bd list --label %s`\n' \
    "$header" "$label" "$refreshed" "$table" "$label" > "$plan_path"
}

# Extract affected scope(s) from --label ddx:{scope} in the command
SCOPES=$(echo "$COMMAND" | grep -oE 'ddx:[a-zA-Z0-9_-]+' | sed 's/^ddx://' | sort -u) || true

if [ -n "$SCOPES" ]; then
  # Refresh only the scope(s) mentioned in the command
  for scope in $SCOPES; do
    # Map product-plan label back to product scope
    if [ "$scope" = "product-plan" ]; then
      scope="product"
    fi
    if [ -d "$DDX_DIR/$scope" ]; then
      refresh_scope "$scope"
    fi
  done
else
  # No label found — fall back to refreshing all scopes
  for scope_dir in "$DDX_DIR"/*/; do
    [ -d "$scope_dir" ] || continue
    scope=$(basename "$scope_dir")
    refresh_scope "$scope"
  done
fi

exit 0
