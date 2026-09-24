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
