# Input 1 — End-to-End Local Test (Guest → Admin → Scanner)

Goal: prove the full flow works together as one system, not just that each
piece works alone. Run this locally before touching Render. Log what happens
at each step — if something breaks or behaves oddly, note it under "Issues
found" at the bottom rather than silently working around it.

## Setup

1. Start the app locally (`npm run dev` or equivalent) and confirm it boots
   with no errors and connects to Postgres.
2. Run `npm run db:seed-admin` if not already done, and log in to
   `/admin/login` with those credentials.

## Part A — Create and configure a wedding

3. From `/admin/events`, use "Add Wedding" to create a test event: couple
   names, date, venue, a theme color, a placeholder card image upload, and
   custom Accept/Decline button wording (make the wording distinctive so it's
   obvious later which event a guest is looking at).
4. Leave the event as **Draft**. Confirm a guest trying to open an invite
   link for this event is blocked/shown a "not open yet" state — this is the
   Draft/Live gate and it must actually gate, not just cosmetically hide a
   toggle.
5. Toggle the event to **Live**.

## Part B — Add guests and go through the guest flow

6. From the event dashboard, bulk-add 2 test guests by pasting their names
   into the textarea. Confirm both appear in the guest list with a generated
   passcode each and `rsvp_status = pending`.
7. Copy guest #1's invite link + passcode. Open it in a private/incognito
   window (simulating the guest's device).
8. Enter the passcode. Confirm the invite shows this event's couple names,
   card image, and wording — not another event's, if a second event exists.
9. Enter a test email address. Confirm the animated card reveal fires and
   the card image displays correctly.
10. Click **Accept**. Confirm: the custom accept wording shows, the DB row
    updates to `rsvp_status = accepted` with `responded_at` set, and a
    gatepass email arrives with a QR code image.
11. Reload/reopen the same invite link. Confirm it does **not** show the
    RSVP form again — it should show a friendly "you already responded"
    state instead, per the one-time RSVP rule.
12. Repeat steps 7–9 with guest #2, but click **Decline** this time. Confirm
    the decline wording shows, `rsvp_status = declined` is saved, and — this
    is important — **no gatepass/QR email is sent** for a decline.

## Part C — Admin dashboard reflects reality

13. Back in `/admin/events/:id`, confirm the live stats show 1 accepted,
    1 declined, 0 pending, matching what actually happened above — without
    needing a manual page refresh if the dashboard is meant to be live.

## Part D — Scanner / door check-in

14. Open `/scan` (camera permission required) and point it at guest #1's QR
    code (from the email, or a screenshot of it). Confirm it decodes, calls
    `/scan/verify`, marks `checked_in = true` with `checked_in_at` set, and
    shows a clear success state.
15. Scan the **same** QR code again. Confirm it is rejected as a duplicate
    (`duplicate_attempts` increments) with a distinct "already checked in"
    message — not a generic error, and not a second successful check-in.

## Edge cases worth trying

- Wrong/mistyped passcode on the guest invite page — should show a clear
  error, not a crash or blank page.
- A second wedding event created alongside the first — confirm its guests,
  passcodes, and stats stay fully separate from the first event's.
- Watch the server logs the whole way through — confirm nothing fails
  silently; every error should actually appear in the logs.

## Issues found

Full run completed against a local Postgres 16 instance (portable, no admin
install) and a real SMTP send via an Ethereal test account. Two real bugs
were found and fixed during the run; everything else passed cleanly.

**1. Guest routes 404'd on every request (fixed).**
`server.js` mounts the guest router at `/invite` (`app.use('/invite',
guestRoutes)`), but `routes/guest.routes.js` also prefixed its own paths
with `/invite` (`router.get('/invite/:passcode', ...)`), so the real path
Express registered was `/invite/invite/:passcode`. Every guest-facing URL
returned the generic 404 handler instead of the invite page. Repro: `GET
/invite/<any passcode>` before the fix always returned 404 regardless of
whether the passcode existed. Fix: routes in guest.routes.js now start from
`/:passcode` since the `/invite` prefix is already applied at mount time.

**2. Wedding date displayed one day early (fixed).**
`node-postgres` parses a `DATE` column into a JS `Date` at *local* midnight,
not UTC midnight. The views called `event.wedding_date.toISOString().slice(0,
10)` to render/prefill the date, and `.toISOString()` converts to UTC —
so on a server whose local timezone has a positive UTC offset (this
machine: Africa/Nairobi, UTC+3), the date rolled back a day (created event
with `weddingDate=2026-12-12`; guest invite and admin dashboard both showed
`2026-12-11`). This is exactly the class of bug flagged in section 4 of the
brief — behavior that silently depends on where the process happens to run.
Fix: `config/db.js` now registers a custom type parser for OID 1082 (date)
that returns the raw `'YYYY-MM-DD'` string instead of a `Date` object, so
no timezone conversion ever happens; the three views that displayed
`wedding_date` were updated to print the string directly.

**Design observations (not bugs, worth a decision later):**
- Card image upload isn't part of the initial "Add Wedding" step — the
  create form (`event-form.ejs`) has no file input; the image is added
  afterward from the event dashboard (`POST /admin/events/:id`). This
  matches normal usage (create → land on dashboard → upload card) but is
  two steps, not one, if that matters for the admin UX.
- "Live stats" on the dashboard are accurate on page load but don't
  auto-update without a refresh (no polling/websockets). Confirm this
  matches what "watches RSVP stats live" in the brief was meant to imply,
  or whether a v1 push-update is wanted.

**Everything else passed as specified:**
- Draft/Live gate actually blocks guest access when draft (not just a
  cosmetic toggle) — verified with a real guest passcode, not just a
  nonexistent one.
- Bulk-add produced correct `seat_count` and unique passcodes per guest.
- Guest invite showed the correct event's couple names/card/wording, not
  another event's, once a second event existed.
- Email-capture-before-reveal worked; card reveal showed the correct image,
  date, venue, seat count, and this event's custom Accept/Decline wording.
- Accept: DB updated to `accepted` with `responded_at` set, gatepass row +
  QR token created, email sent (confirmed via Ethereal — correct recipient,
  subject, and a real `gatepass.png` attachment, 3.4KB).
- Reloading the same invite link after responding showed the "already
  responded" state, not the RSVP form — one-time RSVP is enforced at the DB
  layer (`UPDATE ... WHERE rsvp_status = 'pending'`), not just in the UI.
- Decline: DB updated to `declined`, and — confirmed explicitly — no
  gatepass row was created and no email was sent.
- Admin dashboard stats matched reality exactly: 1 accepted, 1 declined,
  2 seats accepted, 0 pending.
- Scanner: first scan checked the guest in (`checked_in=true`,
  `checked_in_at` set); second scan on the same token was rejected as a
  duplicate (`duplicate_attempts` incremented, distinct message, guest not
  re-admitted); a third scan kept incrementing rather than flipping back to
  checked-in; an unrecognized token returned a clear "not recognized"
  response (HTTP 404), not a crash.
- Wrong/mistyped passcode showed a clean "couldn't find an invitation"
  page, not a crash or blank page.
- Two concurrent wedding events stayed fully isolated: second event's
  guest saw its own couple names/wording, and neither event's guest list,
  passcodes, nor stats leaked into the other's.
- Server logs stayed clean throughout — no unhandled errors, no silent
  failures, at any step (including the two bugs above, both of which
  surfaced as an explicit 404/wrong-value rather than hanging or failing
  silently).
