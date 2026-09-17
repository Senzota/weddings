# Input 15 — Event Type Generalization + "Lady Gianna" Birthday Theme

Builds on input_14 (access_mode), independent of it. This generalizes events beyond
weddings and ships the first non-wedding theme, built from three reference mockups
(guest invitation page, and two admin dashboard variants — using the one that matches
the guest page's fonts, not the alternate).

## Part A — Event type generalization

1. Add `event_type` to `events`: `wedding` | `birthday`, default `wedding` (every
   existing event keeps behaving exactly as today).
2. No schema rename for existing fields. `couple_names` is reused to hold the
   celebrant's name for a birthday event; only its **label** changes contextually on the
   admin form — "Couple Names" for `wedding`, "Celebrant" for `birthday`.
3. Two new fields on `events`, both free text, both optional, usable by any event type
   (not birthday-exclusive):
   - `subtitle` — a short line under the main name, e.g. "is turning TWO!". Deliberately
     free text rather than a structured "age" field, so it also fits future event types
     (a graduation's "is Graduating!", an anniversary's "Celebrating 10 Years!") without
     another schema change.
   - `footer_note` — free text for the closing section, e.g. a short quote plus a line
     like "Elders, bring your favourite bottle." Optional for every event type.
4. `venue` already holds multi-line address text — reused as-is for the venue name +
   address block shown on the reference mockup, no change needed.
5. Event date/time: `wedding_date` keeps the calendar date. Add one more free-text
   field, e.g. `event_time_note` (e.g. "Starting 10:00am till Late") — deliberately a
   plain string, not a structured time type, per instruction.
6. **Theme selector is scoped by event_type.** Registering a `wedding` event only offers
   wedding themes (Botanical Bloom, Lavender Romance) in the dropdown; registering a
   `birthday` event only offers birthday themes (Lady Gianna, the only one for now).
   This keeps theme copy/visuals honest to the event type without scattering
   `event_type` conditionals through every template — the theme itself is already
   self-contained per input_7/13, this just filters which ones are offered.
7. Optional new field on `guests`: a short free-text description of that guest's invite
   grouping, e.g. "Family celebration · 4 guests" or "Kids & family · 3 guests" (seen in
   the admin reference mockup's "Invitation type" column). Purely descriptive, admin
   types it manually — not a fixed enum, not tied to any logic. Include only if trivial
   to add alongside the rest of this pass.

## Part B — "Lady Gianna" theme

New theme, slug `lady-gianna`, scoped to `event_type = birthday` only. Built with its
own full container set for both guest and admin pages (per input_13's "themes own their
containers" rule) — not a reskin of Botanical Bloom or Lavender Romance's layouts.

### Palette

- Blush `#f9ece6`, Ivory `#fdf7f2`, Paper `#fffdf9`
- Rose `#d98a96`, Rose-deep `#b96c78`
- Gold `#c6a15b`, Gold-pale `#f0dfb7`
- Sage `#a3b48c`, Sage-deep `#76886a`
- Brown (text) `#4a3a3a`, Muted `#7e6969`

### Typography

- Great Vibes — script, for the celebrant's name only
- Libre Baskerville — serif, for headings and most content copy
- DM Sans — body/UI text

(This is the pairing used by the guest invitation reference and the matching admin
dashboard reference — not the alternate Cormorant Garamond/Montserrat variant also
supplied, which is not used.)

### Motifs

- A thin gold inset border/frame around key panels (hero, cards)
- Floral corner illustrations combining pink/rose watercolor-style blooms with visible
  **sage-green leaves** — richer and more present than a thin single-color accent (per
  discussion: more green and floral presence than the initial draft had). Claude Code
  builds these as original SVG artwork in this palette (inspired by, but not copied
  from, the reference floral images shared — those carry a third-party watermark and
  should not be used directly in the product).
- Small heart/bow line-icon dividers between content sections
- Light glassmorphism cards (blurred, semi-transparent) over the floral/blush background
- Circular portrait framing with a small monogram badge (admin profile card)

### Guest-facing page — structure (from the invitation reference)

One continuous scroll, same overall pattern as every other theme (input_8/9 gating
rules apply identically regardless of theme):

1. **Hero** — full height, background photo with soft overlay, floral corners, gold
   inset border. Eyebrow "You're invited to celebrate", celebrant's name in large script,
   `subtitle` line (e.g. "is turning TWO!") with the milestone word emphasized in gold,
   a short intro message, "Come on in ↓" entry action.
2. **Gate panel** (post-passcode, subject to input_9's full server-side gating and
   input_14's access_mode) — QR code frame beside a personalized "Dear [Guest Name]"
   card containing the existing admin-authored message-placeholder text (input_8 §4),
   plus the guest's reference code chip.
3. **Itinerary** — an event-card showing the date, `event_time_note`, and venue/address
   side by side, then a vertical timeline of scheduled moments (reusing the existing
   itinerary data/feature, no schema change there).
4. **Gallery** — existing gallery feature, themed to match (photo grid + "see more"
   link).
5. **Footer** — a signature line, then `footer_note` rendered as free text (quote and/or
   closing note, whatever the admin enters).

Cameos and Other Details remain reachable via the existing button-row pattern
(input_12/13), themed to match Lady Gianna, unchanged in behavior.

### Admin page — structure (from the matching dashboard reference)

Full bespoke containers, not the generic input_10 grid:

- Sticky header: brand mark + event title, nav-links that jump to Guest List / Event
  Details / Assets sections on the same page, small avatar.
- **Profile card** — circular portrait with monogram badge, celebrant name in script, a
  short tagline, "Copy Invite Link" and "Edit details" actions.
- **Decorative photo panel** beside it — a full-bleed photo with a short caption.
- **Live stats row** — circular "stat bubble" tiles (e.g. invited guests, RSVPs received,
  days to go, photos uploaded).
- **Itinerary card** — the schedule, editable.
- **Assets card** — small preview grid + "Open Assets" link (this is the same Assets
  screen concept from input_12 Part D — Gallery/Cameos management in one place).
- **Event details card** — a small form: Celebrant, Milestone (`subtitle`), Date, Time
  (`event_time_note`), Venue — matching the reference mockup's field set exactly.
- **Guest list table** — guest name, invitation grouping description (Part A §7, if
  included), passcode, RSVP status, copy-code action.

## Suggested verification

- Register a new event as `birthday`; confirm only Lady Gianna appears in the theme
  selector (not Botanical Bloom/Lavender Romance), and registering a `wedding` event
  still only offers the two wedding themes.
- Confirm the admin form labels "Celebrant" instead of "Couple Names" for a `birthday`
  event, and that `subtitle`, `footer_note`, and `event_time_note` all save and display
  correctly on the guest page.
- Open a Lady Gianna guest page: confirm Hero → gate panel → Itinerary → Gallery →
  footer matches the reference structure, with visible green-leaf floral corners (not
  copied third-party art), and that input_9's full server-side passcode gating and
  input_14's access_mode both apply exactly as they do for wedding themes.
- Open a Lady Gianna admin page: confirm it uses its own bespoke containers (profile
  card, photo panel, stat bubbles, itinerary/assets cards, event-details form, guest
  table) — not the generic input_10 grid.
- Confirm Botanical Bloom and Lavender Romance are completely unaffected.

## Issues found

Implemented as specified. No reference mockup image files were attached to the
repository alongside this input (only this text file) — Lady Gianna's palette,
typography, motifs and structure were all built directly from the written spec
above, which is detailed enough to implement without them. Real visual
confirmation in a browser is still recommended since I have no screenshot
tooling.

Notes and judgment calls:

- **Part A — schema**: `event_type` (default `'wedding'`), `subtitle`, `footer_note`,
  `event_time_note` added to `events`; `invite_group` (§A7) added to `guests`. All
  idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, all nullable/defaulted so
  every pre-existing event and caller keeps behaving exactly as before.
- **Theme scoping**: `config/themes.js` now carries an `eventType` per theme plus
  `themesForEventType()`/`DEFAULT_THEME_BY_EVENT_TYPE`. The create and edit admin
  forms filter the theme `<select>` client-side (plain JS, no new endpoint) as the
  event-type selector changes; `admin.controller.js`'s `resolveTheme()` re-validates
  server-side on every create/update so a stale or direct POST can't pair a theme
  with the wrong event type — it silently falls back to that type's default theme
  rather than erroring. Verified: registering a `wedding` with `theme=lady-gianna`
  in the POST body directly (bypassing the JS filter) was clamped back to
  `botanical-bloom`.
- **Data-loss fix required for Lady Gianna's partial dashboard forms**: the
  "Event details" and "Itinerary" cards on Lady Gianna's dashboard each submit only
  a handful of fields (by design, matching the reference mockup's smaller
  cards) rather than the full edit-form field set every other save path submits.
  `eventModel.update()` previously set `itinerary`/`invitation_message`/
  `contact_details` unconditionally (no `COALESCE`), so a partial submit would have
  silently wiped them. Fixed by switching those three (plus the three new fields)
  to `COALESCE`, with an `absentToNull()` helper that only substitutes `NULL` for a
  field truly absent from the request body — an explicit empty string (a real "clear
  this field" from the full edit form) still passes through and clears as before.
  Verified directly against the DB: an itinerary-only save left subtitle/
  invitation_message/footer_note/theme/event_type/access_mode untouched, and an
  event-details-only save left itinerary/invitation_message untouched.
- **Hero's "short intro message"**: the spec lists this as separate Hero copy from
  the Gate panel's "Dear [Guest]" card (which explicitly reuses the existing
  `invitation_message` field, input_8 §4). Since there's only one message field on
  the schema, I used a fixed, non-admin-editable line ("Join us as we celebrate this
  joyous occasion...") for the Hero and kept `invitation_message` exclusively in the
  Gate panel — flagging this as a judgment call in case a separate short-intro field
  was actually intended.
- **Gallery preview** (Part B item 4, "existing gallery feature... photo grid + 'see
  more' link"): implemented as an inline preview (first 6 photos) directly in the
  scroll, linking to the existing dedicated `/gallery` route for the full grid —
  fetched only for `theme === 'lady-gianna'` and only once we're past the passcode
  gate (never leaked pre-verification), so it adds no query for the other themes.
- **Floral corner art**: original SVG (`corner-floral.svg`), hand-built in the
  spec's palette (rose blooms + visible sage-green leaves, richer than a thin
  accent) — not copied from any reference image.
- **input_14 (access_mode) applies identically**: Door Scanner tile hidden unless
  `closed`, guest-list section (and its bulk-add form) hidden entirely for `open`,
  full server-side passcode gating (input_9) with `state` values `null`/`open`/
  `card`/`confirmed`/`qr`/`expired` exactly as the other two themes. Verified for
  both `open` and `closed` Lady Gianna events.
- **Guest bulk-add format** extended from `Name, seat count` to an optional third
  field `Name, seat count, invitation type` — a line with just two fields still
  works exactly as before. Added an "Invitation type" column to both existing
  themes' guest tables and to the Excel export, in addition to Lady Gianna's own
  table, so the feature is visible everywhere guests are listed, not just the new
  theme.
- **Local verification** (Postgres, birthday `closed`/`open` events, both new admin
  forms, both existing themes for regression): all of the "Suggested verification"
  checklist items confirmed via curl + direct DB queries — theme scoping in both
  directions, label swap data flows through (rendered client-side via JS, not
  re-verified pixel-for-pixel without a browser), subtitle/footer_note/
  event_time_note save and display, full Hero→Gate→Itinerary→Gallery→Footer
  structure, green-leaf floral corners served correctly, bespoke admin containers
  (not the generic grid), and Botanical Bloom/Lavender Romance completely
  unaffected (existing events retained `event_type='wedding'`, their dashboards'
  theme selects only ever offer wedding themes, existing invite pages still render).
  All test events were deleted after verification.
