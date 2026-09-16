# Input 10 — Per-Event Admin Page: Layout Redesign

Input 9 got the theme colors/fonts applied correctly to the per-event admin page, but
the layout itself is still one long full-width column, stacked top to bottom — that's
what this input fixes. This is layout/structure only; the theme-token colors and fonts
from input_9 don't change.

## 1. Top section: photo + quick-action tiles, side by side

Two columns at the top of the page:

- **Left:** the wedding's selected/hero photo, shown as a proper panel (not a tiny
  thumbnail here).
- **Right:** the quick-action items, as compact tiles next to the photo rather than
  stacked full-width sections below one another: Shareable Invite Link (with Copy),
  Door Scanner (link/open), Status (Live/Draft toggle), and Live Stats (guest counts).

## 2. No full-width single-column sections anywhere on this page

Every section below the top row should also avoid the "one long column" pattern —
see the grid and two-column treatments below.

## 3. Wedding Details as a responsive tile grid

The Wedding Details fields (couple names, date, venue, theme, accept/decline text,
decline message, invitation message, itinerary, etc.) render as a grid of square tiles
that reflow based on available width — up to about six columns on a wide desktop
screen, narrowing down as the viewport shrinks, and down to one or two columns at phone
width. Each field/detail sits in its own tile rather than one stacked below the next
in a single column.

## 4. Shrink the "Current card" image preview

Right now, once a card image is uploaded, a large preview ("Current card:") sits inline
in the middle of the Wedding Details form, taking up significant vertical space above
the "Card image" upload input. This should become a small square thumbnail — one tile
among the others in the grid from section 3 — that can be clicked to view the full image
or replace it, rather than a large standalone image interrupting the form's flow.

## 5. Guest management: two columns

The guest management area (Add Guest form + the Guest List table) splits into two
columns:

- **Left:** Add Guest form and the Guest List table.
- **Right:** contact details and short instructions explaining how to use this section
  — worth including now since this area will eventually be used directly by clients,
  not just by the admin.

## 6. Consistent spacing between sections

Add clear, consistent spacing/breathing room between all blocks and sections on the
page — no elements sitting flush against each other.

## 7. Uniform corner rounding

Pick one corner-radius value and use it consistently across every square/tile, card,
and button on this page — not a mix of different rounding amounts across elements.

## Out of scope for this input

- The `card_image` ephemeral-storage bug (Render's disk wiping uploaded images) is
  still on hold, same as the Cloudinary/gallery work — not part of this pass.
- No changes to the guest-facing pages or their theme colors/fonts (input_7/8/9 stand
  as-is).

## Suggested verification

- Open a wedding's admin page and confirm the top row shows the photo and the four
  quick-action tiles side by side, not stacked.
- Resize the browser window and confirm the Wedding Details grid reflows smoothly from
  many columns down to one or two, never overflowing or leaving huge empty gaps.
- Confirm the "Current card" preview is now a small clickable square, not a large inline
  image.
- Confirm the guest management area shows the Add Guest form/Guest List on the left and
  contact details/instructions on the right.
- Confirm consistent spacing and a single, uniform corner-radius value across all tiles,
  cards, and buttons on the page.

## Issues found

**Same visual-verification limitation as inputs 7/8/9 — please look at this
in a browser.** Everything below was confirmed structurally (curl + HTML
inspection: all expected grid/tile classes present, correct counts, form
still round-trips every field correctly through the new markup) but this
is a pure layout/CSS pass and I still have no way to render and see it.

**"Square tiles" interpreted as uniform tile *cards*, not a forced 1:1
aspect ratio.** A literal square would either clip or force scrollbars
inside the decline-message/invitation-message/itinerary/contact-details
textareas, which need more room than a short text field. Those four use
the same tile styling (background/border/radius/padding) but span two
grid columns (`.bb-tile-wide`) instead of being forced square — every
other field (couple names, date, venue, theme, theme color, accept/
decline button text) is a normal single-column tile. Flag if literal
squares (with scrolling text inside) were actually wanted.

**Column count control:** used `grid-template-columns: repeat(auto-fit,
minmax(170px, 1fr))` rather than hardcoded breakpoints for exact column
counts — this naturally lands around six columns on a ~1200px desktop
container (the page's max-width) and reflows down smoothly as the
viewport narrows, per "reflow based on available width," without needing
separate rules for every screen size.

**Card image thumbnail:** now a square (`aspect-ratio: 1/1`) clickable
tile — clicking it opens the full image in a new tab (`target="_blank"`).
The file input to replace it sits in the same tile, just below the
thumbnail, rather than as a separate element.

**Uniform corner radius:** added one `--bb-admin-radius` (10px) variable
and applied it to every tile/card, button, and form input/select/textarea
on this page — including overriding `.bb-btn`'s pill shape specifically
within `.bb-admin` scope (`.bb-admin .bb-btn`), since the guest-facing
pages' pill buttons were explicitly out of scope and unchanged.

**Guest management "instructions" copy is invented placeholder text** (a
few sentences on how to bulk-add guests, share the link, and copy
individual codes) — reasonable given the input asked for "short
instructions" without specifying exact wording, but worth a look since
it'll eventually be client-facing.

**Confirmed unchanged, as instructed:** the `card_image`
ephemeral-storage issue and Cloudinary/gallery work are untouched;
diffed the guest-facing `invitation.ejs`/theme tokens before and after
this pass and neither was touched — this input only edited
`admin/dashboard.ejs` and the `.bb-admin*` rules in theme.css.
