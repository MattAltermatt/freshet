#!/usr/bin/env bash
# PostToolUse hook — Jekyll Liquid-escape sentinel for docs/**/*.md edits.
#
# Jekyll parses every docs/*.md as Liquid before markdown rendering, and
# backticks / code fences do NOT prevent Liquid from interpreting `{% %}` and
# `{{ }}` sequences. A single unescaped example breaks the GitHub Pages
# deploy. This hook warns (doesn't block) when an edited docs markdown file
# contains Liquid-like tokens without a surrounding `{% raw %}` wrapper.
#
# Reads the tool_input JSON from stdin; writes warnings to stderr so Claude
# can see them in the next turn. Always exits 0 — advisory only.
set -euo pipefail

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

# Only inspect markdown under docs/. Absolute or relative path works.
case "$path" in
  */docs/*.md|docs/*.md) ;;
  *) exit 0 ;;
esac

[[ -f "$path" ]] || exit 0

# Any Liquid-tag or Liquid-output tokens in the file?
if ! grep -qE '\{%|\{\{' "$path"; then
  exit 0
fi

# If the file has a {% raw %} wrapper the tokens are safely fenced.
if grep -q '{% raw %}' "$path" && grep -q '{% endraw %}' "$path"; then
  exit 0
fi

cat >&2 <<EOF
⚠ [freshet/docs-liquid-check] $path contains Liquid-like tokens ({% %} or {{ }})
  but no {% raw %} wrapper. Jekyll will parse these at build time and likely
  break the Pages deploy. Wrap the body:

      {% raw %}
      ...your content with Liquid examples...
      {% endraw %}

  This is a warning, not a block — push when you've decided.
EOF
exit 0
