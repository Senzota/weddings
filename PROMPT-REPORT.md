# Phase: Guest-Table Standardization + Contextual Navigation

Commit: `feat(ui): standardize guest tables and add contextual navigation`
Base commit: `8ea779d fix(client): preserve event access preference and multi-event booking`

## 1. Scope

This phase is view/template/CSS-only. Direct inspection of the full route tree,
every view directory, and all three theme dashboards confirmed the work could
be completed entirely within `.ejs` templates and theme CSS — no route,
controller, model, middleware, schema, session, or authorization change was
required or made.

## 2. Guest-table standard

Target column order for a **normal event guest-management table**:

```
Name | Seats | Code | RSVP | Checked in
```

"Invitation Type" is removed from the table display only. The underlying
`guests.invite_group` database column, the `guestModel`/`admin.controller.js`
bulk-add parsing logic, and the "One guest per line: `Name, seat count`
(optionally `, invitation type`)" instructional hint on the Add-Guests form
are all **unchanged** — a value typed as the third comma-separated field is
still stored exactly as before; it's simply no longer rendered as its own
table column.

### Tables standardized

| File | Before | After |
|---|---|---|
| `views/admin/themes/botanical-bloom/dashboard.ejs` | Name, Invitation type, Seats, Passcode, (copy button), RSVP, Checked in | Name, Seats, Code (passcode text + existing Copy Code button merged into one cell), RSVP, Checked in |
| `views/admin/themes/lavender-romance/dashboard.ejs` | Guest, Invitation type, Seats, Passcode, RSVP, (copy button) | Name, Seats, Code (passcode + copy button merged), RSVP, **Checked in (new)** |
| `views/admin/themes/lady-gianna/dashboard.ejs` | Guest, Invitation type, Seats, Passcode, RSVP, (copy button) | Name, Seats, Code (passcode + copy button merged), RSVP, **Checked in (new)** |

Lavender Romance and Lady Gianna did not previously render a "Checked in"
column at all. The underlying data was already available on every `guest`
object passed to these templates — `models/guest.model.js#findByEvent`
already does `LEFT JOIN gatepasses gp ON gp.guest_id = g.id` and selects
`gp.checked_in` for every theme, unconditionally. Adding the column here is
therefore presentation-only: `guest.checked_in ? 'Yes' : 'No'`, the exact
same expression Botanical Bloom already used.

The "Copy Code"/"Copy code" buttons were not deleted — they were moved
inside the new "Code" cell (next to the passcode text) instead of occupying
their own trailing column, since the task's five-column target has no slot
for a standalone action column here and the button is a convenience action
tied directly to the code value, not an Edit/Delete-style operational
action. `class="copy-btn"` and `data-copy="<%= guest.passcode %>"` are
unchanged, so the existing shared clipboard script (inline `<script>` in
each dashboard, unmodified) continues to work identically.

No `<th></th>` empty header cell remains; each table now has exactly five
header cells.

### Justified exception — not touched

