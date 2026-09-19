# Chief Inspector Report

## Current phase
Input 20 — Phase 4: Admin CSS separation.

## Status
Implemented; server-side verification completed (structural/static checks,
read-only live checks, and an authenticated local pass against the local
development database — login, page loads, correct per-theme asset linking,
no server errors). **Manual browser-rendering verification is explicitly
deferred, by instruction — not attempted, not skipped due to a blocker.**
**Not committed, not pushed — no schema change, no migration needed.**
Phases 1–3 (below) remain deployed and verified; Phase 4 stays local-only
pending both explicit approval to commit/push and, before that, the deferred
manual visual check. See Known limitations for the three points that must
stay explicit until that check happens.

## Commits
- `1aac3b2` — "Prepare event types for active-theme visibility" (Phase 1, the
  five implementation files)
- `a2fcfdb` — "Add PROMPT_REPORT.md — permanent Chief Inspector handover file"
  (superseded by later revisions of this report)
- `709501c` — "Prepare event types for active-theme visibility" (Phase 1,
  added `input_20.md` to the repo)
- `ef41a75` — "Add Phase 1 deployment handover report" (Phase 1, an earlier
  revision of this report)
- `9ed3add` — "Allow draft events without a date" (Phase 2, the nine
  implementation and documentation files)
- `3f4c7a4` — "Add Phase 2 deployment handover report" (Phase 2, an earlier
  revision of this report)
- `8811d46` — "Add theme gallery swatch metadata" (Phase 3, the three
  implementation and documentation files)
