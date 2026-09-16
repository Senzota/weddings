# Input 12 — Theme 2 ("Lavender Romance"), Admin Headers, Cameos, and Assets Management

This bundles several related pieces of work discussed together, since they touch the
same guest-facing pages and the same per-event admin page: the second theme, a proper
header on both admin views, a new "Cameos" feature, a combined admin tool for managing
Cameos and Gallery together, and an extension of the Gallery/Cameos lifecycle so guests
can keep viewing (and now downloading) photos for the full 30-day post-wedding window
already defined in input_3/input_11.

The two files uploaded (`public-wedding-invitation-updated.html` — guest invitation, and
`luxury-wedding-dashboard.html` — admin dashboard) are the visual reference for Part A
(theme) and Part B (admin header). Nothing here changes the guest page order/behavior
established in input_7/8/9 except where explicitly stated in Part D.

## Part A — Theme 2: "Lavender Romance"

Add this as a second theme, registered the same way Botanical Bloom is (input_7's
`themes/` folder convention, input_9's theme selector).

1. **Registration** — slug `lavender-romance`. Add it as a second option in the theme
   selector dropdown from input_9 (event registration form), and it must remain editable
   afterward from the event's settings/edit page, same as Botanical Bloom.

2. **Palette**
   - Beige `#e9ddcd`
   - Parchment `#f7efe3`
   - Ivory `#fffdf9`
   - Brown (text) `#4d372f`
   - Mauve `#9c7185`
   - Mauve-dark `#755062`
   - Lavender `#cbb8d0`

3. **Typography**
   - Cormorant Garamond — headings
   - DM Sans — body text
   - Great Vibes — script accents only (couple's names, closing signature line), same
     restrained usage as Botanical Bloom

4. **Motifs and surface treatment**
   - Large, low-opacity "✽" marks in the background — this theme's equivalent of
     Botanical Bloom's floral illustration, abstract rather than botanical
   - Light rings of dots as a secondary decorative accent
   - One uniform corner radius (~24–28px) on every card, tile, and button in this theme
   - Subtle glassmorphism: soft blur behind cards sitting over the background motifs

5. **Message placeholder** — reuse the admin-authored message field from input_8 section
   4 (already in the schema, theme-agnostic). Lavender Romance renders the QR code and
   the message together inside one glass/parchment card, styled after the mockup's "Dear
   [Guest Names]" panel — bordered, rounded, slightly translucent over the background
   motifs.

6. **Guest reference code** — the mockup shows a short label near the QR (e.g. "Guest
   code · MAUVE-021"). This is a purely decorative, theme-specific formatting of the
   guest's existing unique identifier already in the schema — not a new field. If
   formatting a short code from the existing identifier isn't trivial, it's fine to skip
   this decorative label for Lavender Romance rather than adding new data-model work.

7. **Applies to the existing page structure — this is a skin, not a restructure.** The
   guest scroll and the per-event admin page keep the exact order and behavior already
   built (input_7/8/9/10); Lavender Romance only supplies this theme's colors, fonts,
   motifs, and corner-radius into that structure.

## Part B — Admin headers

Neither admin view currently has a proper header. Add one to each, referencing the
`luxury-wedding-dashboard.html` mockup's top nav (brand + links + avatar) for visual
treatment only — not its literal link labels, which were placeholder.

1. **Top-level "Your Weddings" list** (the generic dashboard, stays un-themed per
   input_9 section 2) — a simple header showing the app name **"Weddings"**, styled
   consistently with the rest of that generic dashboard.

2. **Per-event admin page** — a themed header (using that event's active theme) showing
   the **wedding's title** (e.g. "Heartson & Makrama") instead of the app name, plus
   nav-links that jump to sections/pages on that same admin page: **Guest List**,
   **Wedding Details**, **Assets** (Part D below), **Other Details**. Guest List and
   Wedding Details jump to sections within the same page (in-page anchors, like the
   Itinerary jump pattern from input_8); Assets and Other Details link to their own
   pages/sections.

## Part C — Cameos (new guest-facing feature)

A new page in the guest flow, separate from Gallery, for photos of family/friends "who
wish to be seen" — including using it as a teaser for another upcoming wedding within
the same family/friend circle (a photo with a caption naming that couple).

1. **Admin-only.** The admin posts every Cameos entry; there is no guest upload and
   therefore no moderation/approval step needed (unlike a hypothetical guest-submission
   flow — that is explicitly not what this is).

2. **Each entry has a title, not just an image** — this is what distinguishes Cameos
   from Gallery. A caption/title accompanies each photo (e.g. the featured couple's
   names, or "Save the date" style text).

3. **Data model** — new table `cameo_photos`: `id`, `event_id`, `image_url`, `title`,
   `uploaded_at`. Same Cloudinary-backed persistent storage pattern as `gallery_photos`
   from input_11 (store the returned secure URL only, not image bytes).

4. **Guest-facing:** its own separate page, reached via its own square button in the
   existing button row from input_8 — the row stays **Cameos / Gallery / Other Details**,
   unchanged in shape from input_8; only Cameos is newly functional rather than an empty
   placeholder. Itinerary still has no button of its own and stays reachable only by
   scrolling, per the input_8/9 structure already in place.

## Part D — Admin "Assets" management screen (admin-only, not guest-facing)

This is purely a management convenience for the admin (referred to as "client" in
discussion — for now the admin is the only person with this access; a separate
client-facing login is a future idea, not something to build in this pass).

1. Add an **"Assets"** section/page on the per-event admin page (reachable from the
   header nav-link in Part B) with **two columns**: **left = Gallery**, **right =
   Cameos**.

2. In each column, the admin can **upload and delete** photos — Gallery photos as
   already spec'd in input_11 (image only), Cameos entries as spec'd in Part C (image +
   title, so the upload form for that column needs a title input alongside the file
   picker).

3. This is purely a UI/organization change on the admin side. It does **not** change the
   guest-facing structure from Part C — guests still see Gallery and Cameos as two fully
   separate pages, each with its own button; "Assets" combining them into one screen is
   an admin-only convenience for pushing content into both without navigating between
   two separate admin sections.

## Part E — Live window and downloads for Gallery and Cameos

Extends input_11's Gallery lifecycle to also cover Cameos, and adds a new capability:

1. **Live for the full event lifetime, including the 30-day post-wedding window.**
   Guests must keep seeing newly-added Gallery and Cameos photos not only before/during
   the wedding but for as long as the event itself exists — i.e. up until the 30-day
   auto-purge from input_3/input_11 deletes the event. An already-accepted guest
   revisiting during that window sees new photos without re-accepting, same live-view
   principle input_11 already established for Gallery, now explicitly extended to
   Cameos and to the post-wedding period.

2. **Guests can download photos**, from both Gallery and Cameos — not just view them.
   Add a download control per photo (or per-image download link) on both guest-facing
   pages.

## Suggested verification

- Register a new event with Lavender Romance selected; confirm the guest scroll and the
  per-event admin page both render this theme's colors/fonts/motifs, not Botanical
  Bloom's.
- Confirm the top-level dashboard shows a "Weddings" header, and a per-event admin page
  shows that wedding's title in its header with working nav-links (in-page jumps for
  Guest List/Wedding Details, page links for Assets/Other Details).
- Confirm the guest button row is still exactly Cameos / Gallery / Other Details, three
  separate pages, and that Itinerary still has no button of its own.
- As admin, open the Assets screen, upload a photo with a title into the Cameos column
  and a plain photo into the Gallery column; confirm both appear correctly and can be
  deleted from that same screen.
- As a guest, confirm Cameos entries show their title alongside the image, and Gallery
  entries do not.
- Confirm an already-accepted guest sees newly-added Gallery and Cameos photos on a
  later visit without re-accepting, including after the wedding date but before the
  30-day auto-purge.
- Confirm guests can download a photo from both Gallery and Cameos.
- Confirm Other Details remains a fully separate page, unaffected by any of this.

## Issues found

**Discrepancy between this input and input_8.md worth flagging plainly.**
This input says the guest button row "stays Cameos / Gallery / Other
Details, unchanged in shape from input_8" and that "Itinerary still has
no button of its own." Checked input_8.md directly: it explicitly
specified the three tiles as **Itinerary, Gallery, Other Details** (its
own §2 item 5), and that's exactly what got built and shipped. There was
never a Cameos tile before this input — Cameos is new here. Treated this
input's explicit, current instruction as authoritative regardless of the
historical mismatch: removed the Itinerary tile, added Cameos in its
place, left the Itinerary *section* exactly where it was in the scroll
(reachable only by scrolling, no button) — which happens to match what
this input describes as the end state, even though the framing of
"unchanged from input_8" doesn't. Flag if this reasoning doesn't match
what was intended.

**Visual references were on-disk, not attached, and turned out to be
full standalone mockups** (`public-wedding-invitation-updated.html`,
`luxury-wedding-dashboard.html` in Downloads) — read both in full.
Deliberately did **not** copy their page structure (hero → welcome card →
timeline-card → gallery-grid → developer-card → footer, all on one
un-gated page) since Part A §7 is explicit: "this is a skin, not a
restructure... only supplies this theme's colors, fonts, motifs, and
corner-radius into that [existing] structure." Pulled from the mockups
only: the exact CSS custom property values (colors), the three font
families and where each is used, the "✽" motif treatment, dot-ring
accents, the glass/blur card treatment, and the combined QR+message
card idea from the `.welcome` section — adapted to our real multi-state
guest flow (pending/declined/accepted/expired), which the mockup (a
single static happy-path scenario) doesn't model.

**Theme architecture decision: shared class vocabulary, not shared
markup.** Re-read input_7's original architecture note ("each theme is
self-contained: its own templates/partials and its own CSS") — confirms
per-theme template duplication (what's already built) is the intended
design, not a shortcut to fix. Given that, Lavender Romance's guest
templates are genuinely separate files (as Botanical Bloom's are), but
deliberately **reuse the exact same `bb-*` class names** rather than
inventing a parallel `lr-*` vocabulary — this was close to forced for the
*admin* pages anyway (`dashboard.ejs`/`assets.ejs` are shared, un-duplicated
templates that only swap which theme.css loads, so any theme's stylesheet
must define the same `bb-admin-*` classes dashboard.ejs already uses), so
keeping guest-page classes consistent with that avoids maintaining two
naming schemes for what's conceptually one system. No cross-theme
collision risk either way, since a page only ever loads one theme.css.

**Guest reference code (Part A §6) skipped, as explicitly permitted.**
"MAUVE-021"-style formatting isn't a real field — deriving a
theme-flavored short code from the existing passcode/id felt like it
would need a small naming-convention decision (word list per theme?
per-event seed?) that wasn't specified, and the input says skipping is
fine if not trivial. The guest's actual passcode is already shown/copyable
from the admin Guest List; nothing about verification changed.

**No image asset needed for Lavender Romance's motif** — the "✽" marks
and dot rings are pure CSS/pseudo-content (`<span class="bb-motif-mark">
✽</span>`, a radial-gradient dot pattern), matching how the mockup itself
implements them. `.bb-hero-floral`/`.bb-section-motif` (Botanical Bloom's
image-based motif classes) are set to `display: none` in Lavender
Romance's stylesheet since its templates don't reference that image tag
at all — no broken/missing-image risk.

**cameo_photos needed a `public_id` column beyond this input's literal
three-field spec** (`id, event_id, image_url, title, uploaded_at`) —
required for the same Cloudinary-deletion pattern already established
for `gallery_photos` in input_11 (destroy-by-public-id, not derivable
from the URL alone without extra parsing). Added it as an obvious
necessity, not a scope expansion.

**Part E §1 (live window through the 30-day post-wedding period)
required no code change** — verified rather than assumed. Gallery/Cameos
were already queried fresh from the database on every request (no
caching), gated only by passcode (not RSVP status or wedding date), and
an event simply doesn't exist to query once the 30-day auto-sweep
(input_3/input_11) deletes it. So "live until the event is purged" was
already true by construction; confirmed by reading through
`showGallery`/`showCameos` again rather than re-testing something
already covered in input_11's verification.

**Downloads implemented via Cloudinary's `fl_attachment` URL flag**
(inserted into the delivery URL, e.g. `/upload/fl_attachment/...`) rather
than a server-side proxy route — Cloudinary serves the same image with a
`Content-Disposition: attachment` header, so the browser downloads it
directly from Cloudinary's CDN instead of routing it through this app.
Applied to both Gallery and Cameos, both themes.

**Local testing covered everything except real Cloudinary calls** (same
limitation as input_11 — no credentials in this environment): full
regression pass on Botanical Bloom (security gate still holds — zero
leaked content on an unverified request — card+QR still works, itinerary
still scroll-only), the new admin header/nav/anchors, the Assets screen,
theme creation and mid-life theme switching (created an event as
Lavender Romance, verified its pages loaded that stylesheet and the
combined QR+message card, switched it back to Botanical Bloom, confirmed
it switched cleanly), and a Cloudinary-upload attempt failing gracefully
(500, logged, server stayed up) exactly like the deletion-failure path
verified in input_11. Real upload/download/delete against Cloudinary
still needs verifying live, same as before.