`admin.controller.js#exportGuestList`'s Excel export (`GET
/admin/events/:id/export`) includes an `'Invitation Type'` column
(`{ header: 'Invitation Type', key: 'inviteGroup', width: 25 }`). This is
generated in a controller (out of this phase's allowed scope regardless) and
serves a distinct reporting/download purpose separate from the on-screen
guest-management table — the task's own exception clause covers this case
explicitly. It is unchanged.

No other view in the repository renders `invite_group`/"Invitation type" —
confirmed by a repository-wide search; the three theme dashboards above were
the only guest-management tables that needed normalizing.

## 3. Navigation map (full audit)

Every route, every view under `views/public`, `views/client`, `views/admin`,
`views/guest`, `views/scan`, all three theme dashboards, and the guest
gallery/cameos/other-details/invitation templates were inspected. Most pages
already had adequate explicit navigation using existing routes; only three
pages had none at all.

| Page/context | Had navigation already? | Safe Home | Safe Back | Gap? |
|---|---|---|---|---|
| `views/public/home.ejs` | N/A — is the site home | — | — | No |
| `views/client/login.ejs` | Yes — cross-link to register + `/` | `/` | `/client/register` (cross-link) | No |
| `views/client/register.ejs` | Yes — cross-link to login + `/` | `/` | `/client/login` (cross-link) | No |
| `views/client/dashboard.ejs` | Yes — is client home, links to `/` | `/` | — | No |
| `views/client/book-event.ejs` | Yes — "Back to dashboard" | `/client/dashboard` | `/client/dashboard` | No |
| Client event portal (`/client`, `/client/edit`, `/client/assets`, theme dashboard in client mode) | Yes — header title link to `/client` (the portal itself, per task's own instruction: use the existing selected-event portal route, not `/client/dashboard`) | `/client` | `/client` | No |
| `views/admin/login.ejs` | **No** | `/` | — | **Yes — fixed** |
| `views/admin/events-list.ejs` | N/A — is admin home | — | — | No |
| `views/admin/event-form.ejs` | Yes — "Back to events" | `/admin/events` | `/admin/events` | No |
| `views/admin/inquiries-list.ejs` | Yes — "Back to weddings" | `/admin/events` | `/admin/events` | No |
| `views/admin/inquiry-detail.ejs` | Yes — "Back to inquiries" | `/admin/inquiries` | `/admin/inquiries` | No |
| `views/admin/inquiry-approved.ejs` | Yes — "Back to inquiry" + "Back to all inquiries" | `/admin/inquiries` | `/admin/inquiries/:id` | No |
| `views/admin/clients-list.ejs` | Yes — "Back to weddings" | `/admin/events` | `/admin/events` | No |
| `views/admin/client-detail.ejs` | Yes — "Back to clients" | `/admin/clients` | `/admin/clients` | No |
| `views/admin/edit-event.ejs` | Yes — "Back to `<event>`" using server-verified `basePath` | admin/client event dashboard | same | No |
| `views/admin/assets.ejs` | Yes — header nav, title link to `basePath` | admin/client event dashboard | same | No |
| Theme dashboards, admin (non-client) mode | Yes — "All weddings"/"All events" link | `/admin/events` | — | No |
| Theme dashboards, admin-preview mode | Yes — "Return to Admin" using server-rendered `returnToAdminUrl` (`/admin/events/:id`, verified id from the controller) | — | `/admin/events/:id` | No |
| `views/scan/scanner.ejs` | **No** | `/` | — | **Yes — fixed** |
| `views/guest/error.ejs` | **No** | `/` | — | **Yes — fixed** |
| `views/guest/themes/*/invitation.ejs` (3 themes) | N/A — is the guest's own hub; links out to gallery/cameos/other-details | — | — | No |
| `views/guest/themes/*/gallery.ejs` (3 themes) | Yes — "Back to the invitation" → `/invite/:id` | — | `/invite/:id` | No |
| `views/guest/themes/*/cameos.ejs` (3 themes) | Yes — "Back to the invitation" → `/invite/:id` | — | `/invite/:id` | No |
| `views/guest/themes/*/other-details.ejs` (3 themes) | Yes — "Back to the invitation" → `/invite/:id` | — | `/invite/:id` | No |

Guest navigation never exposes an admin/client destination anywhere in the
audit — confirmed both by direct template inspection and by a live check
(rendered `/invite/1` and `/invite/1/other-details` contain no `/admin` or
`/client` link).

### Changes made

- **`views/admin/login.ejs`** — added `<p><a href="/">&larr; Back to
  homepage</a></p>` after the login form. The bare, unstyled page had no
  link anywhere.
- **`views/scan/scanner.ejs`** — added a `Home` link (`<a class="scanner-home"
  href="/">&larr; Home</a>`) below the manual-entry form, with minimal
  matching CSS. No check-in logic touched.
- **`views/guest/error.ejs`** — added a `Back to homepage` link (`/`) below
  the existing message, with a small CSS adjustment (`flex-direction:
  column; gap: 1rem;`) so the two lines stack correctly inside the existing
  centered flex layout.

All three use a plain `<a href="/">` — no browser-history reliance, no
unvalidated return-URL parameter, no JavaScript redirect.

## 4. Files changed

```
views/admin/themes/botanical-bloom/dashboard.ejs   — guest table columns
views/admin/themes/lavender-romance/dashboard.ejs  — guest table columns
views/admin/themes/lady-gianna/dashboard.ejs        — guest table columns
views/admin/login.ejs                                — added Home link
views/scan/scanner.ejs                               — added Home link
views/guest/error.ejs                                — added Home link
PROMPT-REPORT.md                                     — new, this file
```

No other file was modified. `db/schema.sql`, `db/migrate.js`, `config/*`,
`models/*`, `controllers/*`, `routes/*`, `middleware/*`, `utils/*`,
`server.js`, `package.json`/`package-lock.json` were not touched.

## 5. Local test evidence

`.env` confirmed pointed at `localhost:5433` before any write. Baseline
counts recorded before testing: `clients` 0, `booking_inquiries` 0, `events`
7, `client_access` 0, `guests` 11, `gallery_photos` 0, `cameo_photos` 0.

- Homepage and every changed template rendered `200` with no EJS error
  output.
- Guest table header confirmed as exactly `Name | Seats | Code | RSVP |
  Checked in` on live rendered HTML for all three themes (Botanical Bloom
  on an existing local event, Lady Gianna on an existing local event with a
  disposable test guest added, Lavender Romance on one disposable local
  test event with a disposable test guest, since no local Lavender Romance
  event previously existed).
- Confirmed "Invitation Type" does not appear anywhere in any of the three
  rendered guest tables (only remaining occurrence anywhere on those pages
  is the unrelated, unchanged Add-Guests instructional hint text).
- Confirmed the existing Copy Code/Copy code buttons still render (with
  their original `data-copy` values) in normal admin and real client-portal
  rendering, and correctly do **not** render in admin-preview mode (the
  existing `isPreview` guard, unmodified).
- Confirmed "Checked in" values render correctly (`Yes`/`No`) using the
  already-available `guest.checked_in` field, including on the two themes
  that previously had no such column.
- Confirmed the real client portal (via a disposable local token) renders
  the same standardized table with the copy button active, and its existing
  header-title Home link (`/client`) is untouched.
- Confirmed admin-preview mode still renders zero `<form>` elements and no
  actual copy-button element (only the pre-existing, inert `<script>`
  querySelector text matched a naive search — no rendered `<button
  class="copy-btn">` exists in that mode).
- Confirmed the three new navigation links (`admin/login.ejs`,
  `scan/scanner.ejs`, `guest/error.ejs`) all render and point to `/`, by
  directly fetching each page (the error page triggered via a nonexistent
  event id, `GET /invite/999999` → `404`, page still renders with the new
  link).
- Confirmed unauthenticated redirects are unchanged: `GET /admin/events`
  (no session) → `302 /admin/login`; `GET /client/dashboard` (no session)
  → `302 /client/login`.
- Confirmed guest navigation remains event-scoped and exposes no
  admin/client link (`GET /invite/1` and `GET /invite/1/other-details`
  checked directly).
- Confirmed admin events/inquiries/clients/edit/assets pages all still
  render `200` and their pre-existing navigation is unchanged.
- Confirmed all three theme dashboards render without error, in normal
  admin mode, real client mode, and admin-preview mode.
- Mobile CSS: no layout mechanism was changed on any page. The guest tables
  have one fewer column than before (Invitation Type removed), which can
  only reduce horizontal table width/overflow risk, not increase it; the
  existing `overflow: auto` table-wrapper divs (`.lr-table-wrap`,
  `.lg-table-wrap`, and Botanical Bloom's unwrapped table, all pre-existing)
  are unchanged. The scanner and error-page additions are single inline
  links with no fixed widths. No browser at a specific mobile viewport was
  used to visually confirm this — see Limitations.

### Cleanup

Disposable test records created during this phase: 1 test guest on an
existing Lady Gianna event, 1 disposable Lavender Romance event (with 1 test
guest and 1 manually-inserted `client_access` test-token row, removed via
the event's cascade delete). All deleted after testing. Final counts
confirmed to match the baseline exactly: `clients` 0, `booking_inquiries` 0,
`events` 7, `client_access` 0, `guests` 11, `gallery_photos` 0,
`cameo_photos` 0. No pre-existing business record was changed.

## 6. Plain Cards — audit only, no implementation

### `config/themes.js`

`AVAILABLE_THEMES` is a flat array of objects: `{ slug, label, eventType,
swatchColors, tagline, googleFonts }`. `eventType` scopes which event types
may offer the theme (`themesForEventType()` filters by it).
`DEFAULT_THEME_BY_EVENT_TYPE` maps `wedding` → `botanical-bloom`, `birthday`
→ `lady-gianna`. Every theme is fully self-contained — its own CSS file
under `public/themes/<slug>/theme.css`, its own guest invitation template
set under `views/guest/themes/<slug>/`, and its own admin/client dashboard
template under `views/admin/themes/<slug>/dashboard.ejs`.

### `config/eventTypes.js`

`EVENT_TYPES` is a flat array: `{ slug, label, titleLabel, dateLabel }`
(the last field added in the immediately prior release). A type only
appears in any selector once at least one theme in `AVAILABLE_THEMES`
declares that `eventType` — today only `wedding` and `birthday` are active;
the other seven slugs exist in the taxonomy and the database CHECK
constraint but have no theme yet, so they're inert everywhere in the UI.

### `config/accessModes.js`

`ACCESS_MODES` is a flat array of exactly three entries: `open`,
`recognized`, `closed`, each `{ slug, label }`. `DEFAULT_ACCESS_MODE =
'closed'`. This governs guest-list/passcode/RSVP/QR gating behavior
(`guest.controller.js`), not theme selection — orthogonal to Plain Cards.

### Theme selection and storage in the booking → event lifecycle

A client chooses a theme (optional) on the booking form
(`views/client/book-event.ejs`, `<select name="preferredTheme">`), scoped
client-side/server-side to `themesForEventType(eventType)`. It's stored as
`booking_inquiries.preferred_theme` (nullable, no CHECK — themes can be
added later without a migration, per the column's own existing design). At
approval, `models/inquiry.model.js#approve()` resolves the final theme: the
client's preference if it actually belongs to the event's type, otherwise
`DEFAULT_THEME_BY_EVENT_TYPE[eventType]` — never a cross-type theme. The
resolved value is written to `events.theme` (`NOT NULL`, no CHECK). From
that point, `events.theme` is the single value every downstream template
selection keys off.

### Guest invitation view selection

`controllers/guest.controller.js#renderInvitation`:
```js
const view = `guest/themes/${event.theme}/invitation`;
```
A direct, unvalidated string interpolation of `events.theme` into the EJS
template path. Safe today only because `events.theme` can never hold an
arbitrary string — every write path (`admin.controller.js`'s
`resolveTheme()`, and `inquiry.model.js#approve()`'s equivalent inline
logic) validates the value against the `AVAILABLE_THEMES` registry before
it's ever persisted. A **new** theme therefore requires, at minimum, a
matching `views/guest/themes/<slug>/` directory to exist before any event
can be given that theme — there is no generic/fallback guest template.

### Does invitation copy currently support arbitrary client-authored text?

Yes, already, independent of theme. `events` already carries several free-text
fields editable by admin (and, for the non-admin-only ones, by the client
through their own portal): `invitation_message`, `itinerary`,
`contact_details`, `footer_note`, `subtitle`, `decline_message`,
`accept_button_text`, `decline_button_text`. Every guest invitation template
across all three themes already renders these fields when present, with a
generic fallback line when empty (e.g. "The schedule for the day will be
shared here soon."). No theme currently accepts genuinely open-ended
free-form "card text" beyond these named fields — there's no single
"write your own invitation" textarea; it's several purpose-labeled fields
composed into the template's fixed layout.

### Smallest likely future scope for an Open Event "Plain Card" theme

**Presentation-only work** (no data/model/schema change needed):
- A new `views/guest/themes/plain-card/invitation.ejs` (+ optionally
  `gallery.ejs`/`cameos.ejs`/`other-details.ejs`, or these could
  legitimately reuse another theme's if the product wants Plain Card to
  differ only in the hero/invitation layout) and a new
  `public/themes/plain-card/theme.css`.
- A new `views/admin/themes/plain-card/dashboard.ejs` admin/client
  dashboard template, following the existing per-theme dashboard pattern.
- A new entry in `config/themes.js`'s `AVAILABLE_THEMES` array
  (`slug: 'plain-card'`), with an `eventType` — likely a new, more
  general-purpose type such as `other`, or scoped to whichever type(s)
  the product wants "plain" for.
- All of the above is exactly the same shape of work as adding the existing
  three themes already was — no new architectural pattern required.

**Data/model/schema needs, if any**: none apparent from current
inspection, *provided* the product accepts using the existing free-text
fields (`invitation_message`, `itinerary`, `contact_details`, `subtitle`,
etc.) as Plain Card's content surface, the same way every existing theme
already does. If the product instead wants a genuinely open-ended
"client writes their own full card text" experience distinct from the
current field-by-field model, that would need a new schema column and is
explicitly **not** scoped here — flagged as a product decision below.

**Product decisions still required** (none of these were decided or
implied by this audit):
- Which `event_type`(s) Plain Card should be offered for — a new
  general-purpose type, or an existing one (`other`, `wedding`, etc.)?
- Whether "Open Event" in the phase name means Plain Card is gated to
  `access_mode = 'open'` events specifically, or is theme-independent of
  access mode (today, theme and access mode are two fully independent
  fields on `events` with no relationship between them).
- Whether Plain Card reuses the existing per-theme dashboard pattern
  (a full bespoke `lg-admin-*`/`lr-*`/`bb-*`-style dashboard) or is meant
  to be visually minimal on the *admin/client* side too, not just the
  guest-facing card.
- Whether the existing named free-text fields are sufficient "plain card"
  content, or a genuinely freeform authoring surface is wanted.

No Plain Cards route, view, CSS file, config entry, event type, database
field, or client-editing form was added. This section is audit and
recommendation only.

## 7. Confirmations

- No schema, migration, package, backend, session, or authorization change
  was made.
- No production write occurred at any point in this phase.
- No Plain Cards implementation occurred.
- No secret, password, hash, raw token, cookie/session ID, environment
  value, or database URL was printed or exposed at any point.

## 8. Limitations / not visually browser-tested

- No browser-rendering or screenshot tool was available in this session.
  All verification was performed via direct HTTP requests against the
  local server and inspection of the returned HTML (header/column order,
  presence/absence of specific text, presence of specific classes and
  attributes) — not a visual/pixel render at any viewport width.
- Mobile layout was reasoned about (column count reduced, no layout
  mechanism changed, existing overflow wrappers untouched) rather than
  visually confirmed at 320–768px.
- The Lavender Romance guest table's live local test used one disposable
  event created for this purpose, since no Lavender Romance event already
  existed in the local database; Botanical Bloom and Lady Gianna used
  pre-existing local events.

# Phase: Plain Card Theme — Full Implementation and Release

Commit: `feat(theme): add plain card event experience`
Base commit: `7f5f81e feat(ui): standardize guest tables and add contextual navigation`

Product decisions (from the prior audit) approved by the project owner before
this phase began: Plain Card is a **universal** theme available for **every**
existing event type, and all seven previously-inactive event types
(`bridal-shower`, `baby-shower`, `engagement`, `anniversary`, `graduation`,
`corporate`, `other`) become active/selectable as a direct result.

## 1. Scope

New theme only. No schema, migration, route, controller, model, middleware,
session, or access-mode-logic change. The one edit outside brand-new Plain
Card files is additive registration data in `config/themes.js` (described
below) — no existing theme's entry, no function signature, and no other
config file was touched.

## 2. Theme registration

`config/themes.js`'s `AVAILABLE_THEMES` gained nine new entries, one per
existing `config/eventTypes.js` slug (`wedding`, `birthday`, `bridal-shower`,
`baby-shower`, `engagement`, `anniversary`, `graduation`, `corporate`,
`other`), each `{ slug: 'plain-card', label: 'Plain Card', eventType: <type>,
swatchColors, tagline, googleFonts }` — identical across all nine except
`eventType`. This is safe under the existing registry architecture: every
consumer either filters via `themesForEventType()`/`.filter()` (naturally
partitions by type) or does a global `.find(slug)` (exactly two call sites —
`admin.controller.js`'s and `clientAccount.controller.js`'s `themeLabel()`
helpers — both reading only `.label`, identical across every duplicate).
Verified live: `GET /admin/events/new` now lists all nine event types and
shows "Plain Card" as a theme option under each.

**Required accompanying fix**: `DEFAULT_THEME_BY_EVENT_TYPE` previously only
mapped `wedding`/`birthday`. Registering Plain Card made the other seven
types selectable in the UI for the first time, and both
`admin.controller.js#resolveTheme()` and `models/inquiry.model.js#approve()`
fall back to `DEFAULT_THEME_BY_EVENT_TYPE[type]` whenever no valid theme is
submitted, writing directly into the `NOT NULL` `events.theme` column. Left
unfixed, approving or manually creating an event of one of those seven types
without an explicit theme choice would have thrown a Postgres NOT NULL
violation. Fixed by adding all seven missing keys, each mapping to
`'plain-card'` — an additive entry in the same map, in the same file already
in scope, not a new function or a logic change.

## 3. Files created

```
public/themes/plain-card/theme.css                    — new
public/themes/plain-card/invitation-background.png    — new (copied from plain-card-approved/)
public/themes/plain-card/portal-background.png        — new (copied from plain-card-approved/)
views/guest/themes/plain-card/invitation.ejs           — new
views/guest/themes/plain-card/gallery.ejs              — new
views/guest/themes/plain-card/cameos.ejs               — new
views/guest/themes/plain-card/other-details.ejs        — new
views/admin/themes/plain-card/dashboard.ejs            — new
```

## 4. Files edited

```
.gitignore          — added `plain-card-approved/` (reference package excluded from version control)
config/themes.js    — 9 new AVAILABLE_THEMES entries + 7 new DEFAULT_THEME_BY_EVENT_TYPE keys
PROMPT-REPORT.md    — this section
```

No other file was touched. `db/schema.sql`, `db/migrate.js`, every
`controllers/*`, `routes/*`, `models/*`, `middleware/*`, `utils/*`,
`server.js`, `package.json`/`package-lock.json`, `config/accessModes.js`, and
every file under the three existing themes (Botanical Bloom, Lavender
Romance, Lady Gianna) were not modified.

## 5. Prototype-to-production mapping

Source: `plain-card-approved/` (invitation.html, portal.html, styles.css, two
background PNGs) — the approved visual reference package, never itself
modified, moved, or made a runtime dependency; it stays git-ignored and
untracked.

- **Visual tokens** (`--ink`, `--paper`, `--gold`, `--gold-soft`, `--muted`,
  `--white`, `--cut`, the 4-corner invitation chamfer, the 2-corner
  portal-shell chamfer, both breakpoints at `900px`/`680px`) copied verbatim
  into `public/themes/plain-card/theme.css`.
- **Invitation background**: the prototype's static image became
  `event.card_image || '/themes/plain-card/invitation-background.png'`,
  rendered via three stacked, non-conflicting layers (`.background-fallback`
  gradient, `.background-image` conditional URL, `.background-overlay`
  readability gradient) — reusing the same unconditional, pre-passcode-gate
  `event.card_image` exposure pattern already established by all three
  existing themes (verified in `botanical-bloom/invitation.ejs`).
- **Portal background**: intentionally **not** event-derived — hardcoded as
  `url("portal-background.png")` (relative to the served CSS path,
  `/themes/plain-card/portal-background.png`) directly in `.portal-background`,
  since the admin/client portal chrome is not guest-facing invitation content.
- **Fake elements removed/replaced**: the prototype's non-functional
  `#gatepass-toggle` JS button is suppressed (`.gatepass-toggle { display:
  none; }`) and replaced with real POST forms to the existing
  `/invite/:id/rsvp` route; the hardcoded placeholder QR/`GUEST CODE`
  strings are replaced with the real `qrDataUrl`/`guest.passcode` values
  used by every existing theme; every prototype `href="#"` link is replaced
  with a real internal route; the prototype's five palette-swatch buttons
  and "Change" background-picker link (no backing data model exists) were
  deliberately **omitted entirely** rather than implemented as dead UI.
- **Guest secondary pages** (gallery/cameos/other-details): no prototype
  reference existed for these. Built by extending Plain Card's own
  ivory/gold/serif token language into a new, simple `.pc-secondary-page`
  treatment, mirroring the same relationship every existing theme already
  has between its invitation and its own secondary pages.
- **Long-content safety**: `h1`, `.invitation-message`, `.portal-title`, and
  mini-card heading `clamp()` minimums were lowered and `line-height`
  raised from the prototype's originals so long couple names/messages wrap
  rather than clip; `.event-details`, `.card-footer`, `.portal-topbar`,
  `.portal-nav`, and `.portal-invites-heading` were all given `flex-wrap:
  wrap`.

## 6. Access-mode behavior — implementation evidence

All three modes verified live against real local test events, not just read
from code:

- **Open** (`access_mode = 'open'`): `GET /invite/:id` bypasses the passcode
  overlay entirely and renders the invitation directly (`YOU ARE INVITED`
  present, `Enter your passcode` absent). No RSVP form (`name="response"`),
  no gatepass/QR markup, and no guest-management section at all on the
  dashboard (`event.access_mode !== 'open'` wraps the entire section) —
  confirmed by a zero match count for `portal-invites-section` on a live
  open-mode dashboard render.
- **Recognized** (`access_mode = 'recognized'`): passcode-gated
  (`Enter your passcode` present pre-verification); after verifying and
  submitting a real RSVP accept, the invitation correctly transitions to the
  `state === 'confirmed'` view ("You're confirmed"); no gatepass/QR section
  ever renders (`qr-frame` absent). Dashboard guest table renders exactly
  `Name | Seats | Code | RSVP` (no "Checked in" column).
- **Closed** (`access_mode = 'closed'`): passcode-gated; after RSVP accept,
  a real gatepass row is created and the invitation renders a genuine
  `<img src="data:image/...">` QR code (not a placeholder). Posting that
  gatepass's real `qr_token` to the existing `/scan/verify` endpoint
  returned `{"result":"checked_in", ...}`; re-fetching the guest's
  invitation afterward correctly showed the "already checked in" message.
  Dashboard guest table renders exactly `Name | Seats | Code | RSVP |
  Checked in`, and the checked-in guest's row correctly showed `Yes`.

## 7. Role/capability and preview evidence

- **Admin (normal)**: dashboard for a live Plain Card event rendered `200`;
  Add-Guests form, Download Excel link, and the Danger Zone (status-toggle
  and delete forms, with the same `confirm()` dialog text pattern as the
  existing themes) all present.
- **Client (portal, non-preview)**: nav includes Assets, Other Details, My
  Events, and a real `POST /client/logout` form; Publish form shown for a
  draft event.
- **Admin-preview**: fetched `GET /admin/events/:id/client-preview` for a
  Plain Card event — confirmed **zero** `<form>` elements anywhere on the
  page and **zero** Copy-code buttons, alongside the expected read-only
  `Admin preview` banner and `Return to Admin` link. Matches the existing
  `isPreview` conditional pattern used by all three prior themes.
- **Booking → approval fallback**: registered a test client, submitted a
  booking inquiry for `eventType: 'anniversary'` (a formerly-inactive type)
  with no preferred theme, then approved it as admin — the resulting event
  received `theme: 'plain-card'` via the `DEFAULT_THEME_BY_EVENT_TYPE`
  fallback, with no database error. Also directly created events via the
  admin form for `engagement` (no theme submitted → fallback), `wedding`
  (theme explicitly set to `plain-card`), and `corporate` (no theme
  submitted, `access_mode: open`) — all three succeeded.

## 8. Local test evidence

`.env` confirmed pointed at `localhost:5433` before any write. Baseline
counts recorded before testing: `clients` 0, `booking_inquiries` 0, `events`
7, `client_access` 0, `guests` 11, `gallery_photos` 0, `cameo_photos` 0.

- Every Plain Card guest page (invitation, gallery, cameos, other-details)
  rendered `200` with no EJS error, across open/recognized/closed test
  events, both before and after passcode verification.
- Existing themes re-checked for regression: `GET /themes/{botanical-bloom,
  lavender-romance,lady-gianna}/theme.css` all `200`; an existing live
  Botanical Bloom event's dashboard and invitation both still rendered
  `200`.
- `GET /admin/events/new` confirmed all nine event types and a
  correctly-labeled "Plain Card" option for each.

### Cleanup

Disposable test records created: three admin-created test events (`engagement`,
`wedding`, `corporate`, covering all three access modes plus both fallback
and explicit theme selection), one guest added to each of the recognized and
closed test events (one carried through a full verify → RSVP-accept →
gatepass/QR → scanner-check-in cycle), one test client account, and one
booking inquiry approved into a fourth test event. All events deleted via
the existing admin delete route (cascading their guests/gatepasses); the
disposable client and booking-inquiry rows — for which no admin delete route
exists — were removed directly via SQL, consistent with prior-phase cleanup
practice for records with no UI delete path. Final counts confirmed to match
the baseline exactly: `clients` 0, `booking_inquiries` 0, `events` 7,
`client_access` 0, `guests` 11, `gallery_photos` 0, `cameo_photos` 0. No
pre-existing business record was changed.

## 9. Responsive design — evidence and limitation

No browser-rendering or screenshot tool was available in this session (only
`DesignSync`/`WebFetch` were reachable via tool search, and neither can
render or screenshot `localhost`). All responsive claims are therefore
structural, not visual:

- Every breakpoint present in the approved prototype's `styles.css`
  (`900px` portal-workspace collapse with `.portal-preview-panel { order:
  -1; }`, `680px` fine-grained mobile rules) was preserved verbatim in
  `theme.css`.
- Long-content wrapping (`overflow-wrap: break-word`, lowered `clamp()`
  minimums, raised `line-height`) was added to every heading/body text
  element identified as fixed-height-risk during the audit.
- Flex-wrap was added to every horizontal row-layout element identified in
  the audit as a potential narrow-viewport overflow risk.
- No pixel-level visual confirmation at 320/375/414/768/900/1024/1280/1440px
  was performed — this limitation is disclosed honestly rather than implied
  otherwise.

## 10. Confirmations

- No schema, migration, package, route, controller, model, middleware,
  session, security, access-mode, RSVP, gatepass, QR, scanner, or
  upload-flow change was made. The only backend-adjacent edit is the
  additive `DEFAULT_THEME_BY_EVENT_TYPE` registration data described in
  Section 2, inside the already-in-scope `config/themes.js`.
- No production write occurred at any point in this phase; no production
  migration was run (none is needed — no schema change was made).
- `plain-card-approved/` was never modified, moved, staged, or committed,
  and never became a runtime dependency — confirmed ignored via `git
  status --short` before and after this phase's changes.
- No secret, password, hash, raw token, cookie/session ID, environment
  value, or database URL was printed or exposed at any point.
- Admin-preview mode confirmed strictly read-only for Plain Card, matching
  the existing three-theme pattern.
