# Chief Inspector Report

## Current phase
Input 20 — Phase 3: Theme registry swatch metadata.

## Status
Deployed and verified — all three required production checks pass. This
phase has no admin-only or authenticated behavior to verify (it adds no new
UI, no new route, no schema change), so there is no "not verified on
production" gap for Phase 3 itself.

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
- `[pending]` — "Add Phase 3 deployment handover report" (this report; hash
  recorded in a follow-up small update once this commit is made — a file
  cannot know its own future commit hash while being written).

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
- No production admin credentials available this session (recurring, since
  Phase 1) — Phase 3's `AVAILABLE_THEMES` consumers in the admin Create/Edit
  dropdowns could only be validated structurally, not by loading an
  authenticated production-backed page. See Tests (Phase 3) above.
- `swatchColors`/`tagline` are not read by any code yet — they're data for a
  homepage gallery that doesn't exist until a later phase, so there is no
  rendering path for the new fields themselves to have failed on even if the
  admin-dropdown check above had been possible.
- Phase 1/2 known limitations still apply, unchanged: `updateEvent`'s generic
  error message; 7 of 9 event types still themeless by design; no live
  production event currently uses Botanical Bloom; local dev event `id 1`
  ("Amani na Zawadi") still carries an earlier test-induced `venue` change.

## Local-environment note
`.env`'s `DATABASE_URL` currently points at the production Neon database —
set there for Phase 2's production migration and left in place through
Phase 3's read-only verification, with the person's explicit confirmation
each time it mattered. **Before any future local implementation or testing
work that writes data** (creating/editing/deleting test events, running
`npm run db:migrate` locally, anything beyond a read-only `GET`), restore
`DATABASE_URL` to the local dev Postgres instance (`localhost:5433`) first —
unless that specific task explicitly calls for production read-only
verification again. This file is gitignored and edited directly by the
person; this note exists only so the next phase doesn't assume `.env` is
already pointed at local dev.

## Next recommended task
Input 20 — Phase 4: Admin CSS separation.