- `6da18d9` / `fa455fa` — "Add Phase 3 deployment handover report" and its
  own commit-hash follow-up (Phase 3, this report's earlier revisions)
- No commit yet for Phase 4 — all Phase 4 work below is uncommitted
  working-tree changes.

## Files changed (Phase 4, uncommitted)
- `public/assets/css/admin-shared.css` (new) — structural/layout-only CSS
  extracted from the three themes' duplicated `.bb-admin*` blocks. No color,
  font, or background value defined here.
- `public/themes/botanical-bloom/theme.css`, `lavender-romance/theme.css`,
  `lady-gianna/theme.css` — each theme's `.bb-admin*` block trimmed to
  colors/fonts/backgrounds/borders/shadows only. Lavender Romance and Lady
  Gianna each gained one new alias variable,
  `--bb-admin-radius: var(--bb-radius|--lg-radius)`, so admin-shared.css can
  reference one consistent name — same value as before, not a new design
  choice. No guest-facing or bespoke-dashboard (`.lr-*`, `.lg-admin-*`) rule
  touched.
- `public/assets/js/theme-filter.js` (new) — the event-type/theme filter and
  title-label script, previously duplicated in two view files.
- `views/admin/edit-event.ejs`, `views/admin/assets.ejs` — load
  `admin-shared.css` then the selected theme's `theme.css`; load only that
  theme's own Google Fonts instead of a hardcoded union.
- `views/admin/event-form.ejs` — `#coupleNamesLabel` now wraps a `<span>`
  (visually/functionally identical) so the shared script needs no DOM-shape
  branching between Create and Edit forms.
- `config/themes.js` — added a `googleFonts` field per theme (the one file
  touched outside the task's literal file list, explicitly permitted by its
  own instructions' text for exactly this addition). Purely additive.
- `input_20.md` — Phase 4 implementation record, including the full
  extraction-category breakdown and the `require()`-in-EJS test that ruled
  out a cleaner alternative for `assets.ejs`'s font lookup.
- `PROMPT_REPORT.md` — this update.

No route, controller, model, schema, or `package.json` change.

## Files changed (Phase 3, committed in `8811d46`)
- `config/themes.js` — the only code file touched. Each of the three existing
  `AVAILABLE_THEMES` entries (`botanical-bloom`, `lavender-romance`,
  `lady-gianna`) gained two new optional fields: `swatchColors` (4 hex colors
  each, hand-picked from that theme's own `theme.css` custom properties — no
  parser, no build step) and `tagline` (one short customer-facing sentence
  per theme). Purely additive — no slug, `label`, `eventType`,
  `DEFAULT_THEME`, `DEFAULT_THEME_BY_EVENT_TYPE`, or `themesForEventType()`
  changed, and no new theme was added.
- `input_20.md` — Phase 3 implementation record appended.
- `PROMPT_REPORT.md` — this update.

## Files changed (Phase 2, committed in `9ed3add`)
- `db/schema.sql` — `wedding_date` made nullable on `events` and
  `event_archive` (idempotent `ALTER COLUMN ... DROP NOT NULL`); new
  `events_live_requires_date` CHECK constraint
  (`status <> 'live' OR wedding_date IS NOT NULL`), same
  `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` idempotent pattern as Phase 1.
- `models/event.model.js` — `update()`'s `wedding_date` assignment changed to
  `COALESCE(NULLIF($2, '')::date, wedding_date)` (the `::date` cast was a
  real bug fix — see Tests below).
- `controllers/admin.controller.js` — `daysUntil()` null-safe (returns `null`,
  not `NaN`); `showDashboard` surfaces a `?error=needs_date` message;
  `updateEvent` no longer requires `weddingDate` (unlike `createEvent`, which
  still does); `toggleStatus` blocks draft→live for a dateless event.
- `views/admin/edit-event.ejs` — date input: `required` removed, `|| ''`
  value guard added.
- `views/admin/themes/botanical-bloom/dashboard.ejs` — same input fix; error
  message added near the status-toggle button.
- `views/admin/themes/lavender-romance/dashboard.ejs` — "Days to go" and the
  date pill both show TBD/"Date TBD" when dateless; error message added near
  the status-toggle button.
- `views/admin/themes/lady-gianna/dashboard.ejs` — "Days to go" TBD handling;
  both the hidden and visible `weddingDate` inputs get the `|| ''` guard
  (the hidden one was the highest-risk spot — see Tests below); error message
  added near the status-toggle button.
- `input_20.md` — Phase 2 implementation record appended.
- `PROMPT_REPORT.md` — this update.

Confirmed unchanged (verified, not assumed): `utils/eventLifecycle.js`,
`models/archive.model.js`, `views/admin/event-form.ejs`.

## Migration (Phase 4)
None required, none run. This phase touches only CSS/JS/EJS/config-data
files — no schema change, no `npm run db:migrate`.

## Tests (Phase 4)
Full detail in `input_20.md`'s Phase 4 implementation record. Summary:
- `node --check` on both changed/added JS files, `ejs.compile()` on all
  three changed EJS files, brace-balance check on all four CSS files — all
  pass.
- Structural dedup confirmed via `grep`: the shared `.bb-admin*` rules no
  longer appear duplicated in any theme.css; every remaining match is
  Lady Gianna's own bespoke `.lg-admin*` dashboard or a guest-facing
  `body.*-page` rule, both correctly untouched.
- `--bb-admin-radius` alias present in all three themes, each value proven
  identical to that theme's prior computed radius by construction (not
  just by testing).
- A real constraint was discovered and tested, not assumed:
  `require()` inside a compiled EJS template does **not** resolve relative
  to the view file's own path (confirmed by reproducing the exact failure
  with `node -e`), which is why `assets.ejs` uses a small inline font table
  instead of reading `config/themes.js` the way `edit-event.ejs` does — see
  "Known limitations" below.
- Live local server (read-only only, per this round's explicit correction:
  `.env` stayed pointed at the production database, on the basis that
  every check below is a `GET` request with no writes, no migration, no
  admin-login attempt): `GET /admin/login` → `200`; `GET
  /assets/css/admin-shared.css` → `200`; `GET /assets/js/theme-filter.js`
  → `200`; `GET /themes/<slug>/theme.css` → `200` for all three themes;
  `GET /invite/:id` → `200` for all 5 existing production events (ids 1, 2,
  4, 8, 10) — these load the same trimmed `theme.css` files the admin pages
  do, so this also rules out a CSS syntax break. No errors in the server
  log for any of this.

## Migration (Phase 3)
None required, none run. This phase adds no schema change — `config/themes.js`
is plain JS data, not database state. No `npm run db:migrate` was executed
against production for this deployment.

