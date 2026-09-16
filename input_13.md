# Input 13 — Theme Containers, Sticky Admin Header, Cameo Fix, Session Bug, and Event Editability

Follow-up to input_12, based on live review of the deployed Lavender Romance theme. Covers
a correction to how theming works on the admin page, one real bug found in guest
navigation, one validation fix, and one missing feature (editing an already-created
wedding) that turned out not to exist at all.

## Part A — Theme architecture: themes own their admin containers too, not just colors

Input_7 already established that each theme is self-contained — its own templates/
partials and its own CSS, not a shared skeleton reskinned with different values. That
principle was followed correctly for the guest-facing pages, but input_9/10 broke from
it for the admin page: every theme was made to share input_10's one square-tile grid
layout, only swapping colors/fonts. That's why Lavender Romance's admin page doesn't
actually look like its reference (`luxury-wedding-dashboard.html`) — it's Botanical
Bloom's grid wearing different colors, not its own layout.

Fix, going forward:

1. **Lavender Romance's admin page gets rebuilt with its own containers**, matching
   `luxury-wedding-dashboard.html` structure directly rather than input_10's grid: the
   profile card (circular photo + monogram badge + couple names + action buttons), the
   full-bleed hero-image panel, the circular "stat bubble" row (invited guests, RSVPs,
   days to go, saved vendors — adapt the specific stats to whatever this app actually
   tracks), the itinerary card, the gallery/assets card, and the guest-list table —
   arranged in the asymmetric grid the reference uses (profile + hero-image side by
   side, stats full-width, itinerary + assets side by side, guests full-width below).
2. **Botanical Bloom's admin page stays exactly as it is** (input_10's square-tile grid)
   — it was never built against a specific reference mockup, so there's nothing to
   reconcile it against; no change needed there.
3. **Sticky header, both admin views.** Apply `position: sticky; top: 0` to the header
   on the top-level "Your Weddings" list and on the per-event admin page, matching the
   reference mockup's `.nav-wrap` treatment.
4. **Standing rule for every theme added after this one:** a new theme ships with its
   own admin-page container structure and its own guest-page container structure from
   the start, each matching its own reference design — never retrofitted into an
   existing theme's layout just by swapping tokens. Claude Code builds it directly from
   the reference; no special screenshot deliverable is required for sign-off — the admin
   will inspect the live result personally, same as with Lavender Romance.

## Part B — Cameo title should not be required

On the Assets screen's Cameo upload (input_12 Part D), the `title` field is currently
enforced as required. Make it optional — an admin should be able to post a Cameo photo
with no caption at all.

## Part C — Bug: guest is asked for the passcode again after visiting Gallery/Cameos/Other Details

Confirmed on the live site: a guest who has already entered a correct passcode is asked
for it again after navigating to Gallery, Cameos, or Other Details and returning to the
main invitation (or possibly on any of these sub-pages directly). This contradicts two
things already agreed: input_9's gating model, where a guest is verified once per
session, not on every page load; and the "live view" principle from input_11/12, which
assumes an already-accepted, already-verified guest doesn't need to re-prove anything to
keep seeing their content.

Likely cause: the verified state is probably being tracked only in front-end/in-memory
state (e.g. a JS flag scoped to the single-page scroll) rather than a durable per-guest
session on the server (cookie/session token), so it's lost the moment the guest
navigates to a different route.

Fix required: once a guest's passcode is verified, that verified state must persist via
a durable session (server-side session or signed cookie tied to that guest) across the
Invitation page, Gallery, Cameos, and Other Details — no re-entry of the passcode should
ever be required while that session remains valid, regardless of which of these pages
the guest is on or navigates between.

## Part D — Weddings must be editable after creation (this doesn't exist at all right now)

There is currently **no edit entry point anywhere** for a wedding that's already been
created — not a partial gap in what's editable, an admin simply cannot get to an edit
form for an existing event at all. This is more than the theme-editability promise made
in input_9 section 3 ("the theme should remain editable afterward from the event's
settings/edit page") — that page doesn't exist yet either.

1. Add an **"Edit" button** on each wedding listed on the top-level **"Your Weddings"**
   page.
2. It opens a full edit form for that event covering every field that exists on it:
   couple names, wedding date, venue, **theme** (per input_9 section 3), accept/decline
   button text, decline message, the admin-authored invitation message (input_8 section
   4), itinerary, card image, and any other per-event field already in the schema.
3. Changes made on this form must actually persist to the database, not just populate
   the form fields for display.

## Suggested verification

- Confirm Botanical Bloom's admin page is pixel-for-pixel unchanged from input_10.
- Open a Lavender Romance event's admin page and confirm it now follows
  `luxury-wedding-dashboard.html`'s container layout (profile card, hero-image panel,
  circular stat bubbles, itinerary/assets cards, guest table) instead of the square-tile
  grid.
