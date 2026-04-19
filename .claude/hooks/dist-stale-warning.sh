#!/usr/bin/env bash
# PostToolUse hook — flag dist/ staleness after src/ edits.
#
# Freshet's CLAUDE.md gotcha: `pnpm build` writes to dist/, and Chrome loads
# the unpacked extension from that directory. Editing a file under src/
# without rebuilding means the loaded extension still reflects the OLD code,
# which caused the "my change isn't showing up" class of confusion.
#
# This hook emits a one-line reminder after any Edit/Write under src/.
# Advisory only — always exits 0.
set -euo pipefail

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

# Only fire for files under the project's src/.
case "$path" in
  */freshet/src/*) ;;
  src/*) ;;
  *) exit 0 ;;
esac

# Don't bother for test files — they don't ship in dist/.
case "$path" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) exit 0 ;;
esac

cat >&2 <<EOF
⚠ [freshet/dist-stale] edited $path — dist/ is now stale. Run \`pnpm build\`
  and reload the extension at chrome://extensions before claiming the change
  is live in the browser.
EOF
exit 0