## Tests (Phase 3)
All 6 required checks run locally, using the same production-database-backed
local server as the just-completed Phase 2 deployment (`.env` was still
pointed at production from that work; confirmed with the person before
proceeding, since every check here is read-only — `GET` requests only, no
writes to any event):
- `require('./config/themes')` loads without error; all four original
  exports (`AVAILABLE_THEMES`, `DEFAULT_THEME`, `DEFAULT_THEME_BY_EVENT_TYPE`,
  `themesForEventType`) still present.
- All three themes have a non-empty `tagline` — confirmed programmatically.
- All 12 `swatchColors` hex values (4 per theme × 3 themes) are valid hex —
  confirmed programmatically.
- `git diff config/themes.js` confirmed the change is purely additive — every
  previously-existing line (slugs, labels, event types, `DEFAULT_THEME`,
  `DEFAULT_THEME_BY_EVENT_TYPE`) is untouched; `themesForEventType('wedding')`
  / `themesForEventType('birthday')` re-run and return the same slugs as
  before.
- Local app started; all 5 existing production events' invitation pages
  (`/invite/1`, `/2`, `/4`, `/8`, `/10`) and `/admin/login` returned `200`
  with no server errors.
- Authenticated admin pages (Create/Edit forms, where `AVAILABLE_THEMES` is
  actually iterated) could not be exercised this way — local dev admin
  credentials don't match production's, and the session store for a
  production-DB-backed server is production's own sessions table. Same
  "no production admin credentials" gap as Phase 1/2, not new. The
  programmatic checks above are sufficient to be confident this renders
  correctly, since nothing about how the array is iterated changed.

## Migration (Phase 2)
- **Local**: applied via `npm run db:migrate` → `Schema applied.` Verified via
  `information_schema.columns` (both `wedding_date` columns now nullable) and
  `pg_constraint` (`events_live_requires_date` present with the expected
  definition).
- **Production (Neon)**: applied via `npm run db:migrate` against the
  production `DATABASE_URL` → `Schema applied.` Connection string never
  printed, saved, or committed at any point — the hostname was checked once
  (via `new URL(...).hostname`, no credentials) purely to confirm the target
  was actually Neon and not the local dev database before running anything
  against it.

## Tests (Phase 2)
All 14 required checks run locally using only disposable test events (ids 39,
40, 41 — created directly via `eventModel.create()`, one per theme, since
`createEvent`'s form still requires a date as intended; all deleted after
verification). No existing local or production event was used as a mutation
target — only read-only `GET` checks against two pre-existing events (id 2,
id 19) to confirm no regression. Full detail in `input_20.md`'s "Phase 2
implementation record"; highlights:
- Dateless draft created, NULL persists, all three theme dashboards render it
  with no `NaN` and no literal `"null"` string anywhere.
- **Bug found and fixed**: a partial-form save on a dateless draft initially
  failed with `COALESCE types text and date cannot be matched` — fixed with
  an explicit `::date` cast; retested and confirmed working, no corruption.
- Publish blocked for a dateless draft (app-level); direct SQL status flip
  also rejected by the `events_live_requires_date` CHECK (DB-level backstop
  confirmed independently of the app).
- Adding a real date then publishing succeeds normally.
- Deleting a dateless draft succeeds via the normal archive-and-delete flow
  (confirms the `event_archive` nullable-column fix, not just `events`).
- Lifecycle sweep actually run against a live dateless draft — confirmed it
  is correctly ignored, with real evidence rather than re-citing prior
  analysis.
- Manual Create still refuses a missing date, unchanged.
- Existing Wedding (id 2) and Birthday (id 19) events re-verified read-only
  across dashboard/edit/invitation — unaffected.

## Production verification (Phase 4)
Not applicable — Phase 4 has not been deployed, and makes no schema or
server-logic change for production to exercise.

## Production verification (Phase 3)
Read-only checks only, per this deployment's explicit scope — no POST, PUT,
PATCH, or DELETE requests were made, and no production data was created,
edited, uploaded, deleted, or otherwise modified:
- `GET /admin/login` → `200`.
- `GET /invite/1` → `200`.
- `GET /invite/10` → `200`.

