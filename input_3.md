# Input 3 — Guest Flow Redesign: One Link, On-Page Gatepass, Lifecycle Management

## Why this change

Two things pushed this redesign. First, a per-guest unique invite URL (`/invite/:passcode`)
is awkward to distribute in practice — the admin has to copy and send a different full
link to every guest individually, when it's much easier to share one link everywhere
(WhatsApp status, a group, etc.) and give each guest their own short code separately.
Second, emailing the gatepass QR hit a real infrastructure wall: Render's outbound
network can't reach Gmail's SMTP servers over IPv6, causing `ENETUNREACH` errors. Rather
than keep fighting that, we're removing the guest-critical path's dependency on email
entirely — the QR is shown directly on the page instead of mailed out. This is also just
more robust for guests: no wrong-address typos, no spam folders, nothing to "not receive."

This input builds on the "multiple weddings per admin" and "admin is the complex part"
decisions in ARCHITECTURE.md — those don't change. What changes is entirely the
guest-facing flow and event lifecycle.

## Change 1 — One shared link per event, not per guest

Currently: `GET /invite/:passcode` — the passcode lives in the URL, so every guest
effectively has a different URL.

New: `GET /invite/:eventId` — one URL per wedding, identical for every guest of that
wedding. The page shows a passcode-entry form. Guest types their passcode, submits
(`POST /invite/:eventId` or a separate verify endpoint — Claude Code's call), and the
server looks up the guest by `(event_id, passcode)` rather than by passcode alone.

Admin dashboard changes:
- Add one prominent **"Shareable Invite Link"** display near the top of the event
  dashboard (`BASE_URL/invite/:eventId`) with a **Copy** button. This is the one link
  the admin shares everywhere.
- In the guest list table, replace any per-guest link/URL with a **"Copy Code"** button
  that copies just that guest's passcode. The passcode column itself can stay visible too.

## Change 2 — Remove the email-capture-before-reveal step

Drop the "enter your email" form entirely. After a correct passcode, go straight to the
animated card reveal. The `guests.email` column can stay in the schema unused for now
(don't bother migrating it away) — just stop requiring or asking for it in the flow.

## Change 3 — Gatepass QR shown on-page, not emailed

On Accept: generate the gatepass exactly as before (QR token written to `gatepasses`),
but instead of emailing it, **render the QR code directly in the response** — the guest
sees it immediately on the same page they just accepted from.

This removes the guest-critical path's dependency on SMTP entirely. The Gmail/IPv6
`ENETUNREACH` issue does **not** need to be fixed for this to work — leave the mailer
code in place (dormant, for a possible future "also email me a copy" option) but it must
never block or gate the guest from seeing their QR.

## Change 4 — Repeat visits: state-based routing

Because the link is now shared and generic (doesn't encode which guest it is), every
visit re-enters through the same passcode form. Once the passcode resolves to a guest,
route based on their current state:

| Guest state | What they see |
|---|---|
| `pending` | The invitation card + Accept/Decline buttons (as before, minus email step) |
| `accepted`, not yet checked in | Their QR code, directly |
| `accepted`, checked in, less than 6 hours since `checked_in_at` | Still their QR code (in case they need to show it again) |
| `accepted`, checked in, 6+ hours since `checked_in_at` | "This invite is no longer active" — QR no longer shown |
| `declined` | A friendly "you've already responded — you declined" message |

The 6-hour cutoff exists because once someone is checked in and has been at the venue
for hours, their gatepass no longer serves a purpose — this closes that window rather
than leaving it open indefinitely.

## Change 5 — Deleting a wedding, with metrics preserved

Two ways an event gets deleted, both doing the same underlying operation:

- **Manual**: a "Delete Wedding" button on the event dashboard, behind a confirmation
  dialog (this is irreversible).
- **Automatic safety net**: a daily check (in-app on a timer, or a Render Cron Job —
  Claude Code's call on mechanism) that finds any event whose `wedding_date` is more
  than 30 days in the past and deletes it the same way, with no admin action needed.

Before any deletion, archive anonymous summary metrics into a new table,
`event_archive` (this table is never purged by anything):

- `couple_names`, `wedding_date`, `venue`
- `total_guests`, `total_seats`
- `accepted_count`, `declined_count`, `pending_count`
- `seats_accepted`
- `checked_in_count`
- `response_rate` = (accepted + declined) / total_guests
- `attendance_rate` = checked_in_count / accepted_count
- `event_created_at`, `archived_at`

**Order of operations matters**: write the archive row first, confirm it succeeded, and
only then cascade-delete `gatepasses` → `guests` → `events`. If the archive write fails,
abort — do not delete anything. No guest data disappears without the metrics surviving
it first.

## Also: update ARCHITECTURE.md

Once this is built, update ARCHITECTURE.md's route table, schema section (add
`event_archive`, note `guests.email` is now optional/unused), and flow description so
the document matches reality again.

## Suggested verification before calling this done

- One event, two guests with different passcodes, same shared link — confirm each
  passcode shows that guest's own correct data, no cross-contamination.
- Walk all five states in the routing table above — easiest to fake `checked_in_at` in
  the DB directly to test the 6-hour cutoff rather than waiting 6 real hours.
- Accept a guest, confirm the QR renders on-page with no email ever attempted (check
  logs — no SMTP call should even fire).
- Create a throwaway test event, delete it manually, confirm: `event_archive` has the
  right numbers, and `events`/`guests`/`gatepasses` have zero rows left for it.
- Confirm ARCHITECTURE.md reflects all of this.

## Issues found

Nothing broke — the local verification pass below covered every state and
edge case cleanly. Judgment calls made along the way:

- **Verify vs RSVP as separate POSTs.** Used `POST /invite/:eventId/verify`
  (passcode only) and `POST /invite/:eventId/rsvp` (passcode + response) as
  two distinct endpoints rather than overloading a single `POST
  /invite/:eventId`, so each request's intent is unambiguous from the route
  alone.
- **No guest session at all.** Since the link is now shared and generic,
  every action (initial verify, and the RSVP submit itself) re-proves
  identity by resubmitting the passcode as a hidden form field, rather than
  storing it in a cookie/session after first entry. This matches the spec's
  "every visit re-enters through the same passcode form" — a guest who
  bookmarks or reopens the link always re-types their passcode, by design.
- **Passcode-entry page shows the couple's names before the passcode is
  entered.** The link is shared broadly now (WhatsApp status, groups), so a
  guest juggling multiple wedding links needs a way to confirm they're on
  the right one before typing a code. Doesn't reveal the card, date, venue,
  or wording — just enough to disambiguate.
- **Shareable link uses the request's own host, not `BASE_URL` from env.**
  `req.protocol + '://' + req.get('host')` instead of `process.env.BASE_URL`,
  so the displayed link can't go stale if that env var is ever left
  unset or out of sync with the real deployed URL.
- **Self-healing gatepass lookup.** If an `accepted` guest is ever found
  without a `gatepasses` row (shouldn't happen given the current flow, but
  costs nothing to guard), `renderGuestState` creates one on the fly rather
  than erroring.
- **Auto-sweep runs in-process** (`setInterval`, once at boot + every 24h)
  rather than as a separate Render Cron Job, to keep this a one-service
  deployment. Caveat: Render's free tier can spin the whole app down when
  idle, which could delay a sweep by a few days if nothing else wakes it in
  that window — accepted as fine since nothing depends on same-day deletion
  exactly 30 days out.
- **Archive-then-delete runs in one DB transaction** (`SELECT ... FOR
  UPDATE` on the event row, insert into `event_archive`, then `DELETE FROM
  events` — cascades to `guests`/`gatepasses` via existing FKs), via a
  dedicated `pool.connect()` client rather than the shared `pool.query`
  helper, so a failed archive insert can't leave a partial delete behind.

**Local verification (all passed):**
- Two guests, same event, same shared `/invite/:eventId` link, different
  passcodes — each resolved to their own correct name/seats/state, no
  cross-contamination.
- All five states walked: `pending` (card + buttons), `accepted` not
  checked in (QR), `accepted` checked in <6h (still QR — tested at exactly
  5h59m by editing `checked_in_at` directly), `accepted` checked in 6h+
  ("no longer active" — tested at exactly 6h01m), `declined` (message, no
  buttons). Also confirmed `not_found` (bad event id → 404) and `not_live`
  (Draft event → blocked) still work.
- Accepted a guest and confirmed the QR rendered inline in the same
  response with zero mailer/SMTP log lines — the email path isn't just
  failing silently, it's never invoked at all.
- Created a throwaway event (3 guests: 2 accepted incl. 1 checked-in, 1
  declined), deleted it manually, and confirmed `event_archive` recorded
  exact numbers (total_guests 3, total_seats 6, accepted 2, declined 1,
  pending 0, seats_accepted 5, checked_in 1, response_rate 1.0,
  attendance_rate 0.5) while `events`/`guests`/`gatepasses` had zero rows
  left for that event id.
- `ARCHITECTURE.md` updated: guest flow description, schema (added
  `event_archive`, marked `guests.email` unused), route map, folder
  structure, and status section all reflect the new design.
