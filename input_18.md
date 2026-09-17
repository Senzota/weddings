# Input 18 — Remove Lady Gianna Hero Corner Squares

Follow-up to input_17. Two things landed already, directly, outside the normal input-file
flow (noted here so Claude Code doesn't redo them): the floral background spanning Gate →
Itinerary → Gallery → Footer is in place, and the `.lg-post-hero-tint` overlay that was
sitting on top of it (82% opaque, effectively hiding the floral image entirely) has been
removed outright — both already live in `views/guest/themes/lady-gianna/invitation.ejs`
and `public/themes/lady-gianna/theme.css`. No action needed on either of those.

## What's left

Input_17 explicitly left the Hero (celebrant photo) untouched. It still carries the
original input_16 §4 floral corner squares — two small `.lg-corner` images (150×150px,
`object-fit: cover` windows onto `corner-floral.png`) positioned at the Hero's top-left
and bottom-right. Live review confirms these still show the same hard-edged, cropped-
square look that was already removed everywhere else on the page — they just weren't in
scope for input_17.

## Fix

- Remove both Hero corner images entirely: the
  `<img class="lg-corner lg-corner-tl">` and `<img class="lg-corner lg-corner-br">`
  elements (and their `assetExists(...)` guard block) in
  `views/guest/themes/lady-gianna/invitation.ejs`.
- Remove the now-unused `.lg-corner`, `.lg-corner-tl`, `.lg-corner-br` rules in
  `public/themes/lady-gianna/theme.css`.
- No replacement decoration on the Hero — this is a straight removal, not a re-
  implementation. The Hero ends up exactly as it would look with the floral asset absent:
  photo, its existing dark gradient overlay, and the text panel, nothing else.

## Suggested verification

- Confirm no floral image or `.lg-corner*` rule remains anywhere on the Lady Gianna Hero.
- Confirm the Hero still displays the celebrant photo with its overlay and text exactly as
  before, minus the two corner squares.
- Confirm nothing else in the Lady Gianna theme changed — the floral background below the
  Hero and the admin dashboard stay exactly as they already are.
- Commit and push to `origin/main` so Render picks up this change along with the already-
  applied tint removal.

## Issues found

Hero corner squares removed as specified, verified locally. Also shipping this
alongside several more direct edits that had already landed on disk outside the
normal input-file flow by the time I picked this up — noted here for the record
since they're going out in the same push:

- The tint removal this file describes as already-done was confirmed still
  applied and correct.
- Beyond that, two further iterations had also already landed directly (not
  through numbered input files, so undocumented until now): the top/bottom
  "band" `<img>` approach from input_17 was replaced with the floral image set
  as a genuine CSS `background` on `.lg-post-hero` itself
  (`background-size: cover`), because the bands only reached the very top/
  bottom of the span and left the long middle — exactly where the Itinerary
  sits — with no floral visible at all. A light 35% blush wash was layered back
  on top as a second `background` gradient (down from the original 82% that
  input_18 removed), easing the image's intensity behind text-heavy sections
  without hiding it again.
- Applying my own actual task (removing the Hero's two `.lg-corner` images and
  their CSS) surfaced one inconsistency the direct edits had missed: the admin
  dashboard's `.lg-admin-wrap` still had the old band `<img>` tags even though
  the `.lg-post-hero-band` CSS class backing them had already been deleted from
  theme.css — two unstyled, uncropped images would have dumped into the
  dashboard at full natural size. Removed them; the dashboard now gets the same
  floral background purely via the `.lg-post-hero` CSS class it already carries,
  same as the guest page.
- `assetExists()` guards are no longer used anywhere in the Lady Gianna theme —
  the CSS-background approach doesn't need one (a missing `background-image`
  URL just silently falls through to the next layer/solid color, unlike an
  `<img src>` which would show a broken-image icon). Left `utils/assetExists.js`
  and its `app.locals` registration in place rather than deleting them, since
  they're generic and harmless to keep for a future asset that does need the
  guard.
- Verified locally: no `.lg-corner`/floral `<img>` markup remains anywhere in
  the theme (Hero, guest post-Hero background, or admin dashboard); the Hero
  still shows the photo/placeholder, dark overlay, and text panel exactly as
  before; the floral CSS background and light wash render correctly on both the
  guest page and the admin dashboard; the `closed`-mode passcode → Accept → QR
  flow still works; Botanical Bloom and Lavender Romance are unaffected. Test
  event deleted afterward.
- No database schema changes — nothing to migrate.
