---
name: cws-listing-freeze-check
description: Audit whether any CWS listing files have been modified since the v1.0.0 submission date (2026-04-19) while the listing is frozen in review. Use before any push, or when asked to verify the freeze is intact.
---

# cws-listing-freeze-check

Freshet's CWS listing for v1.0.0 is **frozen during review** — see the `feedback_cws_listing_frozen_during_review` memory. Any change to the listing text, screenshots, or promo assets would restart the review clock. This skill is a read-only audit that reports whether the freeze is intact.

## What to check

Listing-affecting files, per `ROADMAP.md` artifacts section + `CLAUDE.md`:

- `docs/superpowers/cws-listing.md` — the listing text of record
- `docs/assets/cws-screenshots/*.png` — the 5 screenshots submitted to CWS
- `docs/assets/logo.png` — also used on the listing
- Any future promo-tile / marquee-image assets under `docs/assets/`

## Procedure

Freeze-start date is **2026-04-19** (v1.0.0 submission). Run:

```bash
git log --since="2026-04-19" --pretty=format:"%h %ad %s" --date=short -- \
  docs/superpowers/cws-listing.md \
  docs/assets/cws-screenshots/ \
  docs/assets/logo.png
```

Also check the working-tree state:

```bash
git status --short -- docs/superpowers/cws-listing.md docs/assets/cws-screenshots/ docs/assets/logo.png
```

Also check uncommitted local changes via `git diff HEAD -- <paths>`.

## Reporting

- ✅ No commits or local edits touching those paths since 2026-04-19 → freeze intact; report in one line.
- ⚠ Any commits since then → list them and flag as a freeze violation; recommend reverting *unless* v1.0.0 has gone live (check `ROADMAP.md` — "Now — Awaiting review" section should be stripped / replaced on approval).
- ⚠ Local uncommitted diff → show the files and ask what the intent is; propose adding to post-launch backlog if content is for the next submission.

**Never modify** the listed files as part of this skill — audit only. If a fix is needed, hand off to the user.

## False positives

If CWS approves v1.0.0 and `ROADMAP.md` is updated to show the live URL instead of "Submission in progress," the freeze lifts and post-v1.0.0 listing edits are allowed. Inspect `ROADMAP.md` before declaring a violation.
