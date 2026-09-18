# Chief Inspector Report

## Current phase
Input 20 — Phase 2: Nullable event date support.

## Status
Implemented and fully tested locally. **Not committed, not pushed, no
production migration run.** Phase 1 (below) remains deployed and verified;
Phase 2 is local-only pending explicit approval to commit/push/migrate/deploy.

## Commits
- `1aac3b2` — "Prepare event types for active-theme visibility" (Phase 1, the
  five implementation files)
- `a2fcfdb` — "Add PROMPT_REPORT.md — permanent Chief Inspector handover file"
  (superseded by later revisions of this report)
- `709501c` — "Prepare event types for active-theme visibility" (Phase 1,
  added `input_20.md` to the repo)
- `ef41a75` — "Add Phase 1 deployment handover report" (this report, an
  earlier revision)
- No commit yet for Phase 2 — all Phase 2 work below is uncommitted working-tree
  changes.

## Files changed (Phase 2, uncommitted)
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
- **Production (Neon)**: not run. Awaiting approval, per this phase's explicit
  instructions.

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
Not applicable yet — Phase 2 has not been deployed.

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

## Next recommended task
Await approval to commit/push Phase 2, then run the production Neon migration
and verify production, following the same process as Phase 1's deployment.
