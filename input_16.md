# Input 16 — Lady Gianna Fixes: Layout, Overflow Bug, Placeholder Leak, Florals

Follow-up to input_15, based on live review of the deployed Lady Gianna theme. Four
fixes/changes, all scoped to polish and correctness — no new architecture.

## 1. Merge the profile card and the decorative photo panel into one container

Currently the celebrant profile (circular photo, name, tagline, action buttons) and the
decorative photo panel (large photo with caption) render as two separate stacked cards.
Merge these into **one single container**: the profile content (photo circle, name,
buttons) sits on one side against the card's solid background, and the larger photo
bleeds in from the other side with a **fade/gradient mask on its inner edge** (e.g. a
CSS `mask-image: linear-gradient(...)` or an overlay gradient matching the card's
background color) so the photo dissolves into the card rather than meeting it at a hard
edge. The result should read as one unified panel, not two separate blocks stacked
vertically.

## 2. Fix: "Time" field text is cut off on the Event Details form

On the per-event admin page's Event Details card, the Time field (e.g. "Starting
10:00am till Late") is visibly truncated — the input is too narrow for its content and
the text is cut off rather than wrapping, shrinking, or scrolling. Fix the field's
layout so the full value is always visible/readable (wider input, smaller font at that
width, or textarea-style wrapping — Claude Code's call on the exact approach).

## 3. Fix: guest bulk-add placeholder text leaks across events/themes

The guest-list bulk-add textarea's example text ("Amara, 4, Family celebration" /
"Kito, 3, Kids & family") is birthday-flavored and is showing up on **non-birthday
events** too (confirmed: appeared on a wedding event, "Makrama"). This placeholder
should not be hardcoded globally. Either make it generic and theme/event-type-neutral
(e.g. "Name, seat count (optionally, invitation type)" with a neutral example like
"Sarah, 2"), or have it vary by the event's theme/event type if that's not much extra
work — Claude Code's call on which, but it must stop showing birthday-specific example
text on non-birthday events.

## 4. Floral decoration: use supplied images instead of generated SVG

Input_15 asked for original SVG floral corner artwork in Lady Gianna's palette. That
either wasn't built or isn't rendering — the deployed theme currently has no floral
decoration at all. Rather than continuing to attempt hand-coded vector art, the actual
floral corner images will be supplied directly (proper licensed/unwatermarked PNGs with
transparent backgrounds, in the blush/rose/gold/sage palette already established) —
these will be sent separately and should be added to the project's static assets (e.g.
under `public/assets/img/themes/lady-gianna/`) and applied as the corner decorations on
both the guest-facing Hero/section backgrounds and the admin page, per input_15's motif
placement (top-left / bottom-right corners, behind content, at reduced opacity where it
sits behind cards). No new admin-facing "choose your own theme image" feature is needed
for this — these are fixed assets for the Lady Gianna theme, same as any other theme's
fixed decorative assets.

## Suggested verification

- Confirm the profile info and the decorative photo now render as one merged container
  with a visible fade where the photo meets the card background, not two stacked cards.
- Confirm the Time field's full value is visible without truncation at normal and
  narrow (mobile) widths.
- Confirm the guest bulk-add placeholder/example text is no longer birthday-specific on
  a non-birthday event.
- Once the floral images are supplied and added, confirm they appear on both the guest
  page and the admin page in the correct corner positions, at a subtlety that doesn't
  obscure content.

## Issues found

All four items implemented and verified locally, including §4 once the user
supplied the actual floral artwork as a follow-up. Notes below.

- **§1 Merge profile + photo panel**: replaced the two separate `<article>` cards
  with one `.lg-admin-profile-merged` container — profile info sits on a solid
  `var(--lg-paper)` background on the left, the photo fills the remaining width on
  the right with `mask-image: linear-gradient(to right, transparent, black 30%)`
  fading its inner edge into the card rather than meeting the info panel at a hard
  line. Stacks vertically under 640px with the fade direction flipped to
  top-to-bottom. Verified structurally: exactly one `lg-admin-profile-merged`
  element renders, the old separate `lg-admin-photo` card is gone.
