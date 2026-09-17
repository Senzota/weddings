# Input 19 — Scrap the Floral Decoration Entirely (Final Verdict)

Follow-up to input_16 §4 through input_18. Four rounds of trying to make the supplied
floral asset work as decoration on the Lady Gianna theme — small corner crops, a
continuous top/bottom "band" background, a tint over it, a tint removed, opacity
adjustments, a replacement image — never landed cleanly. Final decision: stop iterating
and remove the floral decoration from the theme entirely, guest page and admin dashboard
alike. Lady Gianna goes back to exactly how it looked before any floral asset was
introduced.

This has already been applied directly (not left for Claude Code to redo):

## What was removed

**Guest page** (`views/guest/themes/lady-gianna/invitation.ejs`):
- The two Hero corner images (`lg-corner-tl` / `lg-corner-br`) and their `assetExists`
  guard block — gone.
- The `.lg-post-hero` wrapper's floral background (image + tint layers) — gone. The
  wrapper `<div>` itself is kept only for structure (it holds the Gate panel, tile row,
  Itinerary, Gallery, and Footer, same as before), but it no longer carries any
  background of its own.

**Admin dashboard** (`views/admin/themes/lady-gianna/dashboard.ejs`):
- The two `lg-post-hero-band` images and their `assetExists` guard block — gone.
- The `lg-post-hero` class removed from `.lg-admin-wrap` — the wrap no longer needs it.

**CSS** (`public/themes/lady-gianna/theme.css`):
- `.lg-corner`, `.lg-corner-tl`, `.lg-corner-br` rules — deleted.
- `.lg-post-hero-band`, `.lg-post-hero-band--top/--bottom` rules — already gone from an
  earlier pass.
- `.lg-post-hero` simplified to `{ position: relative; }` — no background image, no
  gradient, no tint. The page now shows the theme's plain blush background
  (`body.lg-page`'s own background/background-image) everywhere the floral used to be.

**Not touched / kept as-is** — these were separate, well-received fixes, not part of the
floral issue, so they stay:
- The Itinerary section and Footer are still their own cards (`lg-framed lg-glass`).
- The extra top spacing above the "Dear [Guest]" Gate card stays.
- The Time-field width fix, guest bulk-add placeholder fix, and profile/photo-panel merge
  from earlier inputs are all unrelated and unaffected.

## Note on the asset file itself

The image file `public/assets/img/themes/lady-gianna/corner-floral.png` is no longer
referenced anywhere and can be deleted from the repo — this pass could only stop
referencing it (no file-delete access from here), so it's still sitting on disk unused.
Claude Code: please `git rm` it (and the now-unused `assets/img/themes/lady-gianna/`
folder if nothing else lives there) as part of committing this.

## Suggested verification

- Confirm the Lady Gianna guest page (Hero through Footer) shows no floral image, no
  corner squares, and no tinted background anywhere — plain theme background only.
- Confirm the Lady Gianna admin dashboard shows no floral image anywhere either.
- Confirm the Itinerary/Footer card treatment and Gate-card top spacing are unaffected.
- Confirm `corner-floral.png` is removed from the repo.
- Commit and push to `origin/main` so Render picks this up.

## Issues found

The three files' edits (already applied before I picked this up) matched the
spec exactly — verified line-by-line against the description. My own work was:

- `git rm public/assets/img/themes/lady-gianna/corner-floral.png` — the file
  and its now-empty parent folders are gone from the repo.
- Confirmed via `grep` that nothing in `views/`, `public/themes/`, or
  `server.js` referenced that path any more before deleting it.
- Verified locally: no floral reference (`corner-floral`, `lg-corner`,
  `lg-post-hero-band`, `lg-post-hero-tint`) remains anywhere on the guest page
  or the admin dashboard; the asset URL now 404s as expected; the Itinerary/
  Footer glass-card treatment and the extra Gate-panel spacing (both
  explicitly "not touched" by this input) are still in place; the
  `closed`-mode passcode → Accept → QR flow still works; other themes
  unaffected. Test event deleted afterward.
- No database schema changes — nothing to migrate.
