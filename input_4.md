# Input 4 — Post-Test Fixes: Card Persistence, Decline Reversal, Excel Export

Found by testing the live app directly (not a design pass — these are behavior/feature
gaps). All four items below happen **before** any styling work.

## 1. Keep the invitation card visible after Accept

Right now, once a guest accepts, the "accepted" view shows only the QR code — the
invitation card (couple names, date, venue, card image) disappears. Fix: the
accepted-guest view should show **both** — the invitation card and the QR code
together, not one replacing the other. The guest should still feel like they're looking
at "their invitation," with the gatepass QR as an addition to it, not a replacement.

## 2. A warmer decline message

When a guest declines, replace whatever generic acknowledgment currently shows with
something warmer. Add a new per-event customizable field, `decline_message` (same
pattern as `accept_button_text` / `decline_button_text` — admin can edit it per
wedding), defaulting to something like:

> "Thank you for letting us know. You are always welcome — if your plans change, we'd
> love to have you with us."

Show this on the page immediately after a guest declines, and again on any later visit
before they've changed their mind (see item 4).

## 3. Downloadable guest list (Excel) for the admin

The admin needs to hand the couple a list of names + codes so *they* can personally
send each guest their individual passcode (via WhatsApp, etc. — the app doesn't do
this distribution itself). Add a **"Download Guest List (Excel)"** button on the event
dashboard that exports an `.xlsx` file with columns: Name, Seats, Passcode, RSVP
Status, Checked In. Use a proper library for this (e.g. `exceljs`) rather than hand-
rolling XML — add it as a dependency. New route, e.g. `GET /admin/events/:id/export`,
streaming the file as a download.

## 4. Decline is reversible — it "pauses," it doesn't end the invite

This changes the RSVP state machine. Currently decline is treated as final, same as
accept. New rule: **only Accept is final and locked. Decline can be undone by the guest
changing their mind later.**

State-transition rules for the RSVP write (replace whatever WHERE-clause logic exists
now):
- Accept is allowed when current `rsvp_status` is `pending` **or** `declined` → moves
  to `accepted` (final — no further changes possible after this, exactly as before).
- Decline is allowed only when current `rsvp_status` is `pending` → moves to `declined`.
- Once `accepted`, nothing can change it again (unchanged from existing one-time-RSVP
  behavior — this part stays exactly as is).

Guest-facing behavior on revisit when `rsvp_status = declined`: show a welcome-back
message —

> "We will be delighted if your schedule has now allowed you to participate."

— together with the invitation card and an Accept button (i.e., treat it like the
`pending` view, but with this extra banner above it, so they can still say yes if
circumstances changed). If they take no action, nothing changes. If they Accept, it
locks in as final per the rule above and they get their QR (per item 1, shown with the
card).

Update the repeat-visit state table from input_3.md accordingly:

| Guest state | What they see |
|---|---|
| `pending` | Invitation card + Accept/Decline |
| `declined` | Welcome-back banner + invitation card + Accept (no plain Decline button needed here — they're already declined; Accept is the only meaningful action) |
| `accepted`, not checked in | Invitation card **and** QR code together |
| `accepted`, checked in, <6h since `checked_in_at` | Same — card and QR together |
| `accepted`, checked in, 6h+ since `checked_in_at` | "This invite is no longer active" |

## Suggested verification

- Accept a guest, confirm the card AND the QR both show, not just one.
- Decline a guest, confirm the new warm message shows, and that `decline_message` is
  editable per event (defaults correctly for new events).
- Decline a guest, revisit with the same code, confirm the welcome-back banner + card +
  Accept show — then Accept, confirm it locks in properly (QR issued, and a further
  revisit now shows the accepted/QR view, not the decline flow again).
- Try to decline an already-accepted guest (should be impossible — accepted is final).
- Download the Excel file from a wedding with a few guests in different RSVP states,
  confirm all columns are correct and it opens cleanly.

## Issues found

Nothing unexpected — all four items built cleanly and every suggested
verification step passed locally on the first try:

- Accepted a guest, confirmed the invitation card (image, couple names,
  date, venue, seats) and the QR rendered together in one response, not
  one replacing the other.
- Declined a guest, confirmed the new `decline_message` shows immediately
  (default text verified on a freshly created event, matching the schema
  default exactly).
- Revisited the declined guest with the same passcode: `decline_message` +
  the static welcome-back banner + full card + only an Accept button (no
  Decline button rendered) — then accepted, confirmed it locked in
  (`rsvp_status` → `accepted`, gatepass created, QR shown), and a further
  revisit showed the accepted/QR view rather than falling back into the
  decline flow.
- Tried declining that now-accepted guest again: the write was silently
  rejected (`recordRsvp`'s `WHERE rsvp_status = ANY(...)` didn't match),
  status stayed `accepted`, page kept showing the QR — accept is correctly
  final.
- Downloaded the `.xlsx` export for an event with guests in `pending` /
  `accepted` / mixed seat counts, read it back programmatically (exceljs)
  to confirm columns and values: Name, Seats, Passcode, RSVP Status,
  Checked In all correct, file identified as a real "Microsoft Excel
  2007+" document.

One dependency note: `exceljs@4.4.0`'s `uuid` dependency (`^8.3.0`)
resolves to a version with a known moderate advisory. Rather than
downgrading exceljs (npm's suggested `audit fix --force` path), added a
package.json `overrides` entry pinning `uuid` to `^11.1.1` — confirmed
exceljs still works fine against it (sanity-checked directly, then via
the real export above). `npm audit` is back to 0 vulnerabilities.

`decline_message` required an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
in schema.sql alongside the `CREATE TABLE IF NOT EXISTS`, since the
`events` table already existed on both the local DB and production Neon
from earlier inputs — re-running `db:migrate` against an existing
database needed to actually add the column, not just be a no-op.
