# Chief Inspector Report

## Current phase
Input 20 — Phase 2: Nullable event date support.

## Status
Deployed and verified — all checks possible without production admin
credentials pass. Admin-only checks (dateless-draft dashboard TBD display,
publish-block, publish-after-date) verified locally only, not directly on
production. See "Known limitations."

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
- This report's own commit hash is reported separately after it's made (a file
  cannot know its own future commit hash while being written).

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

## Migration
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

## Tests
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

## Production verification
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
- Phase 1's known limitations (no production admin credentials this session;
  `updateEvent`'s generic error message; 7 of 9 event types still themeless by
  design) still apply, unchanged.
- The local server had to be restarted mid-Phase-2-testing because a stale
  background process was still holding port 3000, briefly making retests
  appear to hit the pre-fix code. Local tooling issue only, not a repo
  concern — noted in `input_20.md` so it isn't mistaken for a real result.
- Same as Phase 1: local dev event `id 1` ("Amani na Zawadi") still carries
  its earlier test-induced `venue` change; not touched further this phase.
- No live production event currently uses Botanical Bloom, so this deployment
  did not directly exercise that theme's rendering on production itself
  (same gap noted in Phase 1's report).

## Next recommended task
Input 20 — Phase 3: Theme registry swatch metadata.
