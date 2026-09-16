# Input 9 — Real Passcode Gating, Per-Event Admin Theming, Theme Selector

Two unrelated pieces of work in this input: closing a real security gap found while
testing input_8's scroll page, and extending theming to the per-event admin page. No
changes to the Hero/photo/card layout from input_7 — that stays exactly as built,
including on mobile, which is already working well. Any desktop-layout polish for the
Hero is explicitly out of scope here.

## 1. Real passcode gating (security fix, not just a UX tweak)

Testing found that a guest can currently scroll past the Hero and see content further
down the page (QR, message, itinerary, etc.) without ever entering a valid passcode.
That means this content is already present in the page's HTML on first load — it's
being hidden visually (CSS/JS), not actually withheld.

Fix required:

- The passcode-entry overlay must have **no way to dismiss or bypass it** — no close
  button, no way to scroll past it or interact with anything behind it — until a
  correct passcode is submitted.
- More importantly: **the server must not send the gated content in the first place.**
  On the initial page load (before a passcode is verified), the response should contain
  only the Hero and the passcode overlay — nothing else. The QR, the message placeholder,
  the button row, the Itinerary section, and the couple's contact details should only be
  included in the response *after* the server has verified the submitted passcode for
  that guest. This is the same principle already used correctly for the QR/reveal logic
  in input_3 — it just needs to now cover the whole scroll page from input_8, not only
  the old separate reveal page.

- **Itinerary no longer gets a free pass.** Input_7 originally had Itinerary viewable
  without a passcode. That's reversed now: since Itinerary lives inside the same
  scrolling page as guest-specific content (per input_8), it sits behind the same gate as
  everything else. There's no more "some sections need a code, others don't" — the rule
  is simply: nothing past the Hero is visible or sent to the browser until the passcode
  is correct.

## 2. Per-event admin page — deep theming

This applies to the admin page for a single wedding (guest list, itinerary editor,
gallery button, message field, shareable links, etc.) — **not** the top-level "Your
Weddings" list, which stays as a generic dashboard.

Every element on this per-event admin page — buttons, cards, tables, forms — should use
that wedding's active theme (colors, fonts, motifs), reusing the same theme-token system
already built for the guest-facing pages. The goal is that this page feels like part of
that wedding's overall look, not a generic gray admin panel, since it will eventually be
shared with the client themselves.

## 3. Theme selector on event registration

Add a theme selector (dropdown) to the "register new wedding" form in the admin — for
now there's only one theme (Botanical Bloom) to choose from, but the field should be
built to support more themes being added later without changing the form again. The
selected theme should also remain editable afterward from that event's settings/edit
page — not locked in permanently at creation.

## Suggested verification

- Open a guest invite link in a fresh/incognito session, confirm nothing beyond the
  Hero and the passcode overlay is visible or present in the page source before a code
  is entered — check via view-source or dev tools, not just visually.
- Confirm the passcode overlay cannot be closed or bypassed by any means (clicking
  outside it, scrolling, back button, etc.) before a correct code is entered.
- Confirm Itinerary is no longer reachable without a valid passcode.
- Open a wedding's admin page and confirm every visible element — buttons, tables,
  cards — reflects that wedding's theme colors/fonts, not a generic style.
- Register a new wedding, confirm the theme selector appears and the choice is saved;
  confirm it can be changed afterward from the event's settings.
- Confirm the Hero/photo/card visuals from input_7 are unchanged.

## Issues found

**The security fix is real, not cosmetic — verified by inspecting the
actual server response, not the rendered/CSS-hidden page.** Before this
fix, `invitation.ejs` unconditionally rendered the tile row, Itinerary
section, and Contacts section regardless of whether a guest had verified
— exactly the leak reported (this content was always present in the HTML,
just visually reachable by scrolling past a dismissible overlay). Fixed
by moving the entire post-Hero block behind `<% if (guest) { %>` in the
template, and `guest` is only ever non-null in a response from
`POST /verify` or `POST /rsvp` after `guestModel.findByEventAndPasscode`
succeeds — a plain `GET /invite/:eventId` can never produce a `guest`
value, by construction, not by a check that could be forgotten. Confirmed
by grepping the raw response body for `bb-state-area`, `bb-message-frame`,
`bb-tile-row`, `id="itinerary"`, and `bb-contacts` on an unverified load:
zero matches, all five. `event.itinerary`/`event.contact_details`/
`event.invitation_message` text is never interpolated into that response
at all.

**Overlay can no longer be dismissed, by removing the mechanism
entirely** rather than disabling it: no close button in the markup, no
JS-driven open/close state at all now. The overlay's markup is only ever
present in a response when `!guest`, and `.bb-overlay` is unconditionally
`display: flex` whenever it's in the DOM — there's no toggle to defeat.
Also added `body.bb-locked { overflow: hidden }` for the unverified state
as explicit belt-and-suspenders, though since the Hero is a fixed 100vh
and nothing else is sent, there's nothing to scroll to regardless.

**Itinerary's access rule flipped from input_7, as instructed:** it was
deliberately made passcode-free in input_7 on the reasoning that it's not
guest-specific data. This input overrides that explicitly ("no more
'some sections need a code, others don't'"), so it's now behind the same
gate as everything else — confirmed via the same zero-match grep above.

**Gallery and Other Details pages themselves are NOT passcode-gated as
separate routes** — flagging this rather than silently leaving it.
`GET /invite/:eventId/gallery` and `.../other-details` only check the
event exists and is live (same as before), not that a valid guest
passcode was presented. They're currently empty placeholders with zero
event-specific or guest-specific data, so there's nothing sensitive to
leak today, and the *links* to them are correctly hidden pre-verification
(inside the same gated block). But since there's no session, these routes
have no way to know "this visitor already verified" independent of the
main page — worth deciding deliberately when input_6's real Gallery
(actual uploaded photos) gets built, since that page will have real
content worth protecting the same way.

**Admin per-event theming:** restyled `admin/dashboard.ejs` with the
same CSS custom properties and fonts as the guest-facing pages (new
`.bb-admin`/`.bb-admin-card` rules in theme.css, reusing `.bb-btn`
unchanged) — every button, table, form, and card on that page now pulls
from `event.theme`'s stylesheet. Left `admin/events-list.ejs` (the
top-level "Your Weddings" list) and `admin/event-form.ejs` (new-wedding
creation, before the event has guests/an identity of its own) generic,
per the input's explicit boundary — only `event-form.ejs` gained the
theme *selector* itself, without adopting the theme's visual styling.

**Theme selector:** `config/themes.js` is now the single list both the
create form and the per-event settings form read from — adding a second
theme later means adding one entry there, not touching either template.
Confirmed end-to-end: created a new wedding with the selector, its
`theme` column matched the selection; the same selector on the dashboard
edit form is pre-selected to the event's current theme and round-trips
through an update.

**Hero/photo/card confirmed byte-for-byte unchanged** from input_8 (diffed
the Hero markup/CSS before and after this pass) — this input only touched
the passcode-gating logic, the overlay's dismissibility, and the admin
page.