- Scroll both the "Your Weddings" list and a per-event admin page; confirm the header
  stays fixed at the top (sticky) in both.
- Upload a Cameo photo with the title field left blank; confirm it saves successfully.
- As a guest: verify the passcode once, then visit Gallery, then Cameos, then Other
  Details, then return to the main invitation — confirm the passcode is never asked for
  again at any point in that sequence.
- On "Your Weddings", confirm every listed wedding has a visible Edit button; open one,
  change several fields including the theme, save, reload, and confirm every change
  persisted.

## Issues found

**Real bug caught by local testing, fixed before this ever reached
production:** `models/guest.model.js` gained a `findByEventAndId`
function for the new session-lookup path but I forgot to add it to the
file's `module.exports` — every session-authenticated guest request
(revisiting the invitation, Gallery, Cameos, or submitting an RSVP via
session alone) threw `TypeError: guestModel.findByEventAndId is not a
function` and 500'd. `asyncHandler` caught it cleanly (logged, no crash,
same as every other input this session) but it would have completely
broken the very feature this input exists to fix. Caught during the
first local session-persistence test, fixed immediately, re-verified the
full sequence (verify once → revisit invitation → Gallery → Cameos → back
to invitation, zero passcode prompts at any point) end to end afterward.

**Part A — admin templates are now genuinely per-theme, not shared
markup with swapped CSS.** Moved the existing dashboard to `views/admin/
themes/botanical-bloom/dashboard.ejs` unchanged (bit-for-bit the same
file input_10 produced) and built `views/admin/themes/lavender-romance/
dashboard.ejs` from scratch against `luxury-wedding-dashboard.html`'s
actual container structure (profile card with circular photo + monogram,
full-bleed hero-image panel, circular stat bubbles, itinerary card,
gallery/assets preview card linking to Assets, guest table) — using new
`lr-*` classes specific to this theme's dashboard, not the shared
`bb-details-grid`/`bb-admin-top` system Botanical Bloom still uses. The
shared piece is only the header (`bb-admin-header`/`bb-admin-nav`), which
both themes' dashboards still use identically per Part B.

**Adapted the mockup's stats to what this app tracks**, as the input
explicitly invited: "invited guests / RSVPs received / days to go / saved
vendors" became Invited guests, RSVPs received (with a computed response
%), Days to go (computed from `wedding_date`), and Checked in (with
seats-accepted as the subtext) — "saved vendors" has no equivalent
concept here at all, so it was dropped rather than faked.

**Editing moved to its own page, not just added inline** — the input's
Part D asks for an Edit entry point that "doesn't exist at all," and
Lavender Romance's new dashboard (matching a mockup with no form fields
anywhere on it) had nowhere to put one. Extracted the existing Wedding
Details form (fields, grid layout, validation) out to a new shared
`GET/POST /admin/events/:id/edit` — reachable from the top-level list's
new Edit link, and from Lavender Romance's profile-card "Edit details →"
link. Botanical Bloom's dashboard keeps its own inline copy of the same
form too (per "stays exactly as it is" — nothing removed from it), so
for that theme there are now two ways to reach the same fields; harmless
redundancy rather than an inconsistent editing story between themes.

**Guest sessions now last 30 days, not the 8h the admin login uses** —
same `express-session`/`connect-pg-simple` store, but
`req.session.cookie.maxAge` is bumped once a guest verifies. An 8-hour
window would have just reproduced a milder version of the exact bug this
input reports (a guest closing their browser overnight and hitting the
passcode wall again) — not explicitly specified, but implied by "no
re-entry... while that session remains valid" for something guests may
revisit over weeks.

**Session is the primary identity mechanism now; passcode (POST body or
`?passcode=`) is the fallback/bootstrap.** `resolveSessionGuest` is
checked first on every gated route (invitation, verify, RSVP, Gallery,
Cameos); a passcode is only actually needed the first time, or if the
session cookie is ever missing (cleared cookies, a different browser).
`submitRsvp` no longer requires the hidden passcode field it's still
sent with for defense-in-depth — verified this by submitting an RSVP
with no `passcode` in the body at all, identified purely by session, and
confirming the database updated correctly.

**Cameo title now genuinely optional** end-to-end: `cameo_photos.title`
had its `NOT NULL` dropped, the admin upload form's `required` attribute
removed, the controller passes `title || null`, and both themes' guest-
facing Cameos pages (plus the admin Assets grid) only render a caption
element when a title actually exists — no empty caption bar shown for
untitled cameos.
