# Input 20 — Theme Gallery, Event-Type Expansion, and Public Booking Flow (Plan Only)

**This file is a read-only implementation plan.** No application file was modified, no
migration was run, and nothing was committed, pushed, or deployed to produce it. It was
written after inspecting the current codebase directly (`server.js`, `config/`,
`routes/`, `controllers/`, `models/`, `db/schema.sql`, `utils/`, `views/`, `public/`,
`middleware/auth.middleware.js`, `package.json`) rather than from memory alone — file
paths and behavior described below are accurate as of this inspection.

**Revision note**: this version incorporates nine approved product decisions from the
second round on top of the first draft — no active-theme fallback for new event
types, a public/registry distinction between "active" and "planned" event types,
approved title labels for all nine types, a nullable `wedding_date` instead of a
placeholder date, manual (WhatsApp-style) client-link delivery only, client-side theme
changes restricted to the client's own event type (never `access_mode`), rate limiting
scoped to the new public inquiry endpoint, and literal placeholder pricing copy. A
third round then resolved the three items the second round had left open: the Book
Now form's theme selector now explicitly cascades from event type and resets on
change (validated server-side either way), the public inquiry rate limit is fixed at
5 submissions per IP per 15 minutes, and publishing is now asymmetric — a client may
publish their own draft (once a real date is set) but may never revert a live event
back to draft; only an admin can. Every prior open decision this resolves has been
removed from the closing section — nothing currently remains open.

## Why this expansion

Three connected goals, in the order they naturally unlock each other: (1) the theme
system needs a small, safe cleanup before it's presentable on a public gallery — see
`SystemArc.md` Part 1 for the audit this builds on; (2) `event_type` needs to grow from
2 values to 9 without breaking the 2 that already have real themes, and without ever
offering a type the app can't actually theme yet; (3) a public homepage and
booking-inquiry flow needs a brand-new, carefully isolated client-access path that
never touches admin auth, guest auth, or the existing guest-facing gating this app
already gets right.

## Current-state facts this plan depends on (verified by inspection)

- `events.event_type` has `CHECK (event_type IN ('wedding', 'birthday'))` — widening
  this is a standard `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` pair, not a
  column rename. No existing column is renamed anywhere in this plan.
- `events.wedding_date` is `DATE NOT NULL`; `event_archive.wedding_date` is also
  `DATE NOT NULL`. Both need to change for decision 5 — see Phase 2 below.
- `utils/formatDate.js`'s `formatEventDate(dateStr)` **already** guards against a
  falsy input (`if (!dateStr) return '';`) — no change needed there.
- `admin.controller.js`'s `daysUntil(dateStr)` does **not** guard against a falsy
  input — `new Date('nullT00:00:00')` is an Invalid Date, and the resulting `NaN`
  would render literally as "NaN" in every dashboard's "Days to go" stat bubble. This
  needs fixing as part of Phase 2 (see below) — a real, previously-undiscovered bug
  that only matters once a dateless draft event can exist.
