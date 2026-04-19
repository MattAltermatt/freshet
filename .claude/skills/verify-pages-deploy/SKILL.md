---
name: verify-pages-deploy
description: Watch the most recent GitHub Pages deploy on main to completion and report green/red. Use after any push to main that touches docs/, or when asked to verify the live site matches latest main.
---

# verify-pages-deploy

Freshet deploys `docs/` to GitHub Pages via the built-in `pages-build-deployment` workflow on every push to `main`. Local verification (pnpm build, tests, typecheck) does **not** cover Jekyll rendering or Pages availability — the workflow is the only thing that does.

This skill wraps the monitoring pattern into one invocation:

```bash
gh run list --branch main --limit 1 --json databaseId,status,conclusion,workflowName
```

Extract the `databaseId` of the most recent `pages-build-deployment` run, then:

```bash
gh run watch <id> --exit-status
gh run view <id> --json conclusion,status
```

Report back:

- ✅ If `conclusion: "success"` — name the commit it deployed and a spot-check URL (e.g. `https://mattaltermatt.github.io/freshet/` or the specific page the last commit changed).
- ❌ If `conclusion: "failure"` — fetch logs with `gh run view <id> --log-failed`, surface the relevant error line, and suggest a fix. Classic failure modes:
  - Unescaped `{% %}` / `{{ }}` in a `docs/*.md` outside a `{% raw %}` block (see `project_jekyll_raw_for_liquid_docs` memory).
  - Broken front-matter (bad YAML).
  - `permalink:` collision with another page.
- ⏳ If `status: "in_progress"` — `gh run watch` blocks until completion; do not skip this step.

Never declare a docs-touching push "shipped" without reading the final conclusion.

After reporting, if the deploy succeeded and the change is user-visible, also `curl -sI <url>` the relevant page to confirm 200 and fresh `last-modified`.
