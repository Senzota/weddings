# Input 8 — Live-Test Fixes, Page Restructure, and Message Placeholder

Input 7 is confirmed live and working structurally. This input covers what came up from
actually looking at the live site plus a real restructure of the guest flow that was
worked out after input 7 was already built — a few things change from what's currently
live, not just get added to it.

## 1. Fix: page background color

The live page's background renders as `#8f887e` (a washed-out gray-taupe). It should be
Design 1's actual cream, `#f6f2e7` — confirmed against the reference image, and this
value is already correctly used by the passcode-entry overlay/modal. Only the main
page's background needs correcting to match. This is also very likely why the terracotta
text currently reads as low-contrast/muddy — it's sitting on the wrong background color.

*(The earlier reported broken hero-photo issue has since resolved itself after a reload
— no fix needed there.)*

## 2. Restructure: one continuous scroll ("Invitation" page)

This replaces the current structure where the landing page and itinerary are separate
routes. Going forward, Landing + Itinerary + the couple's own contact details all live on
**one continuous scrolling page**, in this order, top to bottom:

1. **Hero** — the couple/host photo at full page height, composed with roughly 20%
   breathing room top and bottom so the subject isn't cropped tight against the edges.
   The couple's names, date, and floral motif sit over/beside this, per Design 1.
2. **Code-entry overlay** — unchanged from input 7 (opens on "Come on in," no full page
   navigation).
3. **QR code** — once accepted, appears directly below the hero.
4. **Message placeholder** — see section 3 below. Sits below the QR.
5. **Button row** — three square button tiles: Itinerary, Gallery, Other Details (see
   section 5 on their shape).
6. **Itinerary section** — the itinerary content itself, further down the same scroll,
   reached by scrolling or by the Itinerary button jumping to it in-page (not a page
   navigation).
7. **Couple's own contact details** — at the very bottom of the scroll.

This scroll behaves identically on mobile and desktop — not a mobile-only pattern.

The hero photo appears **only once, at the top**. It does not repeat further down the
scroll — the itinerary and contacts sections use the active theme's own decorative
background instead (florals/motifs, or a faded/subtle version of the photo, depending on
the theme), not the same prominent photo again.

## 3. Remove the old "invitation card" component