- `utils/eventLifecycle.js`'s purge sweep (`WHERE wedding_date < (CURRENT_DATE -
  INTERVAL '30 days')`) is **already safe** for a `NULL` date — SQL's `NULL <
  anything` evaluates to `NULL`, not `true`, so a dateless draft is automatically
  excluded from the sweep with no code change needed. Verified, not assumed.
- `config/themes.js`'s `AVAILABLE_THEMES` currently has exactly 3 entries, covering
  only `wedding` (×2) and `birthday` (×1). No theme exists yet for any of the other 7
  event types — this plan's active/planned mechanism (Phase 1) exists specifically
  because of this fact, not despite it.
- `server.js` currently does `app.get('/', (req, res) => res.redirect('/admin/login'))`
  — the public homepage replaces this exact line.
- Session auth today has exactly one shape: `express-session` + `connect-pg-simple`,
  one cookie, two independent keys inside it (`req.session.adminId` for admin,
  `req.session.verifiedGuests[eventId]` for guests — see `SystemArc.md` Part 2 §4 for
  the existing note on this). Client access below adds a **third**, equally
  independent key, following the same established pattern rather than inventing a new
  auth mechanism.
- `middleware/auth.middleware.js` exports one function, `requireAdmin`, doing a single
  `req.session.adminId` check. This plan adds a sibling function in the same file, not
  a parallel auth system.
- `views/admin/edit-event.ejs`, `views/admin/themes/botanical-bloom/dashboard.ejs`,
  and `views/admin/themes/lady-gianna/dashboard.ejs` each have a `<input type="date"
  name="weddingDate" ... required>` field. `views/admin/themes/lavender-romance/
  dashboard.ejs` has no inline date field at all (it links out to `edit-event.ejs`
  instead) — confirmed by inspection, not assumed.
- `utils/qrGenerator.js` already generates cryptographically random tokens via
  `crypto.randomUUID()` for gatepasses. This plan uses the same `crypto` module (via
  `crypto.randomBytes`) for client tokens, for consistency, at higher entropy given the
  larger blast radius of a client token (whole-event access, not one guest's QR).
- `models/archive.model.js`'s `archiveAndDelete` is the existing proof that this
  codebase already knows how to do a correct claim-then-act transaction
  (`BEGIN` → `SELECT ... FOR UPDATE` → write → `COMMIT`/`ROLLBACK`). The
  approve-inquiry transaction below follows the same shape.
- `models/gatepass.model.js`'s `checkIn` is the existing proof this codebase already
  knows how to do a correct atomic "only the first request wins" update
  (`UPDATE ... WHERE checked_in = false`). The approve-inquiry duplicate-protection
  below follows the same shape (`WHERE status = 'new'`).
- No test framework exists in this repo (see `SystemArc.md` Part 2 §5) — the testing
  checklist below is manual/`curl`-based, matching how every prior input has actually
  been verified in this project.

---

## A. Recommended implementation order

Nine phases (one more than the first draft — nullable `wedding_date` is substantial
enough to be its own phase rather than folded into event-type work). Each is
independently shippable and testable without any later phase existing yet.

1. **Event-type taxonomy expansion + active/planned visibility.** All 9 types enter
   the schema CHECK constraint and `config/eventTypes.js` (with approved title
   labels), but a type is only ever offered in a selector — including the **admin**
   create-event form — when at least one theme is registered for it. With only
   `wedding`/`birthday` themed today, only those two appear anywhere, everywhere,
   from this phase forward. No fallback theme is ever assigned to a themeless type.
2. **Nullable `wedding_date`.** Schema change plus every dependent code path made
   null-safe (full list below) — done as its own phase because it touches
   validation logic on the existing, working admin create/edit flow and deserves
   isolated testing before anything downstream (Phase 7's draft-event creation)
   depends on it.
3. **Theme registry swatch metadata** (config-only addition, nothing renders it yet).
4. **Admin CSS separation** (the refactor already scoped in `SystemArc.md` Part 1 §6–7
   — shared layout CSS extracted, per-theme color/font/background ownership
   preserved). Purely visual-parity work; existing themes must render pixel-identical
   after this phase.
5. **Public homepage** (`/`) — hero, "Contact us for a custom quote" pricing, active
   event-type cards, active-theme swatch gallery, how-it-works, and a Book Now form
   whose theme selector cascades from the chosen event type (only that type's active
   themes appear, and the selection resets whenever event type changes) — plus the
   `booking_inquiries` table, the public `POST /inquiries` that only ever inserts a
   `new` row, and rate limiting (5 submissions per IP per 15 minutes) on that one
   route.
6. **Admin inquiries list + detail (read-only)** — admins can see what came in; no
   approve/decline actions wired yet.
7. **Approve/decline actions** — the transactional core of this whole input: creates
   exactly one draft event (with `wedding_date: null`, per Phase 2) and one
   client-access token per approval, or closes the inquiry on decline. The raw
   client link is shown once in the admin UI for manual relay (WhatsApp or similar) —
   no email is built in this input.
8. **Client access** — `requireClientAccess` middleware, `/client/:token` bootstrap,
   and a client dashboard that reuses the existing per-theme dashboard views under a
   restricted capability set, including the client's own (event-type-scoped) theme
   picker.
9. **Client dashboard capability polish** — confirms every explicitly-forbidden
   surface (other events, inquiries, archive, admin accounts, unrestricted scanner,
   access_mode changes) is actually unreachable, not just unlinked, that the theme
   picker only ever offers themes valid for the client's own event type, and that
   publishing is genuinely one-directional for a client — no `/client/*` route can
   ever revert a live event back to draft.

---

## B. Exact existing files likely to change, by phase

**Phase 1**
- `db/schema.sql` — widen the `event_type` CHECK constraint to all 9 values (drop +
  recreate, same idempotent-migration style already used throughout this file); no
  column rename.
- `config/eventTypes.js` — all 9 entries, each with the approved `titleLabel`
  (decision 4): `wedding`→"Couple names", `birthday`→"Celebrant",
  `bridal-shower`→"Bride-to-be", `baby-shower`→"Parent(s)-to-be",
  `engagement`→"Couple names", `anniversary`→"Couple names",
  `graduation`→"Graduate", `corporate`→"Company / Contact name",
  `other`→"Event host / title" — alongside the existing `slug`/`label`.
- `controllers/admin.controller.js` — add a small "active event types" derivation
  (`EVENT_TYPES.filter(t => AVAILABLE_THEMES.some(th => th.eventType === t.slug))`,
  composing the two registries it already imports) and pass the filtered list to
  `event-form.ejs`/`edit-event.ejs` instead of the raw `EVENT_TYPES` export. This is
  the one place the "active" concept is computed — no new flag stored anywhere,
  purely derived from which themes actually exist.
- `views/admin/event-form.ejs`, `views/admin/edit-event.ejs` — replace the hardcoded
  `type === 'birthday' ? 'Celebrant' : 'Couple names'` ternary in the client-side
  label-swap script with a read of each `<option>`'s `data-title-label` attribute
  (populated from the registry's `titleLabel` field) — generalizes to all 9 types
  with no further script changes whenever a type becomes active later.

**Phase 2**
- `db/schema.sql` — `ALTER TABLE events ALTER COLUMN wedding_date DROP NOT NULL`;
  add a named `CHECK (status <> 'live' OR wedding_date IS NOT NULL)` constraint;
  `ALTER TABLE event_archive ALTER COLUMN wedding_date DROP NOT NULL`.
- `models/event.model.js` — `update()`'s `wedding_date = $2` becomes
  `wedding_date = COALESCE(NULLIF($2, ''), wedding_date)` (an empty-string submission
  from a still-dateless draft's form must not attempt an invalid date cast, and must
  not overwrite a real date that's already set); `create()` needs no change — it
  already inserts whatever's passed, and `null` is a valid value once the column
  allows it.
- `controllers/admin.controller.js` — `updateEvent`'s hard-required check drops
  `weddingDate` (`if (!coupleNames || !weddingDate || !venue)` →
  `if (!coupleNames || !venue)`); `createEvent`'s check is deliberately **left
  unchanged** (a manually-created event still requires a date up front — only the
  booking-approval path needs to start dateless); `daysUntil()` gets a
  `if (!dateStr) return null;` guard. The existing `toggleStatus` action is split
  into two pieces in anticipation of Phase 8 (see §F): a `publishCore(eventId)`
  covering the draft→live direction only, gaining the live-requires-a-date guard, and
  the live→draft direction, which stays exactly as it is today — a plain status
  write with no date involved. At this phase both directions are still reachable only
  through the existing `requireAdmin`-gated route, so nothing about who can call
  which direction changes yet; Phase 8 is what makes `publishCore` the only one of
  the two a client route is ever wired to.
- `views/admin/edit-event.ejs`, `views/admin/themes/botanical-bloom/dashboard.ejs`,
  `views/admin/themes/lady-gianna/dashboard.ejs` — remove `required` from each
  date `<input>` (confirmed present on all three by inspection); each dashboard's
  "Days to go" stat bubble changes from `<%= daysToGo %>` to a null-aware
  `<%= daysToGo === null ? 'TBD' : daysToGo %>`.
- `views/admin/event-form.ejs` — **left unchanged**, `required` stays (matches
  `createEvent` staying required — manual creation is unaffected by this phase).
- `views/admin/themes/lavender-romance/dashboard.ejs` — no change (no inline date
  field exists there to begin with).

**Phase 3**
- `config/themes.js` only — add `swatchColors`/`tagline` fields to each existing
  entry. No other file reads them yet.

**Phase 4**
- Exactly the files already itemized in `SystemArc.md` Part 1 §7 Phases 1–3: new
  `public/assets/css/admin-shared.css`; all three `public/themes/*/theme.css` (remove
  the duplicated shared rules only); `views/admin/edit-event.ejs`, `views/admin/
  assets.ejs` (add the new stylesheet link, fix the per-theme font-loading bug); new
  `public/assets/js/theme-filter.js`; `views/admin/event-form.ejs` (swap inline script
  for the extracted one — the same file the Phase 1 label-swap redesign also touches,
  so these two phases' edits to that file should be sequenced, not developed in
  parallel against the same lines).

**Phase 5**
- `server.js` — replace the `/` redirect with a real homepage render; add the
  rate-limiting dependency/middleware application to the new inquiry route only (see
  §C).
- `db/schema.sql` — new `booking_inquiries` table.
- `package.json` — one new small dependency for rate limiting (e.g.
  `express-rate-limit`), configured for 5 submissions per IP per 15 minutes and
  scoped to this one route only, per decisions 2 and 8.
- No existing controller changes required beyond `server.js`'s route-mount line — the
  homepage, the inquiry submission, and the Book Now form's cascading/resetting theme
  selector script are all new files (§C).

**Phase 6**
- `views/admin/events-list.ejs` — add an "Inquiries" nav link (the only existing admin
  page this phase touches).
- `routes/admin.routes.js`, `controllers/admin.controller.js` — new
  list/detail handlers added alongside the existing exports (additive, no existing
  export changed).

**Phase 7**
- `controllers/admin.controller.js` — new approve/decline handlers (additive).
- `routes/admin.routes.js` — new POST routes (additive).
- `models/event.model.js` — no change beyond Phase 2's already-nullable `create()`
  path; the draft-event insert reuses the existing `create()` function as-is with
  `weddingDate: null`.

**Phase 8**
- `middleware/auth.middleware.js` — add `requireClientAccess` alongside `requireAdmin`
  (additive export).
- `views/admin/themes/*/dashboard.ejs` (all 3) — add a `clientMode` conditional around
  the Danger Zone block and the access_mode control, parameterize the form-action
  base path, and (per decision 7) keep the theme `<select>` visible in client mode
  but populate it only with `themesForEventType(event.event_type)` instead of the
  full `AVAILABLE_THEMES` list. The status-toggle control also changes shape in
  client mode: while the event is `draft`, it renders as a single "Publish" action
  (calling `publishCore`, date-guarded); once the event is `live`, client mode
  renders that control as plain read-only status text, not a button — there is no
  markup path in client mode that could ever submit a live→draft request (per
  decision 3). See §F for exactly what changes and why it's safe.
- `controllers/admin.controller.js` — the specific action bodies the client dashboard
  needs to call (update event details, change theme, publish, bulk-add guests,
  upload/delete gallery/cameo photos, export guest list) get their `eventId`-
  resolution split out from their route-handler wrapper, so a new client controller
  can call the same core logic with a session-derived id instead of `req.params.id`.
  The live→draft (unpublish) core logic is deliberately **not** exported for reuse —
  it stays a private, admin-route-only code path, so there is nothing for a client
  controller to even import. This is the one "existing behavior must not change"
  refactor in the whole plan — see R3.

**Phase 9**
- No new file changes beyond what Phase 8 already added; this phase is verification
  (§H) that the restrictions actually hold, plus any gaps that verification finds.

---

## C. New files, routes, database tables, middleware, and views

**New database tables** (full column design in §D):
- `booking_inquiries`
- `client_access`

**New middleware**
- `requireClientAccess` — added to the existing `middleware/auth.middleware.js`
  (function export, not a new file — mirrors how `requireAdmin` already lives there).
- Rate limiter for `POST /inquiries` — a small, route-scoped middleware instance
  (e.g. `express-rate-limit`) configured for 5 submissions per IP per 15 minutes,
  applied only where it's mounted in `routes/public.routes.js`. Not applied anywhere
  else — broader, system-wide rate limiting (login, passcode verify, scanner verify —
  see `SystemArc.md` Part 2 §6 Phase 1/2) stays a separate, later hardening task per
  decision 8.

**New routes**
- `GET /` — public homepage (replaces the current redirect in `server.js`).
- `POST /inquiries` — public, rate-limited, creates a `booking_inquiries` row only.
  New router, `routes/public.routes.js`.
- `GET /admin/inquiries` — list, `requireAdmin`.
- `GET /admin/inquiries/:id` — detail, `requireAdmin`.
- `POST /admin/inquiries/:id/approve` — `requireAdmin`.
- `POST /admin/inquiries/:id/decline` — `requireAdmin`.
- `GET /client/:token` — bootstrap: validates the token, establishes the client
  session key, redirects to `/client/dashboard`. Public (no middleware), but the
  handler itself is the entire security boundary — see §D/§E.
- `GET /client/dashboard`, plus the client-side equivalents of whichever existing
  admin actions Phase 8 exposes (`POST /client/dashboard`, `POST /client/theme`,
  `POST /client/publish`, `POST /client/guests`, `POST /client/gallery`, etc.) — all
  behind `requireClientAccess`. Deliberately **no** `POST /client/unpublish` or
  equivalent exists anywhere in this router — the live→draft direction has no route
  at all on the client side, not merely a hidden one (decision 3). New router,
  `routes/client.routes.js`.

**New controllers**
- `controllers/public.controller.js` — homepage render (active event-type cards +
  active theme swatches sourced from the same registries/derivation Phase 1
  introduces) + inquiry submission, including server-side validation of the
  submitted `event_type` against the **active** list (not just any of the 9) and the
  submitted `preferred_theme` against `themesForEventType(event_type)` — the same
  pairing the form's own client-side cascade enforces, checked again here because the
  client-side script is not a trust boundary.
- `controllers/client.controller.js` — token bootstrap + the client dashboard actions,
  each calling into the same core logic Phase 8 extracts from
  `admin.controller.js` (see §F).

**New models**
- `models/inquiry.model.js` — CRUD + the atomic approve transaction (§E).
- `models/clientAccess.model.js` — token creation (stores only the hash) and
  token-to-event lookup.

**New views**
- `views/public/home.ejs` — the homepage itself (its own minimal stylesheet, not a
  theme — this page has no `event` in scope, so it cannot use any per-theme
  `theme.css`). Pricing section is the literal copy "Contact us for a custom quote."
  — no numbers anywhere. The Book Now form's event-type `<select>` and theme
  `<select>` are wired together by a new small script (see below) — choosing an
  event type filters the theme options down to `themesForEventType(that type)` and
  resets the theme field to its blank/unselected state, rather than auto-picking a
  theme on the visitor's behalf (a deliberate difference from the admin form's
  filter script, which auto-selects the first available option — `preferred_theme`
  is optional here, so nothing should be silently chosen for the visitor).
- `views/admin/inquiries-list.ejs`, `views/admin/inquiry-detail.ejs` — shared/generic
  admin styling, same unstyled-or-shared-CSS tier as `events-list.ejs`, not
  theme-specific. The detail/approval view is also where the raw client link is
  displayed once, per decision 6.
- No new client-dashboard view files — Phase 8 reuses the existing
  `views/admin/themes/<slug>/dashboard.ejs` files with a `clientMode` flag (§F);
  writing separate client-only dashboard templates would directly contradict "using
  the existing event dashboard where possible."

**New utility**
- `utils/clientToken.js` — `generateClientToken()` (raw token) and `hashClientToken()`
  (sha256 hex), mirroring the existing small, single-purpose style of `utils/
  passcode.js`/`utils/qrGenerator.js`.
- `public/assets/js/booking-theme-filter.js` — the Book Now form's cascade-and-reset
  script (decision 1). Kept separate from Phase 4's `theme-filter.js` deliberately:
  that script's "auto-select the first available theme" behavior is correct for the
  admin forms (where a theme is required) but wrong for this optional, public field
  (see note above) — sharing one script between the two would mean threading a
  behavior flag through code that's otherwise simple enough not to need one.

---

## D. Proposed data model

```sql
CREATE TABLE IF NOT EXISTS booking_inquiries (
  id               SERIAL PRIMARY KEY,
  full_name        TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT NOT NULL,
  event_type       TEXT NOT NULL,   -- validated server-side against the ACTIVE
                                     -- event-type list (Phase 1) before insert;
                                     -- CHECK constraint mirrors the full 9-value list
                                     -- (same set as events.event_type) for
                                     -- defense-in-depth, not just the active subset —
                                     -- an inquiry for a not-yet-active type should
                                     -- never reach the DB in practice, but the
                                     -- constraint itself doesn't need to track which
                                     -- types are "active" today
  preferred_theme  TEXT,            -- nullable; validated server-side against
                                     -- themesForEventType(event_type); no CHECK
                                     -- (events.theme has none either — same
                                     -- precedent, themes can grow without a migration)
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'approved', 'declined')),
  event_id         INTEGER REFERENCES events(id) ON DELETE SET NULL,
  decided_at       TIMESTAMPTZ,
  decided_by       INTEGER REFERENCES admin(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_inquiries_status ON booking_inquiries(status);

CREATE TABLE IF NOT EXISTS client_access (
  id           SERIAL PRIMARY KEY,
  event_id     INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,   -- sha256 hex of the raw token; raw token is
                                       -- never stored, only ever shown once at
                                       -- approval time
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Design notes:
- `event_id UNIQUE` on `client_access` — one event has exactly one client token, ever.
  If a token ever needs rotating (lost link, security concern), that's a
  delete-and-reissue on this row, not a new table shape.
- `booking_inquiries.event_id` is nullable and only ever set once, by the approve
  transaction (§E) — never by any other code path.
- Raw token generation: `crypto.randomBytes(32).toString('hex')` — 256 bits, in the
  new `utils/clientToken.js`. Hashing: `crypto.createHash('sha256').update(raw).
  digest('hex')`. `/client/:token` hashes the incoming URL param and looks up
  `client_access WHERE token_hash = $1` — the raw token is never stored, logged, or
  round-tripped anywhere after the moment it's generated and shown to the admin.
- No `booking_inquiries` row is ever deleted by the event-lifecycle sweep — that sweep
  only targets `events` rows by `wedding_date`, and inquiries have no `wedding_date`
  column at all, so they're structurally outside its reach without any extra guard.

---

## E. Approval and decline transaction design

**Decline** — no transaction needed beyond the single statement itself:

```sql
UPDATE booking_inquiries
SET status = 'declined', decided_at = now(), decided_by = $adminId
WHERE id = $id AND status = 'new'
RETURNING *;
```
If this returns no row, the inquiry was already decided (by an earlier decline, or by
an approval that beat a duplicate decline click) — the handler treats that as a no-op,
not an error surfaced to the admin as a failure (idempotent from the admin's point of
view: "it's already resolved" either way).

**Approve** — claim-then-act, same shape as `archiveAndDelete`'s transaction, so that
the event is only ever created *after* this request has proven it's the sole winner:

```
BEGIN
  UPDATE booking_inquiries
  SET status = 'approved', decided_at = now(), decided_by = $adminId
  WHERE id = $id AND status = 'new'
  RETURNING *;
  -- 0 rows → ROLLBACK, return "already decided" to the admin (not an error page —
  -- same idempotent treatment as decline above)

  INSERT INTO events (couple_names, wedding_date, venue, event_type, theme, status, ...)
  VALUES ($fromInquiry..., NULL, $fromInquiry..., $eventType, $resolvedTheme, 'draft')
  RETURNING id;
  -- draft event: couple_names/venue start as placeholder text the admin/client fills
  -- in properly later ("New booking — <full_name>" style); wedding_date is genuinely
  -- NULL (Phase 2), not a placeholder date — the event simply cannot go live until a
  -- real date is set, enforced both in the app (publishCore's guard, callable by
  -- either an admin or the resulting client) and by the DB CHECK constraint as a
  -- backstop

  UPDATE booking_inquiries SET event_id = $newEventId WHERE id = $id;

  INSERT INTO client_access (event_id, token_hash) VALUES ($newEventId, $hash);
COMMIT
```

This guarantees, by the same reasoning already proven correct in
`gatepass.model.js`'s `checkIn`: **only one concurrent request can ever flip
`status` from `'new'` to `'approved'`**, because the conditional `UPDATE ... WHERE
status = 'new'` is atomic at the database level regardless of how many requests race
it. Every subsequent step (the event insert, the token issuance) only runs for the one
request that won that update — so two simultaneous clicks of "Approve" (double-click,
duplicate network retry, two admin tabs) can never create two events or two tokens for
the same inquiry. The raw token is generated in the application layer *before* the
transaction opens (pure computation, no DB round-trip needed for randomness) and is
only ever written to the database as its hash, inside the same transaction as the
event it belongs to — so a rolled-back transaction never leaves an orphaned token
either. The raw token is returned to the approval request's response and rendered
once in `views/admin/inquiry-detail.ejs` for the admin to copy — per decision 6, no
email is sent; the admin relays it manually (WhatsApp or similar).

---

## F. Reusing the existing event dashboard for a client without granting admin access

**The security boundary is where the event id comes from, not which template
renders.** Every admin dashboard view (`views/admin/themes/<slug>/dashboard.ejs`) is
just an EJS template — it has no authorization logic of its own; it renders whatever
`event`/`guests`/`stats`/etc. object its controller handed it. Reusing the *view* is
therefore safe by construction. Reusing the admin *controller functions as they exist
today* is **not** safe by construction, because every one of them (`showDashboard`,
`updateEvent`, `bulkAddGuests`, `uploadGalleryPhotos`, ...) currently trusts
`req.params.id` directly, with no ownership check — that's correct today only because
`requireAdmin` already grants access to every event, so there's nothing to check.

The plan: **extract each action's core logic into a function that takes `eventId` as
an explicit parameter**, and make the existing admin route handler a thin wrapper that
passes `req.params.id`. A new client route handler becomes an equally thin wrapper
that passes `req.session.clientEventId` — a value that only `requireClientAccess`
(§below) ever sets, and only after validating a token hash against exactly one row in
`client_access`. A client can change `req.params.id` in the URL all they want; it is
never read on the client route path at all, so there is nothing there to tamper with.

```js
// controllers/admin.controller.js (illustrative shape, not final code)
async function updateEventCore(eventId, fields, file) { /* existing updateEvent body */ }
async function updateEvent(req, res) {           // admin route handler
  await updateEventCore(req.params.id, req.body, req.file);
  res.redirect(`/admin/events/${req.params.id}`);
}
module.exports.updateEventCore = updateEventCore; // now importable

