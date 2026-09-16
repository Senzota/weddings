# Input 11 — Cloudinary (Card Image + Gallery) and Admin Layout, Combined

This bundles two already-agreed pieces of work into one pass, since they touch the same
files (the per-event admin page, the Wedding Details form): the Cloudinary persistent-
storage fix (closing the recurring broken-photo bug and finally building the Gallery
feature from input_6.md), and the admin layout redesign from input_10.md. Do both
together rather than touching these templates twice.

`CLOUDINARY_URL` is already set as an environment variable on Render — confirmed live.

## Part A — Cloudinary: card image + gallery

### 1. Card image (hero/invitation photo)

Switch the `card_image` upload from local disk to Cloudinary. On upload, send the file
to Cloudinary and store the returned secure URL in the `events` table instead of a local
file path. Existing events whose card image was lost to Render's ephemeral disk (e.g.
the "Heartson & Makrama" test event) will need the admin to re-upload once this is live
— the old files are gone and can't be recovered.

### 2. Gallery (finishing input_6.md)

Build the gallery feature now that persistent storage exists:

- Per-event "Gallery" button/section on the admin page (already scaffolded as an empty
  page per input_8; now give it real functionality) — admin can upload one or more
  photos, see thumbnails, delete any of them.
- Store only the returned Cloudinary URLs in a new table (e.g. `gallery_photos` — `id`,
  `event_id`, `image_url`, `uploaded_at`), not image bytes.
- Guest-facing gallery page shows all currently-uploaded photos for that event, most
  recent first — this must be a live view: an already-accepted guest revisiting later
  sees newly added photos, no re-acceptance needed.
- Mobile-responsive grid.

### 3. Lifecycle — images follow the event

When an event is deleted (manual delete or the 30-day auto-purge from input_3.md), its
images on Cloudinary — both the card image and every gallery photo — must be deleted
from Cloudinary itself, not just their database rows. If Cloudinary deletion fails,
handle it sensibly (log and continue, or retry) rather than blocking the rest of the
deletion — Claude Code's call on the exact error handling, but don't leave orphaned
images silently accumulating on the Cloudinary account either.

## Part B — Per-event admin page layout (from input_10.md)

Full detail is in `input_10.md`, already committed — summarized here since it's being
done in the same pass:

1. Top section splits into two columns: the wedding's photo on the left, quick-action
   tiles (Shareable Invite Link + Copy, Door Scanner, Status Live/Draft, Live Stats) on
   the right — not stacked full-width sections.
2. No full-width single-column sections anywhere on this page.
3. Wedding Details render as a responsive square-tile grid (up to ~6 columns wide,
   down to 1-2 columns on phone width).
4. The "Current card" image preview shrinks from a large inline image to a small
   clickable thumbnail tile within that grid — this ties directly into Part A's card
   image work, so it's a natural fit to do them together.
5. Guest management splits into two columns: Add Guest form + Guest List table on the
   left, contact details and short usage instructions on the right (for eventual client
   use).
6. Consistent spacing between all sections.
7. One uniform corner-radius value used across every square, card, and button on the
   page.

## Suggested verification

- Upload a card image and a few gallery photos, trigger a Render restart/redeploy,
  confirm all of them are still there afterward (the real test of the persistence fix).
- Confirm an already-accepted guest sees newly added gallery photos on a later visit
  without re-accepting.
- Delete a test event with a card image and gallery photos, confirm they're gone from
  Cloudinary itself, not just the database.
- Open a wedding's admin page and confirm the layout matches input_10's spec: photo +
  quick-tiles at top, Wedding Details as a reflowing square grid, the card preview as a
  small clickable thumbnail, guest management in two columns, consistent spacing and
  corner-radius throughout.
- Re-upload a card image for "Heartson & Makrama" (or another event with a broken
  photo) and confirm it now displays correctly and survives a redeploy.

## Issues found

**Part B (admin layout) was already built and shipped as input_10 before
this input arrived** — verified the current `admin/dashboard.ejs` and
`theme.css` still match that spec exactly (photo+quick-tiles top row,
reflowing details grid, thumbnail, two-column guest management, uniform
radius) and only added the new Gallery-management section into that same
grid structure, rather than redoing the layout work.

**No Cloudinary credentials in this local environment**, so real
upload/delete calls couldn't be exercised here — same situation as SMTP
earlier in this project. What *was* verified locally, end to end:
- The full DB/routing/gating logic (schema, models, controllers, views)
  with `node --check` + a live local server against local Postgres.
- **The graceful-failure requirement specifically** — gave a test event a
  fake `card_image_public_id`, deleted it, and confirmed: the database
  deletion succeeded regardless (`SELECT COUNT(*)` → 0), the Cloudinary
  failure was logged clearly (`Failed to delete Cloudinary image
  fake-public-id-123 for deleted event 7: Error: Must supply api_key`),
  and the server kept running — nothing crashed or blocked. This is the
  exact failure mode the input asked to handle sensibly, and it's now
  provably correct rather than just "should work."
- Real Cloudinary upload/download/delete needs verifying against
  production, where `CLOUDINARY_URL` actually exists — see the
  suggested-verification checklist, which I'll run live after deploying.

**Gallery is now passcode-gated, closing the gap input_9 explicitly left
open** ("worth deciding deliberately when input_6's real Gallery... gets
built" — this is that moment). Since there's no session, the passcode
travels as a `?passcode=` query parameter on the Gallery tile's link
(the invitation page already has `guest.passcode` in scope when it
renders that link) rather than a POST body. Trade-off worth flagging:
query strings are more likely to end up in server access logs or browser
history than a POST body would — acceptable here since it's the same
passcode a guest already has and shares out of band, but noting it rather
than treating the two as identical.

**Old local-disk `card_image` paths proactively cleared in the
migration** (`UPDATE events SET card_image = NULL WHERE card_image LIKE
'/uploads/%'`) rather than leaving them pointing at files that no longer
exist on Render's disk — the admin page now shows a clean "no image yet"
state prompting a re-upload, instead of a broken `<img>`. This includes
"Heartson & Makrama" and any other event in the same state; the input
already noted these need re-uploading regardless, since the original
files are unrecoverable.

**Replacing a card image now also deletes the old Cloudinary image it
replaces** (best-effort, logged on failure, same pattern as event
deletion) — the input only explicitly asked for cleanup on event
deletion, but leaving an orphaned image behind every time an admin swaps
a photo seemed to run counter to "don't leave orphaned images silently
accumulating." Flag if replace-in-place should instead keep the old
version around for some reason.

**`gallery_photos` cascades via the existing `events` FK** (`ON DELETE
CASCADE`), so the database side of cleanup needed no new logic in
`archive.model.js` beyond collecting `public_id`s *before* the delete —
only the Cloudinary side needed the explicit best-effort loop.
