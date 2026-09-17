# Input 14 — Access Mode: Open, Recognized, and Closed Invitations

Not every event needs passcode-gating and door check-in. Some invitations are meant to
be open — "whoever can make it" — and the link itself can be freely shared onward. This
adds a per-event choice of how strict the invite's access model is, alongside the
existing gated flow (unchanged as the default for backward compatibility).

This is independent of theme and independent of event type (input_12/13's wedding themes
and any birthday theme apply the same regardless of which access mode is chosen).

## 1. New field: `access_mode`

Add `access_mode` to `events`: `open` | `recognized` | `closed`. Default `closed` — every
event created before this ships keeps behaving exactly as it does today. Selectable on
the "register new wedding/event" form, and — per input_13 Part D — remains editable
afterward from that event's edit page, same as every other field.

## 2. Mode: `open` — fully public, static, no RSVP

- No passcode-entry overlay at all. `GET /invite/:eventId` serves the Hero, the
  admin-authored message, Itinerary, Gallery, and Cameos directly — no gate, no code
  lookup.
- No personalization — the message placeholder shows generic admin-authored content
  only (no "Dear [Name]"), since there's no guest identity involved.
- No RSVP mechanism of any kind — no Accept/Decline, no attendance counter, nothing.
  This is a static informational page. If someone wants to reach out, they use the
  existing Other Details contact info — no new contact mechanism needed here.
