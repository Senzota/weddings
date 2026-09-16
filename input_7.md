# Input 7 — Guest Page Flow, Theme Architecture, and "Design 1"

This starts the styling ("Urembo") work. It sets two things in place before any CSS
gets written: the final shape/order of the guest-facing pages (no new functionality —
everything below is already built, this just gives it its visual form and confirms the
sequence), and a **themes folder structure** so more designs can be added later without
reorganizing the app.

A reference image for the first design is committed alongside this file:
`design-1-landing-reference.png`. That's the actual target to match for the landing
page described below — colors, type, layout, spacing all come from it, not from the
description here (the description is just to make the reference explicit in writing).

## 1. The full guest flow (4 pages + 1 overlay)

In order, for a guest opening the shared invite link:

1. **Landing page** — a public splash page, same for every guest of a given wedding.
   Shows the couple's names, wedding date, and a photo, with a "Come on in" button.
   This is "Design 1" (see below).
2. **Code-entry overlay** — clicking "Come on in" opens an overlay/modal on top of the
   landing page (not a full page navigation) asking the guest for their passcode. This
   reuses the existing passcode-verification logic from input_3.md exactly as-is — the
   only change is presentation: an inline overlay instead of a separate page load. Only
   after a correct code does the guest move on to page 2.
3. **Invitation / reveal page** — the existing state-dependent view from input_3.md and
   input_4.md (pending → card + Accept/Decline; declined → welcome-back banner + card +
   Accept; accepted → card + QR together; expired → inactive message). No behavior
   changes here, just needs Design 1's visual treatment applied.
4. **Itinerary / program page** — schedule of the day's events (already planned in the
   earlier Canva discussion; if this doesn't exist as a data-backed page yet, treat the
   content as admin-entered per event, similar to other event fields).
5. **Gallery page** — from input_6.md, once that's built.

Total: **4 real pages + 1 overlay**, all belonging to one continuous guest experience,
not separate disconnected pages — matching Design 1's look throughout, not just the
landing page.

## 2. Theme folder architecture

Introduce a `themes/` structure now, even though only one theme exists today, so adding
a second design later is a matter of adding a folder, not restructuring the app:

- Each theme is self-contained: its own templates/partials and its own CSS (and any
  theme-specific assets like the floral illustration below), grouped under a shared
  `themes/<theme-name>/` convention — Claude Code's call on the exact folder layout
  given how views/public are currently organized.
- Add a `theme` field on the `events` table (e.g. a slug like `"design-1"`), defaulting
  to the one theme that exists. Nothing needs to read this dynamically yet in a
  theme-picker UI — that's future work — but having the column now avoids a schema
  change later when a second theme is added and an admin needs to choose between them.
- For now, exactly one theme folder exists: **Design 1** (below), and every event uses
  it by default.

## 3. Design 1 — the landing page (see reference image)

Data that comes from the admin/event record (already in the schema, just needs to be
rendered into this template):
- Couple names
- Wedding date
- A photo (admin-uploaded — reuse the existing card-image upload pattern for this, or
  the same mechanism input_6.md sets up for gallery photos, Claude Code's call on which
  makes more sense to reuse)

Layout, from the reference image:
- Two-column split. Left column: a botanical floral illustration at the top, the
  wedding date in a small clean sans-serif above the couple's names, the couple's names
  in a large flowing script/handwritten-style font, and a pill-shaped outline button
  reading "Come on in" near the bottom. Right column: a full-height photo of the couple,
  edge-to-edge, no cropping into the left column.
- Palette: warm cream/ivory background, dusty-rose/terracotta for the script text and
  button outline+label, muted sage green in the floral illustration.
- This needs a mobile layout too (per earlier discussion) — the reference image is a
  wide desktop layout; on a narrow phone screen this most likely needs to stack (photo
  on top or as a background, content below) rather than staying side-by-side. Claude
  Code's call on the exact mobile treatment, but it must not just shrink the two-column
  layout until it's illegible.

Treat "Come on in" as static text for now — not worth adding another per-event
customizable-text field for this unless it turns out to be easy to do at the same time
as the other customizable button/message fields already in the schema.

## Suggested verification

- Load the landing page for a real event, confirm the couple's name/date/photo pull
  correctly from that event's data (not hardcoded).
- Load it on a phone-width screen, confirm the layout adapts sensibly rather than
  breaking.
