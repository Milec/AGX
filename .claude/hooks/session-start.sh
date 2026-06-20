#!/bin/bash
set -euo pipefail

# SessionStart hook for Claude Code on the web.
# Provisions a headless browser (Playwright + Chromium) so the agent can render
# and screenshot public/index.html during web sessions.
#
# Web-only: do nothing on local machines / non-remote sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

TOOLS_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}/.claude/tools"
LOG="/tmp/agx-session-start.log"

{
  cd "$TOOLS_DIR"
  # npm install (not ci) so the cached container image can be reused across runs.
  npm install
  # Download Chromium + its OS dependencies. Idempotent: Playwright skips any
  # browser/binary that is already present.
  npx --yes playwright install --with-deps chromium
} >"$LOG" 2>&1

echo "AGX web tools ready: Playwright Chromium installed (setup log: $LOG)."
