# Input 17 — Floral Background Fix (supersedes input_16 #4)

Follow-up to input_16, based on live review of the deployed Lady Gianna theme after
input_16 #4 shipped. The floral corner-crop approach doesn't work and is replaced here.

## Context

The floral asset supplied for input_16 #4 (`lady-gianna-floral-frame-reference.png`,
attached alongside this input) is a single tall portrait **frame** image — peach/rose
watercolor roses with sage-green eucalyptus clustered at the top and bottom edges, and a
blank/white center — not four separate corner crops. It was designed to be used whole, as
a border/frame around content, not cut into small pieces.

The current implementation clips small rectangles out of this image for corner
decoration. Live review shows this looks bad: a visibly hard-edged rectangular box (with
its own white/cream backing) sitting awkwardly on top of other content — confirmed next
to "The Itinerary" heading on the guest page. This input replaces that approach entirely.
Input_16 #4's corner-decoration instruction is superseded by what follows.

## Fix

### 1. Guest-facing page

- **Hero (celebrant photo) background — unchanged.** Do not touch the Hero section; this
  fix does not affect it.
- **Everything after the Hero** — the Gate/personalized panel, Itinerary, Gallery, and
  Footer — should use the floral image as a **single continuous background for that whole
  span of the page**, not as small clipped corner assets.
- Because the source image is a tall frame with a blank middle, Claude Code's call on the
  exact CSS technique to make this look right across a scrolling page of variable length
  (e.g. anchoring the artwork at the top of the span and again at the bottom, so the rose/
  eucalyptus clusters read cleanly near the top and bottom edges, with the theme's normal
  blush background filling any remaining space in between) — the requirement is the
  outcome: floral clusters visible and well-composed, no hard rectangular crop edges
  anywhere, no stretching/distortion that mangles the artwork.
- Apply a semi-transparent overlay/tint in the Lady Gianna blush palette (`#f9ece6` /
  `#fdf7f2`) over the floral background so every existing element on top of it — the Gate/
  personalized card, the Itinerary card, the Cameos/Gallery/Other Details buttons, the
  Gallery grid, the footer text — stays fully legible. Same treatment logic already used
  for the Hero's photo-with-overlay.
- Remove the current corner-clip implementation completely (the boxed floral clip
  currently sitting beside "The Itinerary" heading, and any equivalent instance elsewhere
  on the guest page).

### 2. Admin page

- Apply the same floral-image-as-background treatment (not corner clips) to the admin
  dashboard page for the Lady Gianna theme.
- Opacity/tint low enough that all dashboard content — stats, tables, form fields, guest
  list — stays fully readable. Claude Code's call on exactly which panel(s) or how much of
  the page this covers, following the same "no hard-cropped rectangle" principle as the
  guest page.

## Suggested verification

- Confirm no small rectangular floral "corner clip" images remain anywhere in the Lady
  Gianna theme, guest page or admin page.
- Confirm the guest page, from the Gate panel down through the footer, shows the floral
  image as a background with a legible blush overlay, and that the Hero's baby-photo
  background is completely untouched.
- Confirm the admin dashboard shows the same floral-background treatment, with all
  dashboard data/text still fully readable.
- Confirm the floral clusters themselves look intentional and well-composed (not
  stretched, not cropped into an awkward rectangle) at both normal and mobile widths.

## Issues found

Implemented as specified, verified locally. No deviations. Notes on the approach:

- **Asset swap.** input_16 §4's version of the image had been saved as AVIF
  (converted from a chat-pasted file, since I have no way to pull image bytes
  directly out of a chat attachment). This input's exact reference file,
  `lady-gianna-floral-frame-reference.png`, turned up already synced into the
  project (`Theme Visuals/`) — same artwork, real PNG with a genuine alpha
  channel and universal browser support, so I switched to it: copied to
  `public/assets/img/themes/lady-gianna/corner-floral.png`, removed the old
  `.avif` copy, updated all references, and removed the now-unused
  `express.static.mime.define({'image/avif': ...})` fix from `server.js` that
  the AVIF file had needed (confirmed via `file`: the PNG's native type is
  already served correctly with no extra registration).
- **Hero left untouched**, exactly as instructed — its two `.lg-corner` images
  (top-left/bottom-right windows onto the source, from input_16 §4) are still
  there unchanged. Confirmed via curl that they're still present after this
  change.
- **Guest page (Gate → Footer)**: wrapped that whole span — the Gate/
  personalized panel, tile row, Itinerary, Gallery, and Footer — in one new
  `.lg-post-hero` container. Two copies of the same source image sit at its very
  top and very bottom as full-width bands (`object-fit: cover` +
  `object-position: top center` / `bottom center`, height `clamp(200px, 28vw,
  360px)`), so each shows only that edge of the source rather than stretching or
  cropping into a small floating rectangle — the specific complaint from live
  review. A semi-transparent blush tint (`rgba(249, 236, 230, 0.82)`) sits above
  the bands. All the removed corner-clip `<img>` tags (Itinerary, Footer) are
  gone.
- **Stacking order fix required**: a positioned descendant with `z-index: auto`
  actually paints *after* normal in-flow, non-positioned siblings in the CSS
  painting order (counter-intuitively) — so the floral bands would have covered
  plain elements like the tile-row buttons and the heart divider, which aren't
  independently positioned. Fixed by making `.lg-post-hero` its own stacking
  context (`position: relative; z-index: 0`) and giving the bands/tint
  `z-index: -1` within it — that guarantees every other child paints above them
  regardless of whether it happens to set its own `position`/`z-index`, with no
  per-element bookkeeping needed elsewhere on the page.
- **Existing glass cards benefit for free**: the Gate panel and the Itinerary
  event-card already use `.lg-glass` (semi-transparent + `backdrop-filter: blur`)
  from input_15 — so the floral background now shows through them softly
  blurred, which reads as the "glassmorphism cards over the floral/blush
  background" motif input_15 originally asked for, not just a fix.
- **Admin page**: applied the identical `.lg-post-hero` treatment (reusing the
  same CSS, no duplication) to `.lg-admin-wrap` — the whole dashboard grid —
  rather than one card, since the dashboard doesn't have a single obvious
  "post-Hero" span the way the guest page does. Removed the one corner-clip that
  was on the merged profile card.
- **Verified locally**: Hero corners present and unchanged; zero
  `lg-corner--subtle`/old corner-clip markup remains anywhere; the new
  `.lg-post-hero` wrapper, both bands, and the tint render on both the guest page
  and the admin dashboard; the `closed`-mode passcode → Accept → QR flow still
  works correctly inside the new wrapper; Botanical Bloom and Lavender Romance
  (guest pages and dashboards) are unaffected. All test data deleted afterward.
- No database schema changes in this input — nothing to migrate.