The card element used in the pending/accepted/declined views (input 3 and input 4) is no
longer relevant and should be removed. Its job is absorbed into the Hero section (which
already carries the couple's names/date) plus the new message placeholder below the QR
(section 4). Whatever needs to show depending on the guest's current state — the
Accept/Decline buttons for a pending guest, the welcome-back banner for a guest who
declined, the "this invite is no longer active" message for an expired gatepass — now
renders directly in this scroll near the Hero/QR/message area, not inside a separate card
box. The underlying state machine from input 3/4 (pending/accepted/declined/expired and
its transition rules) does not change — only its container does.

## 4. Admin-authored message, rendered in a themed placeholder

Add a new per-event field the admin fills in — free text, written per wedding, not fixed
copy Claude Code invents. This text is **not** rendered as plain unstyled text: it needs
to sit inside a designed placeholder/frame that belongs to the active theme (a bordered
box, ornate frame, or whatever visual treatment Design 1 — soon "Botanical Bloom" —
calls for), so it looks like a deliberate part of the invitation rather than a dumped
paragraph. Since themes are token-based (per input 7's architecture), this placeholder
treatment should be one of the things a theme defines, alongside its colors/fonts/motifs.

This requires a corresponding **admin dashboard change**: add a text field on the event
edit form for this message, following the same pattern as the existing
`accept_button_text` / `decline_button_text` / `decline_message` fields.

## 5. Button style: square tiles, not a full-width row

The Itinerary / Gallery / Other Details buttons should render as square tiles (e.g. a
compact row or grid of squares), not stretched across the full page width as a single
long bar.

## 6. Gallery and Other Details — separate pages, empty for now

Both stay as separate routes/pages (not part of the scroll), each reached via its own
square button from the button row:

- **Gallery** — its real functionality (admin photo upload, live updates for
  already-accepted guests, Cloudinary storage, etc.) is already spec'd in input_6.md and
  is intentionally on hold for now. For this input, just scaffold it as its own empty
  page, styled with the active theme, reachable via its button — no upload logic needs
  building yet.
- **Other Details** — a separate page for Weddings 103's own contact info (not the
  couple's), meant to pick up future clients. For now, leave it empty/placeholder
  content — just get the page itself in place, styled to blend with whichever theme that
  wedding is using, reachable via its own button.

As usual, each page (the Invitation scroll page, Gallery, Other Details) should live in
its own separate template/route file, not combined into one.

## 7. Optional housekeeping

If it's trivial to do alongside this pass, rename the theme slug from `design-1` to
`botanical-bloom` (the name we've settled on) — not essential if it adds friction to the
rest of this input.

## Suggested verification

- Confirm the page background reads as the correct cream throughout, matching the
  overlay's color.
- Confirm the whole guest experience for one event is a single scroll — Hero → QR →
  message placeholder → button row → Itinerary → couple's contacts — on both a phone
  width and a desktop width, with no separate navigation needed until Gallery or Other
  Details is clicked.
- Confirm no separate "card" element remains anywhere in the pending/accepted/declined
  views.
- Confirm the admin can enter/edit the new message field, and that it renders inside a
  styled placeholder, not as plain text.
- Confirm the three buttons render as square tiles.
- Confirm Gallery and Other Details each open as their own (currently empty) page via
  their button, styled with the active theme.

## Issues found

**Background bug — root cause confirmed, not just patched.** The reported
`#8f887e` is *exactly* `rgba(58, 49, 40, 0.55)` (the passcode overlay's
dark backdrop) composited over the cream `#f6f2e7` page — verified by
computing that blend and getting `#8f887e` to the hex digit. So the
overlay was rendering at full-viewport over the page at all times, not
just when opened. Cause: the old CSS set `.d1-overlay { display: flex }`
unconditionally and relied on a `.d1-overlay[hidden] { display: none }`
specificity trick (plus the DOM `hidden` attribute) to hide it — fragile,
and apparently didn't hold in the real browser it was tested in. Rebuilt
without that pattern: `.bb-overlay` now defaults to `display: none`, and
only a JS-toggled `.is-open` class shows it — no attribute-selector
specificity involved at all. Please confirm the page now reads as clean
cream in a real browser; I can verify the CSS rule is structurally
correct but, same limitation as input_7, cannot render and look at it
myself.

**Message-placeholder and message visibility, both judgment calls:**
- Named the new field `invitation_message` (not literally "message") to
  keep it unambiguous alongside `decline_message`.
- Decided the message placeholder and the whole QR/accept-decline/banner
  area only appear once a guest is verified in that request (no session
  exists to remember verification across a page reload) — an unverified
  visitor sees Hero → overlay → button row → Itinerary → Contacts, with
  the guest-specific middle section simply absent until they submit a
  correct passcode. The verify/RSVP POSTs render the *same* full
  `invitation.ejs` template, now with the guest filled in, so after that
  one exchange the guest has the complete single-scroll experience
  described in the spec with no further navigation.
- The message renders regardless of RSVP state (pending/declined/
  accepted/expired) whenever `invitation_message` is set — treated it as
  a constant note from the couple, not something that changes with the
  guest's response.

**New `contact_details` field, not explicitly named in this input but
required by the spec's own scroll structure:** section 2 lists "couple's
own contact details" as scroll item 7, and section 4 only calls out an
admin field for the message placeholder — so a second nullable
`events.contact_details` field (same textarea pattern) was added to
actually populate that section. Flag if this should instead reuse
existing data or be named/structured differently.

**Theme rename to `botanical-bloom` done as part of this pass** (item 7)
since the folder structure was already being touched — `views/guest/
themes/design-1/` → `.../botanical-bloom/`, same for `public/themes/`,
schema default updated, and existing rows migrated with `UPDATE events
SET theme = 'botanical-bloom' WHERE theme = 'design-1'` (idempotent, safe
to re-run).

**Card removal confirmed structurally:** grepped the rendered HTML for
any remaining boxed-card markup (`d1-card-img`/`bb-card-img`/similar) —
none found in any state. The invitation card's old jobs are now fully
absorbed: couple names/date/venue live in the Hero, and the
personalization role moves to the new message placeholder, exactly as
described.

**Hero photo "20% breathing room":** interpreted as the photo being
inset from the hero section's edges via padding (10vh top, 10vh bottom,
6vw sides) with `object-fit: cover` filling the rest, rather than a
strict crop ratio on the image itself — the input didn't specify an
exact mechanism, this was the most literal reading of "roughly 20%...
top and bottom."

**Local verification (all passed, structurally — see the browser caveat
above):** unverified page shows exactly Hero/overlay/tiles/Itinerary/
Contacts and nothing else; wrong passcode redirects and reopens the
overlay with the error; all three guest states (pending with custom
button text, declined with welcome-back banner, accepted-and-checked-in-
long-ago expired, accepted-not-checked-in QR) rendered correctly with the
message frame present in every case; Gallery and Other Details pages
both load (empty placeholders, theme-styled, with a link back); Itinerary
and Contacts sections show real admin-entered content when set.
