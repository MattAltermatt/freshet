---
name: cws-listing-freeze-check
description: Audit whether CWS listing files have been modified since the active review's submission date while the listing is frozen. Use before any push, or when asked to verify the freeze is intact.
---

# cws-listing-freeze-check

Freshet's CWS listing is **frozen during active review** — see the `feedback_cws_listing_frozen_during_review` memory. Any change to the listing text, screenshots, or promo assets would restart the review clock. This skill is a read-only audit that reports whether the freeze is intact for the currently-in-review version.

## What to check

Listing-affecting files, per `CLAUDE.md`:

- `docs/superpowers/cws-listing.md` — the listing text of record
- `docs/assets/cws-screenshots/*.png` — the 5 screenshots submitted to CWS
- `docs/assets/cws-promo/*.png` — small promo tile (440×280) and any marquee assets
- `docs/assets/logo.png` — also used on the listing

## Procedure

Derive the active freeze-start from `ROADMAP.md`'s "Awaiting review — vX.Y.Z" block (submission date for the version in review). If no "Awaiting review" block exists, the listing is live and not frozen — report and bail.

With the submission date in hand:

```bash
git log --since="<submission-date>" --pretty=format:"%h %ad %s" --date=short -- \
  docs/superpowers/cws-listing.md \
  docs/assets/cws-screenshots/ \
  docs/assets/cws-promo/ \
  docs/assets/logo.png
```

Also check the working-tree state:

```bash
git status --short -- \
  docs/superpowers/cws-listing.md \
  docs/assets/cws-screenshots/ \
  docs/assets/cws-promo/ \
  docs/assets/logo.png
```

Also check uncommitted local changes via `git diff HEAD -- <paths>`.

## Reporting

- ✅ No "Awaiting review" block in ROADMAP → listing is live and un-frozen; report in one line.
- ✅ No commits or local edits on the watched paths since the submission date → freeze intact; report in one line.
- ⚠ Any commits since submission → list them and flag as a freeze violation; recommend reverting unless the review has flipped to "published" (check ROADMAP and the CWS dashboard).
- ⚠ Local uncommitted diff → show the files and ask what the intent is; propose adding to post-launch backlog if content is for the next submission.

**Never modify** the listed files as part of this skill — audit only. If a fix is needed, hand off to the user.