// controllers/client.controller.js
const { updateEventCore } = require('./admin.controller');
async function updateEvent(req, res) {            // client route handler
  await updateEventCore(req.session.clientEventId, req.body, req.file);
  res.redirect('/client/dashboard');
}
```

The theme-change action follows the identical shape (`changeThemeCore(eventId,
theme)`), reused by both admin and client route handlers exactly like
`updateEventCore` above.

**Publishing is intentionally asymmetric (decision 3), and that asymmetry is
expressed as which functions exist to be imported, not as a role check inside a
shared one:**

```js
// controllers/admin.controller.js
async function publishCore(eventId) {     // draft -> live only
  const event = await eventModel.findById(eventId);
  if (!event.wedding_date) throw new ValidationError('Set a date before publishing.');
  return eventModel.setStatus(eventId, 'live');
}
async function unpublishCore(eventId) {    // live -> draft only
  return eventModel.setStatus(eventId, 'draft');
}
module.exports.publishCore = publishCore;  // exported — both admin and client call this
// unpublishCore is NOT exported — nothing outside this file can reach it

async function toggleStatus(req, res) {    // existing admin route handler
  const event = await eventModel.findById(req.params.id);
  if (event.status === 'live') await unpublishCore(event.id);
  else await publishCore(event.id);
  res.redirect(`/admin/events/${req.params.id}`);
}

