# Input 6 — Guest Photo Gallery (Admin-Managed)

This is a functional feature, not a styling task — it needs storage, an upload flow, and
a lifecycle rule, on top of whatever the gallery page ends up looking like once the CSS
pass lands. Do this independently of the styling work.

## 1. Admin uploads the photos — no GitHub involved

Earlier discussion floated hosting gallery photos on GitHub directly; scrap that. The
admin should manage photos the same way they already manage the card image: through the
app itself.

- On each event's admin dashboard, add a **"Gallery"** button/section (next to the
  existing shareable-link and export controls). Clicking it opens a simple manager for
  that event: upload one or more photos, see thumbnails of what's already uploaded,
  delete any of them.
- This is per-event — photos uploaded for one wedding must never appear on another
  wedding's gallery.

## 2. Storage — don't reuse local disk uploads as-is

The existing card-image upload (via `multer`) writes to local disk on the Render web
service. That's worth flagging now: Render's free-tier filesystem is **ephemeral** —
anything written to local disk is wiped on every redeploy/restart, not just occasionally.
That's a real risk for a single card image, and a much bigger one for a whole gallery of
photos the couple is expecting to still be there weeks from now.

Recommendation: use a proper external image host with a generous free tier —
**Cloudinary** is the standard choice here (free tier is more than enough for one
wedding's worth of photos, gives back a CDN URL per image, and has a straightforward
Node SDK). Store only the returned image URLs in Postgres (a new table, e.g.
`gallery_photos` — `id`, `event_id`, `image_url`, `uploaded_at`), not the image bytes
themselves.

If Claude Code has a reason to prefer a different persistent storage approach, that's a
fair call to make — the one thing that shouldn't happen is gallery photos (or the
existing card image, while this is being touched) living only on the web service's local
disk. Worth fixing the existing card-image upload the same way while this is being built,
since it has the identical risk.

**[You]** will need to sign up for a free Cloudinary account (or whatever service Claude
Code lands on) and provide the API credentials as new environment variables on Render —
flag me when you get there and I'll walk you through that step, same as the Gmail App
Password setup.

## 3. Guest-facing gallery page

- A gallery page/section (linked from the invite flow) shows all photos currently
  uploaded for that event — a simple grid, most-recent-first is fine.
- **Already-accepted guests must see updates.** The gallery is not something a guest
  "receives" once and keeps a frozen copy of — every time they open the gallery page, it
  should show whatever is currently uploaded at that moment, including photos added
  after they first accepted. No re-acceptance or re-confirmation needed for this to work
  — it's just a live view, not a cached snapshot.

## 4. Lifecycle — photos leave when the event does

Gallery photos belong to the event and should follow the same lifecycle already built in
input_3.md (Change 5): when an event is deleted (manually, or by the 30-day
post-wedding auto-purge), its gallery photos are deleted too — both the `gallery_photos`
rows and the actual images on Cloudinary (or whichever host is used), not just the DB
rows. This doesn't need to be reflected in the `event_archive` metrics table — gallery
photos are guest-facing content, not a performance metric.

## Suggested verification

- Upload several photos to one event's gallery from the admin dashboard, confirm they
  show correctly on that event's guest-facing gallery page and nowhere else.
- Confirm an already-accepted guest, revisiting after new photos were added, sees the
  new photos without doing anything else.
- Trigger a Render redeploy (or restart) after uploading photos, confirm the photos
  are still there afterward (this is the actual test of the ephemeral-disk fix).
- Delete a test event with photos in its gallery, confirm the photos are gone from
  Cloudinary (or the chosen host) as well as the database, not just hidden.

## Issues found

*(Claude Code: note anything unexpected here.)*