All three passed on the first check after waiting for Render's rollout to
finish (learned from Phase 2: the first request right after a push can 500
while Render is still mid-deploy, so this round polled `/admin/login` until
it returned `200` before checking the other two). No migration was run
against production for this deployment — confirmed above.

## Production verification (Phase 2)
- **Schema** (queried directly against production, read-only): `events.wedding_date`
  and `event_archive.wedding_date` both `is_nullable = YES`;
  `events_live_requires_date` present with definition
  `CHECK (((status <> 'live'::text) OR (wedding_date IS NOT NULL)))`.
- **Existing data untouched**: all 5 production events (`id` 1, 2, 4, 8 —
  lavender-romance; `id` 10 — lady-gianna) queried directly after the
  migration — every `wedding_date` and `status` value is unchanged from
  before this deployment.
- `GET /admin/login` → `200`.
- `GET /invite/:id` → `200` for all 5 existing production events (ids 1, 2,
  4, 8, 10), confirming both themes currently in production use
  (lavender-romance, lady-gianna) render correctly. A first check immediately
  after the push returned `500` on every invitation page — this was Render
  still mid-rollout, not a real fault: a same-code, same-production-database
  local reproduction returned `200` throughout, and polling production
  itself resolved to `200` within the following few minutes without any
  further changes. No live production event currently uses Botanical Bloom
  (unchanged from Phase 1), so that theme has no live page to check directly;
  its code path is identical to the other two themes' and was fully verified
  locally in Phase 2 testing.
- **Not verified on production** (no admin credentials available this
  session): a dateless-draft dashboard showing `TBD`, an attempted publish of
  a dateless draft being blocked, and a successful publish after a date is
  set. All three are verified locally against the identical deployed code
  (see `input_20.md`'s Phase 2 implementation record); production behavior is
  inferred, not directly observed, for these three items.

## Known limitations
- **No browser console or pixel-level visual verification was performed.**
  A local authenticated pass did confirm (server-side, via HTML inspection):
  Botanical Bloom's and Lady Gianna's Dashboard/Edit/Assets pages all return
  `200`, each loads only its own theme's Google Fonts, `admin-shared.css`
  loads before `theme.css`, all linked assets resolve, and the DOM elements
  `theme-filter.js` depends on are present. None of that substitutes for
  actually looking at a rendered page or an open browser console — no
  screenshot exists, and no one has confirmed the pages still *look* right.
  This was explicitly deferred this round, not attempted and failed.
- **Lavender Romance has no local event and was not visually verified.**
  No local database event uses this theme, so its Dashboard/Edit/Assets
  pages were never loaded, authenticated or otherwise, this round. A local
  event for this theme would need to exist before any visual check of it is
  possible.
- **No data was created or modified for testing.** Every check this round
  was read-only `GET` navigation against existing events (Botanical Bloom
  id 2, Lady Gianna id 19); nothing was inserted, updated, or deleted.
- `assets.ejs` duplicates its per-theme Google Fonts URLs in a small inline
  table rather than reading `config/themes.js` the way `edit-event.ejs`
  does, because `showAssets()` doesn't pass theme data to that view and the
  controller couldn't be changed this phase. Fixable cleanly in a future
  phase that's allowed to touch `controllers/admin.controller.js`.
- No production admin credentials available this session (recurring, since
  Phase 1).
- `swatchColors`/`tagline` are not read by any code yet — unchanged from
  Phase 3, still waiting on a homepage gallery from a later phase.
- Phase 1/2 known limitations still apply, unchanged: `updateEvent`'s generic
  error message; 7 of 9 event types still themeless by design; no live
  production event currently uses Botanical Bloom; local dev event `id 1`
  ("Amani na Zawadi") still carries an earlier test-induced `venue` change.

## Local-environment note
`.env`'s `DATABASE_URL` now points at the local dev Postgres instance
(`localhost:5433`) again — switched back for this round's authenticated
local verification pass (login, page loads for Botanical Bloom id 2 and
Lady Gianna id 19), read-only throughout. Earlier in Phase 4 it had briefly
been left pointed at production for a strictly read-only static-asset/
invitation-page check; that is no longer the case as of this update.

## Next recommended task
Input 20 — Phase 5: Public homepage and booking inquiries.