- **§2 Time field truncation**: gave the Time (and Venue, same underlying risk —
  both can hold long free text) fields their own `lg-field-wide` modifier
  (`grid-column: span 2`, collapsing to a full row under 640px) instead of sharing
  the same narrow column width as short fields like Date. Confirmed the wrapping
  divs carry the new class.
- **§3 Placeholder leak**: went with the "generic/neutral everywhere" option rather
  than varying by theme — replaced the birthday-flavored example text
  (`Amara, 4, Family celebration` / `Kito, 3, Kids & family`) with the same neutral
  `Sarah, 2` / `James, 4, VIP` example across all three dashboards (Botanical
  Bloom, Lavender Romance, Lady Gianna), so there's no theme-specific copy left to
  leak in the first place. I could not fully root-cause how Lady Gianna's exact
  placeholder text ended up on a Lavender Romance wedding event ("Makrama") — the
  three dashboard files each had their own hardcoded placeholder string with no
  shared source, so a copy/paste across files or view-level cross-contamination
  seems unlikely from reading the code; flagging this in case it recurs after this
  fix, which would point to something more structural (e.g. Express's view cache).
- **§4 Floral images**: no image was attached to the input file itself, so I first
  removed the hand-coded SVG corner attempt from input_15 entirely (confirmed via
  local testing that its `<img>` tags *were* present and correctly pathed in the
  rendered HTML, so "no floral decoration at all" was likely the art itself
  reading as an unnoticeable smudge at that size/opacity against the Hero photo,
  not a broken reference — either way, per this input's explicit instruction, I
  stopped attempting vector art rather than continuing to tune it) and replaced it
  with a guarded reference wired through a new `utils/assetExists.js` helper
  (`app.locals.assetExists`, backed by `fs.existsSync`), so nothing renders (no
  broken-image icon) until a real file lands at the expected path.

  The user then supplied the actual artwork as a follow-up (pasted in chat, saved
  to the project root as `Lady Gianna.avif` since I have no way to pull image
  bytes out of a chat attachment directly — I asked them to save it as a file
  instead). It's a single AVIF frame image, not a small tileable corner icon: one
  rose/gold rectangular border with floral clusters baked into its own top-left
  and bottom-right corners only (not all four), with mostly-clear space between.
  Copied it via `cp` (not the Read/Write tools, which would have corrupted the
  binary by treating it as text) to
  `public/assets/img/themes/lady-gianna/corner-floral.avif`.

  Because the art is baked into one full-frame image rather than a single
  mirrorable corner motif, I redesigned `.lg-corner` from "one small icon,
  mirrored via CSS `transform` into all four corners" (the original SVG plan) to
  "one small window (`object-fit: cover` + `object-position: top left` /
  `bottom right`) onto the two corners the source image actually has art in" —
  mirroring the full frame would have doubled its own baked-in border and put
  blooms in the wrong corners. Applied at full strength on the Hero and at a
  reduced-opacity `.lg-corner--subtle` variant on the Itinerary section, Footer,
  and the admin dashboard's merged profile card, matching input_15's "top-left /
  bottom-right... behind cards" placement.

  Also found and fixed a real bug while wiring this in: `express.static`'s
  bundled `mime` package (v1.6.0, hoisted from `send`) predates AVIF and was
  serving the file as `application/octet-stream` instead of `image/avif` — most
  browsers still render an `<img>` via content-sniffing regardless, but that's
  fragile to depend on. Registered the correct type explicitly via
  `express.static.mime.define({ 'image/avif': ['avif'] })` in `server.js`, and
  confirmed the `Content-Type` header locally afterward.

  Verified locally end-to-end: with the file present, exactly the expected corner
  `<img>` tags render in each of the four placements (Hero ×2, Itinerary,
  Footer, admin dashboard); the asset itself now serves as `image/avif`. The
  unrelated heart/bow section divider (`divider-heart.svg`, never part of this
  bug report) was left untouched throughout and still renders normally.
- No database schema changes in this input — nothing to migrate.
