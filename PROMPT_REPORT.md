# Chief Inspector Report

## Current phase
Input 20 — Phase 1: Event-type taxonomy expansion + active/planned visibility.

## Status
Deployed / partially verified — all checks possible without production admin
credentials pass; admin-only checks (forms, selectors) verified locally only,
not directly on production. See "Known limitations."

## Commits
- `1aac3b2` — "Prepare event types for active-theme visibility" (the five Phase 1
  implementation files)
- `a2fcfdb` — "Add PROMPT_REPORT.md — permanent Chief Inspector handover file"
  (superseded by this update)
- `709501c` — "Prepare event types for active-theme visibility" (added
  `input_20.md`, the feature specification, to the repo — the five code files
  had no further changes at this point, so this commit's diff is `input_20.md`
  only)
- This report's own commit hash is reported separately after it's made (a file
  cannot know its own future commit hash while being written).

## Files changed
- `db/schema.sql` — widened `events_event_type_check` from 2 to 9 slugs
  (idempotent `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`)
- `config/eventTypes.js` — all 9 event types registered (`slug`, `label`,
  `titleLabel`)
- `controllers/admin.controller.js` — new `activeEventTypes()` derivation (from
  the theme registry, no stored flag); wired into all event-type-rendering call
  sites; new themeless-type guard in `createEvent`/`updateEvent`
- `views/admin/event-form.ejs`, `views/admin/edit-event.ejs` — data-driven
  `data-title-label` label swap, replacing a hardcoded birthday-only ternary
- `input_20.md` — full feature specification, decision record, and Phase 1
  implementation record (permanent reference; not an operational file)

## Migration
- **Local**: applied via `npm run db:migrate`; verified against `pg_constraint`
  — widened CHECK in place.
- **Production (Neon)**: applied directly against the production database (this
  session, twice — once on initial approval, once again this round per explicit
  instruction; idempotent, both runs succeeded identically). Verified against
  `pg_constraint` both times — widened CHECK confirmed live. Connection string
  never echoed to terminal output, never written to any committed file.

## Tests
- All 9 event types accepted by direct insert (local and production); an
  invalid type rejected by the CHECK constraint (local and production, both
  verified twice).
- Admin Create/Edit forms' rendered HTML (local): exactly two event-type
  options, Wedding and Birthday; none of the other 7 present.
- "Couple names" (Wedding) / "Celebrant" (Birthday) labels confirmed, both
  server-rendered and via the data-driven JS swap (local).
- Existing Botanical Bloom, Lavender Romance, and Lady Gianna events confirmed
  to render and save correctly, including a full-form save and a partial-form
  save that omits `eventType` entirely (local).
- Direct POST with a themeless `eventType` confirmed rejected with zero
  database writes, for both event creation and editing an existing event
  (local).
- All local and production test data created for verification was deleted
  afterward — no test rows remain in either database.

## Production verification
- `GET /admin/login` → `200`.
- All 5 pre-existing production events (`id` 1, 2, 4, 8 — Lavender Romance;
  `id` 10 — Lady Gianna) → `GET /invite/:id` → `200`, unchanged, re-confirmed
  this round.
- **Botanical Bloom**: no live production event currently uses this theme.
  Created a temporary `botanical-bloom` event directly against the production
  database, confirmed `GET /invite/:id` → `200` and correct rendering, then
  deleted it. Done twice across the two verification rounds this phase, same
  result both times.
- Direct `INSERT` with an invalid `event_type` against the production database
  → rejected by `events_event_type_check`, confirmed twice.
- **Not verified on production** (no admin credentials available this
  session): the rendered Create/Edit event-type `<select>` actually showing
  only Wedding/Birthday on production itself, and a direct `POST
  /admin/events(/:id)` with a themeless type being rejected by the
  application-layer guard on production. Both are verified locally against
  the identical deployed code; production behavior is inferred, not directly
  observed, for these two items specifically.

## Known limitations
- No production admin login credentials available in this session — this is a
  recurring, previously-documented gap affecting every admin-authenticated
  surface, not specific to this phase.
- `updateEvent`'s themeless-type rejection reuses the existing generic
  `?error=1` redirect message ("Couple names/Celebrant, date, and venue are
  required."), which isn't precisely accurate for this rejection reason.
  Accepted as a minor rough edge to keep the change minimal.
- No theme exists yet for 7 of the 9 registered event types
  (bridal-shower, baby-shower, engagement, anniversary, graduation, corporate,
  other) — by design; they stay invisible everywhere until a real theme is
  built and registered for each. No fallback theme should ever be assigned to
  any of them without a new explicit decision.
- Local dev-only side effect (not production): during initial Phase 1 testing,
  local event `id 1` ("Amani na Zawadi") had its `venue` overwritten by a
  save-path test; production's `id 1` (same name, different data) was
  independently confirmed unchanged.

## Next recommended task
Input 20 — Phase 2: Nullable event date support