- No guest list is needed for an `open` event (there's nothing to generate codes for).
- No QR gatepass, no door scanner — the Door Scanner quick-action tile on the admin
  page (input_10) should not be shown/should be disabled for `open` events.
- The link is meant to be shared onward freely — this is intentional, not a gap to
  close.

## 3. Mode: `recognized` — code required, personalizes the guest, no check-in

- Same passcode-entry mechanism as today: `(event_id, passcode)` lookup gates the
  content.
- On a correct code, the guest sees **personalized** content (their name in the
  greeting, same as today's gated experience) plus Itinerary, Gallery, Cameos, Other
  Details.
- **RSVP (Accept/Decline) is present and tracked** — admin can see who accepted/declined
  in the guest list/live stats, same as today.
- **No QR gatepass is generated, and there is no door check-in step for this mode.**
  Accepting simply records the RSVP; there's nothing for a door scanner to check against
  for these guests. The Door Scanner tile should not be shown/should be disabled for
  `recognized` events, same as for `open`.
- Admin's guest-list management (add guest, generate passcodes) works as it does today;
  fields related to check-in (checked-in flag, duplicate-scan counter) simply don't apply
  and can stay blank/unused for these guests.

## 4. Mode: `closed` — unchanged, today's full flow

- Code → Accept/Decline → QR gatepass generated and shown on acceptance → door scanner
  check-in, exactly as built through input_3–13. This is the default for every existing
  event and for any new event where the admin doesn't pick something else.

## 5. Admin-side implications

- The "register new wedding" form and the event edit page (input_13 Part D) both need
  the `access_mode` selector.
- The per-event admin page's Door Scanner quick-action tile (input_10) is conditionally
  shown: visible/enabled only for `closed` events, hidden or disabled for `open` and
  `recognized`.
- Guest-list UI can stay the same component for `recognized` and `closed` (it's still
  name + passcode management either way); for `open` events, the guest-list section can
  be hidden entirely since there's nothing to manage there.

## Suggested verification

- Create an `open` event: confirm the guest sees the full invitation content immediately
  with no passcode prompt, no RSVP control, and no QR/scanner artifacts anywhere for it.
- Create a `recognized` event: confirm the passcode is required, the guest sees
  personalized content, Accept/Decline works and shows up in admin stats, but no QR is
  ever generated or displayed, and the Door Scanner tile is hidden/disabled for this
  event.
- Confirm an existing (pre-input_14) event, or any new event left at the default,
  behaves exactly as before (`closed`) — full code + RSVP + QR + door scanner.
- Confirm `access_mode` is selectable at creation and editable afterward from the event's
  edit page.

## Issues found

Implemented as specified. Notes and judgment calls:

- **Schema**: added `access_mode TEXT NOT NULL DEFAULT 'closed' CHECK (access_mode IN
  ('open','recognized','closed'))` to `events`, plus an idempotent
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration so every pre-existing event
  (local and Neon) picked up `'closed'` automatically with zero data changes needed.
- **Single source of truth**: added `config/accessModes.js` mirroring `config/themes.js`
  (input_13 precedent) — one array shared by the create form, the edit form, and their
  controllers, so the three modes and their labels are defined exactly once.
- **Controller design**: `guest.controller.js`'s `renderInvitation` gained an
  `access_mode === 'open'` short-circuit at the top (guest always `null`, `state: 'open'`,
  full content, no gate at all) and a `'recognized'` branch inside the existing
  `accepted` case that stops before any gatepass is created/looked up. `'closed'` is
  byte-for-byte the pre-existing code path — untouched. Every route handler
  (`showInvitation`, `verifyPasscode`, `submitRsvp`, `showGallery`, `showCameos`) got its
  own `access_mode === 'open'` early-return so an open event never even queries a guest
  by passcode/session for these routes.
- **Botanical Bloom's inline admin dashboard** (input_13 Part A: "stays exactly as it
  is") was *not* given its own Access mode selector — it's only settable via the
  dedicated `/admin/events/:id/edit` page for this theme, same restriction that already
  applies to other newer fields there. Both dashboards *did* get two purely
  read/conditional changes not gated by that rule: the Door Scanner tile only renders
  when `access_mode === 'closed'`, and the entire guest-list section (plus its nav
  anchor) is omitted when `access_mode === 'open'`.
- **Templates**: `invitation.ejs` for both themes now branches on `state` (`null` /
  `'open'` / `'card'` / `'confirmed'` / `'qr'` / `'expired'`) instead of just
  `guest` truthiness, since `'open'` events reach the "show content" branch with
  `guest === null`. Lavender Romance's combined QR+message glass card keeps its layout;
  it just adds a `'confirmed'` case and skips the whole card for `'open'`. Gallery/Cameos
  templates for both themes now key their passcode-form-vs-photos branch off
  `photos === null` (only ever true when a `recognized`/`closed` event's guest hasn't
  verified yet) rather than `!guest`, since `'open'` events always pass a real (possibly
  empty) `photos` array with `guest: null`.
- **Global Door Scanner link** (`/admin/events` list page, `views/admin/events-list.ejs`)
  was left as-is — it's a single event-agnostic utility link for door staff, not a
  per-event tile, so input_14's "hidden for open/recognized" instruction doesn't apply
  to it. Scanning a QR for a guest whose event never generates gatepasses (`open`/
  `recognized`) simply won't happen in practice since no such QR is ever shown to them.
- **Local verification** (Postgres, both themes, all three modes, via curl + direct DB
  queries): `open` — no overlay/passcode form/RSVP form/QR anywhere in the HTML, full
  content including Itinerary rendered immediately, no `bb-locked` body class. `recognized`
  — overlay blocks all content pre-verify (itinerary not present in the pre-verify
  response body, confirming security-by-omission holds), passcode verify + Accept both
  work, `rsvp_status` reaches `'accepted'` in the DB, **no row is ever inserted into
  `gatepasses`** for that guest, no QR image in the response, Door Scanner tile absent
  from that event's admin dashboard, guest-list section still present. `closed` —
  unchanged: verify + accept creates a `gatepasses` row and renders the QR, Door Scanner
  tile and guest-list both present on the dashboard. A brand-new event created without
  an `accessMode` field in the POST body correctly persisted `access_mode = 'closed'`
  (confirms the default holds for any caller that doesn't know about this field yet).
  All test events were deleted after verification.

No deviations from the spec were needed.