- Click "Come on in", confirm the code-entry overlay appears without a full page
  reload, and that entering a correct code proceeds to the invitation/reveal page.
- Confirm the invitation/reveal, itinerary, and gallery pages carry the same visual
  language (colors/fonts) as the landing page, so the whole flow feels like one design,
  not a styled landing page followed by unstyled pages.
- Confirm the `events` table now has a `theme` column defaulting to the one theme that
  exists.

## Issues found

**Important limitation — please actually look at this in a browser.** This
environment has no browser/screenshot tool, so everything below was
verified structurally (curl + HTML inspection: correct data binding,
correct routing/state transitions, assets returning 200, correct CSS
classes present) but **never actually rendered and looked at**. Please
open the landing page for a real event and compare it against
`design-1-landing-reference.png` yourself before treating this as visually
done — colors, spacing, and font rendering can only be confirmed by eye.

**Colors and fonts — sampled/chosen, not guessed:**
- Pulled exact pixel colors from the reference PNG rather than eyeballing:
  cream background `#f6f2e7`, the script text and button
  outline/label `#9f5b4c` (same color for both, confirmed by sampling
  each separately). A muted sage `#7f8f5f` is defined for future accent
  use but the leaf tones in the illustration itself are whatever they are
  in the source art.
- The reference doesn't embed font names, so the actual typefaces are a
  judgment call: **Beau Rivage** (Google Fonts) for the couple-names
  script — closest free match to the reference's loose flowing
  brush-pen lettering — and **Cormorant Garamond** for everything else
  (date, body text, button label), matching the reference's thin elegant
  serif. Worth a second look against the reference to confirm these read
  right at actual size.

**Floral illustration — extracted from the reference image itself, not
redrawn or sourced elsewhere:**
- Cropped the top-left botanical illustration directly out of
  `design-1-landing-reference.png` (a project asset already committed for
  this purpose) and chroma-keyed its cream background to transparent with
  a soft feathered edge, so it composites cleanly on any background color.
  Saved to `public/themes/design-1/img/floral-illustration.png`.
- The second flower cluster visible near the bottom-right of the
  reference (overlapping the couple's photo) could **not** be cleanly
  extracted the same way — it's blended directly into the photograph
  itself with no separable edge, not a distinct illustration layer. The
  written layout description in this file never actually calls for it
  (only "Left column: a botanical floral illustration... Right column: a
  full-height photo"), so it was left out rather than approximated badly.
  Flag if that second flourish matters enough to source separately.

**Routing redesign (behavior change from input_3, presentation only):**
- `GET /invite/:eventId` is now the landing page (was the passcode form).
  The passcode form itself moved into the overlay, matching the "not a
  full page navigation" requirement — reused the exact same
  `POST /invite/:eventId/verify` endpoint and guest-lookup logic from
  input_3.md, unchanged.
- A wrong passcode now redirects to `/invite/:eventId?error=invalid`
  (302) instead of re-rendering an error inline, so the overlay reopens
  itself via a small inline script reading that query param — avoids
  resubmitting the passcode on refresh and keeps the "one continuous
  experience" illusion even after a failed attempt.
- `not_found` (bad event id) and `not_live` (draft event) now render a
  plain `guest/error.ejs` outside the theme system entirely, since
  they're edge cases never mentioned as needing Design 1 treatment in
  this input — a minimal on-brand-enough cream page, not fully styled.

**Itinerary — new page + field, scope judgment calls:**
- Added a nullable `events.itinerary` TEXT column, edited by the admin as
  plain newline-separated lines (same convention as the existing
  guest-bulk-add textarea), rendered as a simple list.
- Decided it's reachable at `GET /invite/:eventId/itinerary` **without**
  re-entering a passcode, same as the landing page — it's identical for
  every guest of that wedding (just a schedule, no guest-specific data),
  so gating it behind a passcode felt like friction with no real
  protection purpose. Linked from the reveal page (card/QR states) so
  it's reachable as part of the flow.

**Theme architecture is actually wired up, not just a placeholder
column:** `events.theme` (default `'design-1'`) is read at render time —
every guest route resolves its template via
`guest/themes/${event.theme}/...` — so adding a second theme later really
is "add a `views/guest/themes/<slug>/` + `public/themes/<slug>/` folder,"
no controller branching required, per the input's own goal for this.

**Deliberately out of scope, per your instruction:** the gallery page
(5th page, from input_6.md) — input_6 hasn't been built yet, so it's not
referenced anywhere in this pass.