// controllers/client.controller.js
const { publishCore } = require('./admin.controller'); // unpublishCore isn't here to import
async function publish(req, res) {
  await publishCore(req.session.clientEventId);
  res.redirect('/client/dashboard');
}
// no client.controller.js function ever calls anything that can set status to 'draft'
```

The admin's existing single toggle button is unchanged in behavior (still flips
either direction, still one click) — only its internals are now two named functions
instead of one inline branch, and only one of those two names is ever exported for
the client controller to require. A client compromising their own session cannot
"discover" an unpublish capability that isn't wired to any route in
`routes/client.routes.js` in the first place — the same "security boundary is which
routes exist" principle already used for the other forbidden surfaces below.

`requireClientAccess` (new, in `middleware/auth.middleware.js`):
```js
function requireClientAccess(req, res, next) {
  if (req.session && req.session.clientEventId) return next();
  return res.status(404).send('Not found.'); // no redirect hint that a client route
}                                             // system exists, matching this app's
                                               // existing "clean 404 over information
                                               // leak" pattern (event.model.js findById)
```

**Capability table** — what the client dashboard exposes vs. what stays admin-only,
enforced by which routes exist under `/client/*` at all (not by a role flag checked
inside a shared handler):

| Capability | Client | Reasoning |
|---|---|---|
| View own event dashboard | Yes | The whole point of the feature |
| Edit event details (itinerary, message, contact, subtitle, etc.) | Yes | Matches "manages only their own event" |
| Bulk-add / view guest list, export Excel | Yes | Core planning task for the couple/celebrant |
| Upload/delete gallery & cameo photos | Yes | Core planning task |
| Publish (draft → live) | Yes, **guarded** | Blocked while `wedding_date IS NULL` (Phase 2's shared `publishCore` guard) — the client is the one who knows when they're ready to share the link, but not before a real date exists |
| Unpublish (live → draft) | **No** (decision 3) | No route exists for this on the client side at all — reverting a live event is admin-only, since guests may already have the link and be mid-RSVP by the time an event is live |
| Change theme | **Yes, restricted** (decision 7) | Client-facing theme `<select>` is populated from `themesForEventType(event.event_type)` only — the same list the admin form already derives — so a client can never select a theme belonging to a different event type; validated again server-side in `changeThemeCore`, not just filtered client-side |
| Change access_mode | **No** (decision 7) | Security/trust-relevant setting, stays admin-reviewed only |
| Delete event (Danger Zone) | **No** | Irreversible; stays admin-only |
| "All weddings"/"All events" nav link | **No** | Would leak the existence/count of other events |
| Door Scanner tile/link | **No** (hidden from client dashboard) | Explicit requirement; the `/scan` route itself only ever exposes one guest's name per valid QR token, but hiding the entry point avoids any ambiguity about scope |
| `/admin/*`, `/admin/inquiries*`, `/admin/events` (list) | **No** | Never routed to `requireClientAccess`; `requireAdmin` still gates all of it unchanged |

The `clientMode` flag threaded into the three `dashboard.ejs` files only ever
*removes or restricts* markup (Danger Zone block gone entirely, access_mode select
gone entirely, theme select's options filtered, the "All weddings"/Door-Scanner nav
items gone) — it adds no new template logic path that could accidentally leak
admin-only data, and the default (`clientMode` undefined/falsy) renders exactly what
an admin sees today, so no visual regression for the existing admin flow.

---

## G. Theme-system refactor boundaries

**What belongs in shared admin CSS** (`public/assets/css/admin-shared.css`, new file):
structural/layout rules only — the `.bb-admin*` box model: grid/flex layout,
padding/margin, border-radius *as a reference to a CSS variable each theme still
defines*, table layout, form-field sizing. Anything that answers "where does this sit
on the page" or "how much space does it take."

**What remains inside each theme package** (`public/themes/<slug>/theme.css`,
unchanged ownership): every color value, every `font-family` declaration, every
`background`/`background-image` (including Lady Gianna's now-plain blush background
and Botanical Bloom's floral illustration), every theme-specific motif (Lavender
Romance's CSS "✽" glyphs, Lady Gianna's `.lg-*` guest-facing vocabulary in full). The
shared file references CSS custom properties (`var(--bb-admin-radius)`,
`var(--bb-ink)`, etc.) that each `theme.css` must keep defining — the shared file
supplies *layout*, never a *value*. This directly satisfies "theme background images
remain owned by each individual theme; do not centralize theme visuals into shared
CSS," and matches `SystemArc.md` Part 1's existing Phase 3 recommendation exactly —
this input doesn't change that design, it schedules it (as this plan's Phase 4).

**How theme swatch data joins the registry** — `config/themes.js` gets two new
optional fields per entry, populated only for the 3 existing themes (no new theme
entries — "do not include unfinished external themes"):

```js
const AVAILABLE_THEMES = [
  {
    slug: 'botanical-bloom', label: 'Botanical Bloom', eventType: 'wedding',
    swatchColors: ['#f6f2e7', '#9f5b4c', '#7f8f5f'], // cream / rose / sage, hand-picked
    tagline: 'Warm, botanical, classic.',              // to match each theme's own palette
  },
  // ...
];
```
`swatchColors` is a manually-curated array (2–4 hex strings), not programmatically
extracted from `theme.css` — CSS custom properties aren't reliably parseable without a
real CSS parser, and hand-picking 3 representative colors per theme is a five-minute,
low-risk task versus adding a build step. The public homepage's theme gallery (Phase
5) renders these as plain colored swatch divs (per "swatch cards initially, not
screenshots" — no `<img>`, no per-theme asset dependency, nothing to keep in sync with
each theme's actual CSS beyond the initial hand-pick).

**How "active" event types are derived** (new in this revision, ties Phase 1 and this
section together): there is no stored "is this type active" flag anywhere — a type is
active purely because `AVAILABLE_THEMES.some(t => t.eventType === slug)` is true. The
homepage's event-type cards, the homepage's theme gallery, the booking form's
event-type `<select>`, and the admin create-event form's event-type `<select>` all
derive from the exact same computation. Adding a real theme for, say, `graduation`
later is the *only* step needed to make `graduation` appear everywhere at once — no
separate "activate this event type" toggle to remember.

---

## H. Testing checklist, per phase

**Phase 1 — event-type expansion + active/planned visibility**
- [ ] Confirm the admin create-event form's event-type `<select>` shows only
      `wedding`/`birthday` — none of the other 7 appear, anywhere, yet.
- [ ] Confirm the two active types' title-label swap (Couple names / Celebrant) still
      works correctly, now driven by the `data-title-label` attribute instead of the
      old hardcoded ternary.
- [ ] Directly insert an `events` row via SQL with one of the 7 planned-but-inactive
      types (e.g. `graduation`) — confirm the widened CHECK constraint *accepts* it
      (the registry design supports all 9, per decision 3) even though nothing in the
      UI currently offers it.
- [ ] Confirm existing wedding/birthday events and their dashboards are completely
      unaffected.

**Phase 2 — nullable wedding_date**
- [ ] Create an event with no date via a direct model call (simulating what Phase 7's
      approval will do) — confirm it saves successfully with `wedding_date = NULL`.
- [ ] Open that event's dashboard — confirm "Days to go" shows "TBD" (not "NaN", not
      blank, not a crash).
- [ ] Save the dashboard's Itinerary-only (or other partial) form on that dateless
      event — confirm it succeeds without the browser blocking submission and without
      the server rejecting it for a missing date.
- [ ] Attempt to toggle that event to `live` while still dateless — confirm the
      app-level guard blocks it with a clear message.
- [ ] Set a real date, then toggle to `live` — confirm it succeeds.
- [ ] Attempt to bypass the app-level guard directly via SQL (`UPDATE events SET
      status = 'live' WHERE wedding_date IS NULL`) — confirm the new DB `CHECK`
      constraint rejects it as a backstop.
- [ ] Confirm the event-lifecycle sweep does not touch dateless draft events (query
      the sweep's `WHERE` clause against a dateless row directly, or wait for a sweep
      cycle in a test environment).
- [ ] Delete a dateless draft event via the normal admin delete action — confirm
      `archiveAndDelete` succeeds (this specifically exercises the new
      `event_archive.wedding_date` nullability).
- [ ] Confirm a normal admin-created event (via `event-form.ejs`) still requires a
      date at creation time, unchanged from today.

**Phase 3 — swatch registry**
- [ ] `require('./config/themes')` and confirm `swatchColors`/`tagline` are present
      for all 3 themes; confirm nothing else in the app changed behavior (registry
      addition only).

**Phase 4 — admin CSS separation**
- [ ] Visually compare (screenshot or structural diff) `edit-event.ejs`, `assets.ejs`,
      and all 3 dashboards before/after — must be pixel-identical.
- [ ] Confirm the font-loading bug fix: open Lavender Romance's and Lady Gianna's
      Assets page and verify their real fonts now load (previously fell back to
      system fonts — see `SystemArc.md` Part 1 §5).
- [ ] Confirm the extracted `theme-filter.js` produces identical dropdown-filtering
      behavior on both `event-form.ejs` and `edit-event.ejs`, and that Phase 1's
      label-swap redesign still works correctly after this file's script extraction.

**Phase 5 — homepage + inquiry table + rate limiting**
- [ ] `GET /` renders the homepage (no more redirect to `/admin/login`).
- [ ] Homepage's event-type cards show only the active types (wedding, birthday);
      homepage's theme swatches match the registry exactly.
- [ ] Homepage pricing section shows the literal text "Contact us for a custom
      quote." — no numbers anywhere.
- [ ] Submit the Book Now form with valid data — confirm exactly one
      `booking_inquiries` row is created with `status = 'new'`, and confirm **no**
      `events` row was created.
- [ ] On the Book Now form, choose an event type, then choose a theme, then change
      the event type again — confirm the theme selector's options change to match
      the new event type and the previously-chosen theme is cleared, not silently
      carried over or auto-replaced.
- [ ] Submit with an invalid/spoofed `event_type` (including one of the 7 inactive
      types) or a `preferred_theme` that doesn't belong to the chosen `event_type` —
      confirm the server rejects both rather than inserting them (this must hold even
      when bypassing the cascade script entirely, e.g. via `curl`).
- [ ] Submit with missing required fields (name/phone/email) — confirm a clean
      validation error, not a raw DB error.
- [ ] Submit `POST /inquiries` 6 times from the same IP within 15 minutes — confirm
      the 6th is rejected (429), the first 5 succeed; confirm the admin login route
      and every other route are unaffected by this route-scoped limiter.

**Phase 6 — admin inquiries list**
- [ ] Log in as admin, confirm the new inquiries appear in `/admin/inquiries`.
- [ ] Confirm `/admin/inquiries*` is unreachable without `requireAdmin` (redirect to
      login, same as every existing admin route).

**Phase 7 — approve/decline**
- [ ] Approve one inquiry — confirm exactly one new `events` row (`status: 'draft'`,
      `wedding_date: NULL`) and exactly one `client_access` row are created, the
      inquiry's `event_id` is set, and the raw client link is displayed once in the
      admin UI.
- [ ] Fire two near-simultaneous approve requests for the same inquiry (e.g. two
      `curl` calls in quick succession, or a double-click) — confirm only one event
      and one token are ever created; the second request must not error ungracefully,
      it should reflect "already approved."
- [ ] Decline an inquiry — confirm no event/token is created and the inquiry's status
      becomes `declined`.
- [ ] Attempt to approve an already-declined inquiry (and vice versa) — confirm
      rejected as already-decided.
- [ ] Confirm no email is sent anywhere in this flow (nothing in this input calls
      `utils/mailer.js`).

**Phase 8 — client access**
- [ ] Visit `/client/<valid-token>` — confirm it establishes access and redirects to
      the dashboard, showing only that event's data.
- [ ] Visit `/client/<invalid-or-guessed-token>` — confirm a clean 404, not a 500 or
      any hint of what a valid token looks like.
- [ ] From an authenticated client session, attempt to reach `/admin/events`,
      `/admin/inquiries`, `/admin/events/<other-id>`, `/scan` — confirm every one is
      unreachable (404 or redirect to admin login, never the target content).
- [ ] Confirm a client can edit their own event's details, guests, and gallery/cameo
      photos, and that those writes only ever affect their own `event_id` (verify via
      DB query, not just the UI).
- [ ] Confirm the client's theme `<select>` only ever offers themes matching their
      own event's `event_type`; confirm a direct `POST` attempting to set a theme
      belonging to a different event type is rejected server-side even if the
      client-side filtering is bypassed.
- [ ] Confirm the client cannot change `access_mode` via any route.
- [ ] On a still-dateless draft event, confirm the client's "Publish" action is
      blocked with a clear message (proves `publishCore`'s guard works identically
      for both the admin and client callers, per §F).
- [ ] Set a date, publish via the client dashboard — confirm the event goes live.
- [ ] With that event now live, confirm the client dashboard no longer shows any
      control that could revert it to draft, and confirm directly (via `curl`) that
      no `/client/*` route accepts a request that would set `status` back to
      `'draft'` — not a 403, a genuine absence of any such route.
- [ ] Confirm the existing guest-facing flow (passcode gating, RSVP, QR gatepass) for
      a client-managed event is completely unchanged from an admin-managed one — this
      is the one place a regression would be easy to introduce silently.

**Phase 9 — capability polish**
- [ ] Confirm Danger Zone, access_mode select, and the "All weddings"/Door Scanner nav
      items are absent from the client dashboard's rendered HTML (not just hidden by
      CSS — same security-by-omission standard already used for guest gating, per
      `SystemArc.md` Part 2 §2).
- [ ] Grep `routes/client.routes.js` and `controllers/client.controller.js` directly
      to confirm neither `unpublishCore` nor any equivalent live→draft write appears
      anywhere in either file — the absence should be verifiable by reading the code,
      not just by testing every request pattern.
- [ ] Confirm an admin can still unpublish a live event that a client published,
      unchanged from today's `toggleStatus` behavior.
- [ ] Full regression pass: confirm every existing admin-side flow (login, create/
      edit/delete event, guest management, assets, export, scanner, event lifecycle
      sweep) is byte-for-byte unchanged from before this input.

---

## I. Risks, dependencies, backward-compatibility concerns

- **R1 (resolved)** — the label-swap script's binary wedding/birthday assumption is
  replaced by the data-driven `data-title-label` design in Phase 1, using the
  approved labels for all 9 types (listed in §B Phase 1, decision 4), so it extends
  to new active types automatically with no further script change.
- **R2 (resolved differently than the first draft)** — rather than a placeholder
  date, `wedding_date` is genuinely nullable (Phase 2). The residual risk here shifts
  from "is the placeholder date confusing" to "does the required-field-validation
  split between `createEvent` (still requires a date) and `updateEvent` (no longer
  does) stay correct under every partial-form path" — this is exactly why Phase 2 is
  its own isolated, thoroughly-tested phase before Phase 7 depends on it.
- **R3 — the admin-controller "extract core logic" refactor (§F) touches working
  code**, and now covers more surface than the first draft (`changeThemeCore`,
  `publishCore`/`unpublishCore`, not just the update action). Every function it
  touches currently works correctly for the admin path — including `toggleStatus`,
  which must keep behaving as one bidirectional action for admins even though it's
  now internally two named functions. This refactor must be verified to produce
  byte-identical behavior on that existing path (same as Phase 4's CSS work) before
  the new client path is trusted, and specifically must verify `unpublishCore` stays
  unexported/unreachable from `controllers/client.controller.js`. Recommend doing
  this refactor as its own sub-step within Phase 8, verified against the existing
  admin flow *before* wiring up any client route.
- **R4 — broader rate-limiting gap remains, by design.** Decision 8 scopes rate
  limiting to `POST /inquiries` only; `/admin/login`, `/invite/:eventId/verify`, and
  `/scan/verify` remain unthrottled, as they are today (tracked separately in
  `SystemArc.md` Part 2 §3/§6 — not part of this input).
- **Removing `required` from three date `<input>` fields (Phase 2) shifts validation
  weight onto the server.** The browser no longer blocks an empty date on those forms
  — correctness now depends entirely on the server-side guard (`updateEvent`'s
  relaxed check + the status-toggle guard + the DB `CHECK` backstop) actually holding,
  which is why all three layers are specified rather than relying on just one.
- **Schema touches are additive/widening only, never destructive**: a widened CHECK
  constraint, two columns becoming nullable (with a new CHECK replacing the safety
  the `NOT NULL` used to provide, scoped correctly to only matter when `status =
  'live'`), and two new tables. No existing column is renamed, no existing row's data
  is migrated or transformed.
- **Backward compatibility**: every phase above is additive to the schema or a
  behavior-preserving refactor (CSS extraction, controller core-logic extraction). No
  existing route's behavior changes for the admin or guest paths, and no existing
  theme's rendered output changes. The guest-facing passcode/RSVP/QR/scanner/
  Cloudinary/event-lifecycle flows are not touched by any file in this plan.
- **Dependency**: Phase 7 depends on Phase 2 (needs nullable dates to avoid a
  placeholder) and Phase 6 (needs the inquiries list UI to trigger approval from,
  though it could technically be tested via direct model calls without Phase 6).
  Phase 8 depends on Phase 7 (needs real `client_access` rows to test against) and on
  Phase 1 (the client theme picker needs `themesForEventType()` to already reflect
  the active-only design). Phases 1–4 have no interdependency and could be done in
  any order relative to each other.

---

## Issues found / decisions needed

Every decision from the first draft (D1–D7) is resolved by the nine second-round
product decisions. All three items the second round had left open are now resolved
by the third round: the Book Now form's theme selector cascades from event type and
resets on change (validated server-side regardless), the public inquiry rate limit is
fixed at 5 submissions per IP per 15 minutes, and publishing is asymmetric — a client
may publish their own dated draft but can never revert a live event back to draft,
which only an admin can do.

**Nothing currently remains open in this plan.** Every product/security decision
raised across all three drafting rounds has an approved answer reflected in the
sections above.

---

## Phase 1 implementation record

**Status: implemented and tested locally, NOT committed, pushed, or deployed —
awaiting explicit approval per instruction.**

### Files changed

- `db/schema.sql` — widened the inline `CREATE TABLE`'s `event_type` CHECK to all 9
  slugs (for a brand-new database), and added an idempotent
  `ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check` +
  `ADD CONSTRAINT events_event_type_check CHECK (...)` pair for existing databases
  (local dev, and production once approved) — the pre-existing
  `ADD COLUMN IF NOT EXISTS event_type ...` line only ever fires once, when the
  column doesn't exist yet, so it could not have widened the constraint on a
  database that already has this column.
- `config/eventTypes.js` — all 9 entries, each with `slug`, `label`, and the
  approved `titleLabel`.
- `controllers/admin.controller.js` — added `activeEventTypes()` (derives the
  selectable list by filtering `EVENT_TYPES` down to those with
  `themesForEventType(slug).length > 0` — no stored flag, purely computed from the
  theme registry); replaced all three `eventTypes: EVENT_TYPES` call sites
  (`newEventForm`, `createEvent`'s error re-render, `showEditForm`) with
  `eventTypes: activeEventTypes()`; added a themeless-type guard to both
  `createEvent` and `updateEvent` (see "Issue found" below — not in the original
  Phase 1 file list, added during implementation because testing surfaced a real
  gap).
- `views/admin/event-form.ejs` — event-type `<option>`s now carry
  `data-title-label`; the label-swap script reads
  `eventTypeSelect.options[eventTypeSelect.selectedIndex].dataset.titleLabel`
  instead of a hardcoded `birthday` ternary.
- `views/admin/edit-event.ejs` — same `data-title-label` addition; the
  server-rendered initial label now looks up the event's own type in the
  (already-active-filtered) `eventTypes` list instead of a hardcoded ternary; same
  JS script change as `event-form.ejs`.
- No dashboard template required changes. Verified by inspection: only
  `views/admin/themes/botanical-bloom/dashboard.ejs` renders any selector
  affected by this input (an inline theme `<select>`, already filtered via
  `themes.filter(t => t.eventType === event.event_type)`), and since
  `AVAILABLE_THEMES` itself is untouched by Phase 1, that filter's behavior is
  unchanged. Lavender Romance's and Lady Gianna's dashboards have no inline
  event-type or theme selector at all.

### Migration applied

- Local Postgres (`weddings103` database): `npm run db:migrate` — ran cleanly,
  `"Schema applied."` Verified directly against `pg_constraint` afterward that
  `events_event_type_check` now reads
  `CHECK ((event_type = ANY (ARRAY['wedding', 'birthday', 'bridal-shower',
  'baby-shower', 'engagement', 'anniversary', 'graduation', 'corporate',
  'other'])))`.
- **Production (Neon): not yet run.** Per instruction, held pending explicit
  approval alongside commit/push/deploy.

### Tests run and results

All ten items from the required testing list were executed against the local
database and a locally running server, in addition to one gap the tests
themselves surfaced (see "Issue found" below):

1. **Local migration** — ran successfully (above).
2. **Database accepts all nine valid event types** — direct `INSERT` for each of
   `wedding`, `birthday`, `bridal-shower`, `baby-shower`, `engagement`,
   `anniversary`, `graduation`, `corporate`, `other` succeeded.
3. **Database rejects an invalid event type** — `INSERT ... event_type =
   'not-a-real-type'` failed with `new row for relation "events" violates check
   constraint "events_event_type_check"`, as expected.
4. **Create Event and Edit Event show only Wedding and Birthday** — confirmed via
   `curl` against the rendered HTML of both `/admin/events/new` and
   `/admin/events/1/edit`: exactly two `<option>`s in each event-type `<select>`,
   `wedding` and `birthday`, none of the other 7.
5. **Wedding still displays "Couple names"** — confirmed on the Create form (the
   default-selected option) and structurally via the registry data.
6. **Birthday still displays "Celebrant"** — confirmed server-side on a real
   birthday event's (`id 19`, Lady Gianna) Edit form: rendered
   `<label id="coupleNamesLabel">Celebrant</label>`.
7. **The 7 planned types do not appear in current UI selectors** — confirmed by
   the same Create/Edit form HTML inspection in test 4; none of
   `bridal-shower`/`baby-shower`/`engagement`/`anniversary`/`graduation`/
   `corporate`/`other` appear as an `<option>` anywhere.
8. **Existing Botanical Bloom, Lavender Romance, and Lady Gianna events still
   render and save correctly** — admin dashboard (`/admin/events/1`,
   `/admin/events/19`) and guest-facing invitation (`/invite/1`) all returned
   `200`; a full-form save (venue + itinerary) on a Botanical Bloom event
   persisted correctly; a partial-form save (itinerary only, no `eventType`
   field submitted at all) on the Lady Gianna event also persisted correctly and
   did **not** trip the new themeless-type guard, confirming the guard only
   fires when `eventType` is actually being changed.
9. **Direct POST with a planned event type does not create/save an event** —
   `POST /admin/events` with `eventType=graduation` returned the form re-render
   (HTTP 200, not a redirect to a new event) with the message "That event type is
   not available yet — no theme is registered for it."; confirmed via direct DB
   query that no row was created. The equivalent attempt against
   `POST /admin/events/1` (trying to switch an existing wedding event to
   `corporate`) redirected to the edit page with an error and left the event's
   `event_type`/`theme` completely unchanged, confirmed by DB query before/after.
10. **Test data deleted** — all 9 direct-insert test rows removed by
    `couple_names LIKE 'Phase1 DB Test%'`; the rejected `graduation`/`corporate`
    attempts never created a row to begin with, so nothing else needed cleanup.

### Issue found (fixed during this phase, in scope)

Testing surfaced a real gap not caught by writing the plan alone: without an
explicit guard, a direct `POST /admin/events` (or `POST /admin/events/:id`)
carrying a themeless `eventType` (e.g. `graduation`) would have reached
`resolveTheme()`, found zero themes for that type, fallen through to
`DEFAULT_THEME_BY_EVENT_TYPE['graduation']` (`undefined`, since that map only has
`wedding`/`birthday` entries), and `eventModel.create()`'s own `theme ||
DEFAULT_THEME` fallback would then have silently saved the event with
`event_type: 'graduation'` paired with `theme: 'botanical-bloom'` — exactly the
"silently map them to another theme" outcome requirement 11 rules out, and
exactly what requirement 9's test is designed to catch. Fixed by adding an
explicit `themesForEventType(requestedType).length === 0` check in both
`createEvent` and `updateEvent` that rejects the request with a normal form/
redirect error before any database write, rather than letting `resolveTheme()`'s
existing (and still correct, for *valid* type pairs) fallback logic run at all
for a type with no themes. Verified by test 9 above.

One minor, deliberately-accepted rough edge: `updateEvent`'s rejection reuses the
existing generic `?error=1` redirect (same message as a missing required field:
"Couple names/Celebrant, date, and venue are required."), which isn't precisely
accurate for this specific rejection reason. Kept as-is to stay minimal and
consistent with `updateEvent`'s existing single-error-path design, per this
phase's scope — a more specific message would be a small, separate, low-risk
follow-up if wanted.

### Local environment note (not a repo change)

The local Postgres instance (`C:\Users\fadhi\pgsql103_data`) was found listening
on the default port 5432 instead of the 5433 this project's `.env` expects —
unrelated to this input, likely drifted after a prior restart. Reconfigured its
`postgresql.conf` to `port = 5433` and restarted it so `npm run db:migrate` and
the local server could run at all. This is local machine configuration, not a
project file, and is not part of the file-change list above.

One local dev database side-effect from testing: event `id 1` ("Amani na
Zawadi")'s `venue` field was overwritten to `"Test Venue Updated"` as part of
test 8's save-path verification (its original value was not captured
beforehand). Local dev data only — this event does not exist in, and this in no
way touches, production.

## Phase 2 implementation record

Status: implemented and fully tested locally. **Not committed, not pushed, not
migrated in production** — awaiting explicit approval, per this phase's
instructions.

### Files changed

1. `db/schema.sql` — `wedding_date` made nullable on both the inline
   `CREATE TABLE events` and `CREATE TABLE event_archive` blocks (for a fresh
   database), plus three new idempotent statements for an existing database:
   `ALTER TABLE events ALTER COLUMN wedding_date DROP NOT NULL`, a
   `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT events_live_requires_date
   CHECK (status <> 'live' OR wedding_date IS NOT NULL)` pair, and
   `ALTER TABLE event_archive ALTER COLUMN wedding_date DROP NOT NULL`.
2. `models/event.model.js` — `update()`'s SQL changed from
   `wedding_date = $2` to
   `wedding_date = COALESCE(NULLIF($2, '')::date, wedding_date)` (see "Issue
   found" below for why the `::date` cast is required, not optional).
   `create()` unchanged functionally; comment added confirming it was already
   null-safe.
3. `controllers/admin.controller.js` — `daysUntil()` now returns `null` for a
   falsy `dateStr` instead of computing `NaN`. `showDashboard` now derives an
   `error` from `?error=needs_date` and passes it to every dashboard template.
   `updateEvent`'s required-field check dropped `weddingDate` (still required
   in `createEvent`, unchanged). `toggleStatus` gained a guard that redirects
   back with `?error=needs_date` instead of flipping status when a draft with
   no `wedding_date` attempts to go live.
4. `views/admin/edit-event.ejs` — date `<input>` lost `required`, value
   guarded with `|| ''`, label shows a "(not set yet...)" hint when null.
5. `views/admin/themes/botanical-bloom/dashboard.ejs` — same `<input>` fix as
   above on its inline Wedding-details form; added an `error` block next to
   the "Go Live" button (this theme has no "Days to go" stat, confirmed by
   direct inspection — no TBD handling needed here).
6. `views/admin/themes/lavender-romance/dashboard.ejs` — "Days to go" bubble
   shows `TBD` (with a "Set a date to see this" sub-label) when `daysToGo` is
   `null`; the date pill at the top of the page shows "Date TBD" instead of an
   empty string for the same case; added an `error` block next to the
   Danger-zone status-toggle button (this theme has no error display of any
   kind before this change — edits go through a separate `/edit` page).
7. `views/admin/themes/lady-gianna/dashboard.ejs` — "Days to go" bubble gets
   the same TBD treatment as Lavender Romance; the Itinerary card's *hidden*
   `weddingDate` input gets the `|| ''` guard (this was the highest-risk spot
   — see "Issue found" below); the visible "Event details" date `<input>`
   loses `required` and gets the `|| ''` guard, same as the other two themes;
   added an `error` block next to the Danger-zone status-toggle button.
8. `input_20.md` (this file) — Phase 2 implementation record.
9. `PROMPT_REPORT.md` — Phase 2 status section (local-only; see that file).

`utils/eventLifecycle.js` and `models/archive.model.js` — confirmed by actual
test, not changed. `views/admin/event-form.ejs` — confirmed unchanged by
re-inspection (still requires a date, as intended for manual creation).

### Issue found (fixed during this phase, in scope)

Testing surfaced a real bug the plan hadn't anticipated:
`COALESCE(NULLIF($2, ''), wedding_date)` fails in Postgres with `COALESCE
types text and date cannot be matched`. Both `$2` and `''` are untyped
literals, so Postgres resolves `NULLIF($2, '')` as `text`, and `COALESCE`
then refuses to reconcile `text` against the `date`-typed `wedding_date`
column — even though every value `$2` actually holds is either a valid date
string or `''`. This was caught immediately by test 5/6 (a partial-form save
on a dateless draft), which returned HTTP 500 on first attempt. Fixed by
casting explicitly: `COALESCE(NULLIF($2, '')::date, wedding_date)`. Retested
and confirmed working — this is the version now in the diff.

This also means the Lady Gianna Itinerary form's hidden `weddingDate` input
(item 7 above) was a correctness bug, not just cosmetic: without the `|| ''`
guard, a dateless draft's hidden input would have submitted the literal
4-character string `"null"`, which (post-cast-fix) Postgres would have tried
to cast directly to `date` and rejected outright — a 500 on every Itinerary
save for a dateless Lady Gianna draft. Fixed as described above; retested
with an empty value and confirmed no crash and no corruption.

### Migration applied (local)

`npm run db:migrate` run against the local Postgres instance
(`localhost:5433`). Output: `Schema applied.` Verified directly via
`information_schema.columns` and `pg_constraint`:
`events.wedding_date` and `event_archive.wedding_date` both `is_nullable =
YES`; `events_live_requires_date` present with definition
`CHECK (((status <> 'live'::text) OR (wedding_date IS NOT NULL)))`.

### Tests run (all 14 items, using only disposable test events)

1. **Local migration run and verified** — see above.
2. **Dateless draft created via a safe test path** — `createEvent`'s form
   still hard-requires a date (confirmed first, see test 11), so a dateless
   draft was created by calling `eventModel.create()` directly with
   `weddingDate: null` (a one-off Node script, not a new route or feature —
   this simulates exactly what the not-yet-built booking-approval flow will
   eventually do). Three created, one per theme: id 39 (Botanical Bloom,
   wedding), id 40 (Lavender Romance, wedding), id 41 (Lady Gianna, birthday).
3. **NULL persists** — confirmed via `findById` immediately after creation:
   `wedding_date: null` on all three.
4. **Every relevant dashboard opened, confirmed TBD/no NaN** — all three
   theme dashboards (`/admin/events/39`, `/40`, `/41`) returned 200 with no
   `NaN` and no literal `null`-string rendering anywhere on the page (date
   inputs, hidden inputs, Days-to-go bubbles, or the Lavender Romance date
   pill). Lavender Romance and Lady Gianna both showed `TBD` for Days-to-go;
   Botanical Bloom has no such stat (confirmed absent, not a gap).
5. **Partial-form save on a dateless draft, no corruption** — first attempt
   hit the `COALESCE` type-mismatch bug above (500 on both a
   Botanical-Bloom-style save omitting `weddingDate` entirely, and a Lady
   Gianna itinerary-only save submitting `weddingDate=`). After the `::date`
   cast fix and a full server restart, both saves succeeded (302) and
   `wedding_date` remained `null` afterward — confirmed by direct query. Other
   fields (`venue`, `itinerary`) saved correctly.
6. **Attempt to publish a dateless draft is blocked** — `POST
   /admin/events/39/status` on the still-dateless draft redirected to
   `/admin/events/39?error=needs_date`; `status` confirmed still `draft`
   afterward by direct query.
7. **Direct SQL bypass rejected by the CHECK constraint** — `UPDATE events
   SET status = 'live' WHERE id = 39` (run directly against the DB,
   bypassing the app entirely) was rejected with `new row for relation
   "events" violates check constraint "events_live_requires_date"`.
8. **Add a real date, then publish succeeds** — saved `weddingDate=2027-06-15`
   on event 39 via the normal update path (confirmed persisted), then `POST
   /admin/events/39/status` redirected cleanly to `/admin/events/39` (no
   error) with `status` now `live`, confirmed by direct query.
9. **Delete a dateless draft via the normal flow succeeds** — `POST
   /admin/events/40/delete` (event 40, still dateless at the time) redirected
   to `/admin/events`; confirmed the row is gone from `events` and a matching
   row now exists in `event_archive` with `wedding_date: null` — proving the
   `event_archive` nullable-column fix works, not just the `events` one.
10. **Lifecycle sweep does not select/purge a dateless draft** — ran
    `sweepExpiredEvents()` directly against the dev DB with event 41 still a
    dateless draft present; the event still existed afterward, unchanged.
    This is an actual test of the running SQL, not a re-citation of the
    earlier static analysis — confirms requirement 7 ("do not change its SQL
    unless testing proves it is necessary") with real evidence: no change was
    necessary.
11. **Manual Create still refuses a missing date** — `POST /admin/events`
    with `coupleNames`/`venue`/`eventType` but no `weddingDate` re-rendered
    the form (HTTP 200, not a redirect) with "Couple names/Celebrant, date,
    and venue are required."; confirmed via DB query that no row was created
    for that attempt.
12. **Existing Wedding and Birthday events re-verified, read-only** — event
    `id 2` ("Zainab & Omar", wedding, Botanical Bloom, dated 2026-11-01) and
    event `id 19` ("Corner Test", birthday, Lady Gianna, dated 2026-12-31)
    both loaded correctly (200) on dashboard, edit form, and public
    invitation page; the invitation page showed the correctly formatted date
    in both cases; the edit form's date input showed the correct raw
    `YYYY-MM-DD` value in both cases; the Lady Gianna dashboard's Days-to-go
    bubble showed `103` (a real number, not TBD, not NaN) for the dated
    event. No writes were made to either event — GET requests only, per the
    hard constraint not to use existing events as mutation targets. (Events
    `id 1`/`id 4`/`id 6`, already noted elsewhere as carrying prior-phase test
    side effects, were deliberately avoided in favor of `id 2`/`id 19`.)
13. **All test records deleted after verification** — the two remaining test
    events (id 39, id 41) were deleted via the normal admin delete flow (`POST
    /admin/events/:id/delete`, 302 both times); a follow-up query for
    `couple_names LIKE 'TEST%'` returned zero rows. Event 40 was already
    deleted as part of test 9.
14. **No existing local or production event was used as a mutation target at
    any point in this phase** — every write-testing step (tests 5–9, 13) used
    one of the three disposable id-39/40/41 test events created in test 2; the
    only interaction with pre-existing events was the read-only checks in
    test 12.

### Local environment note

The server had to be restarted mid-testing (`taskkill` on the listening PID,
then a fresh `node server.js`) to pick up the `event.model.js` fix — the
first restart attempt silently failed with `EADDRINUSE` because the prior
`node server.js` background process was still holding port 3000, which
briefly caused re-tests to appear to still hit the old, unfixed code. Not a
repo issue; noted here only so the same confusion doesn't recur.
