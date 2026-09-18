# PROMPT_REPORT — Chief Inspector Handover

Permanent, continuously-updated operational handover file. Read this first for "what's
the current state of the world right now" — read `input_20.md` for the full feature
specification, every product/security decision made and why, and the phase-by-phase
implementation plan for everything not yet built. This file is the snapshot; that file
is the record.

---

## Current task / phase

**Input 20 — Phase 1: Event-type taxonomy expansion + active/planned visibility.**

Part of a larger three-goal expansion (theme gallery prep, event-type taxonomy growth,
public booking flow) planned in full in `input_20.md`. Only Phase 1 of that plan's nine
phases has been implemented. Phases 2–9 (nullable `wedding_date`, theme swatches, admin
CSS separation, public homepage, booking inquiries, client access, etc.) are **not
started** — do not assume any of that exists yet.

## Status

**Implemented, tested locally, deployed to production, and verified on production.**
Approved by the user before commit/push/migration.

## Files changed

| File | Change |
|---|---|
| `db/schema.sql` | Widened `events_event_type_check` from 2 to 9 slugs via an idempotent `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` pair (the pre-existing `ADD COLUMN IF NOT EXISTS` line only fires once, so it could not widen the constraint on a database that already had the column) |
| `config/eventTypes.js` | All 9 event types now registered: `slug`, `label`, `titleLabel` each |
| `controllers/admin.controller.js` | New `activeEventTypes()` (derives the selectable list from the theme registry — no stored flag); wired into `newEventForm`/`createEvent`/`showEditForm`; new themeless-type guard added to `createEvent` and `updateEvent` |
| `views/admin/event-form.ejs` | Event-type label swap now data-driven (`data-title-label` attribute), replacing a hardcoded birthday-only ternary |
| `views/admin/edit-event.ejs` | Same data-driven label-swap change, both server-rendered and client-side |

No dashboard template required changes — verified by inspection that the only
theme-selector logic outside these five files (Botanical Bloom's inline dashboard theme
`<select>`) was already correctly scoped and is unaffected by this phase.

## Commit hash

- **`1aac3b2`** — "Prepare event types for active-theme visibility" (the five files
  above). Pushed to `origin/main`.
- This file's own commit hash is reported separately at the end of the turn that
  creates it (see the conversation, not this document — a file cannot know its own
  future commit hash at the time it's written).

## Migration status

- **Local** (`weddings103` on the project's portable Postgres instance): applied via
  `npm run db:migrate`. Verified directly against `pg_constraint` — the widened CHECK
  is in place.
- **Production** (Neon): applied directly against the production `DATABASE_URL`
  (connection string supplied by the user in-conversation, never stored in the repo).
  Verified directly against `pg_constraint` on the production database — identical
  widened CHECK confirmed live.

## Tests performed and results

### Local (before requesting approval)
All 10 items from the user's required testing list — full detail in `input_20.md`'s
`## Phase 1 implementation record`. Summary: all 9 event types accepted by direct
insert; an invalid type rejected by the CHECK constraint; Create/Edit forms confirmed
(via rendered HTML) to show only Wedding/Birthday; "Couple names"/"Celebrant" labels
confirmed both server-rendered and JS-driven; the 7 planned types confirmed absent from
every selector; existing Botanical Bloom, Lavender Romance, and Lady Gianna events
confirmed to still render and save (both full-form and partial-form saves); a direct
POST with a themeless `eventType` confirmed rejected with zero database writes, for
both event creation and an attempted edit of an existing event; all test data deleted
afterward.

### Production (after deploy)
- `GET /admin/login` → `200`.
- All 5 real, pre-existing production events (`id` 1, 2, 4, 8 — Lavender Romance;
  `id` 10 — Lady Gianna) → `GET /invite/:id` → `200`, unchanged.
- **Botanical Bloom had no live production event to verify against** (every existing
  wedding event on production currently uses Lavender Romance) — created one
  temporary `botanical-bloom` event directly via SQL, confirmed `GET /invite/:id` →
  `200` and rendered correctly, then deleted it.
- Direct `INSERT` with an invalid `event_type` on the production database → rejected
  by `events_event_type_check`, same as local.
- Temporary test event cleaned up; no test data left in production.

### Production verification that could **not** be completed
No production admin credentials are available in this session (a recurring,
previously-documented limitation — see below). As a result, the following from the
required list were **not** directly exercised against production, only against local
(where they passed) and via code being identical between the two environments:
- Visually confirming the Create Event and Edit Event forms' rendered `<select>` on
  production itself (only local's rendered HTML was inspected).
- A direct `POST /admin/events` (or `/admin/events/:id`) against production with a
  themeless `eventType`, to confirm the new application-layer guard (not just the DB
  CHECK constraint) rejects it live.

## Known issues, limitations, follow-up items

- **Recurring limitation, not specific to this phase**: this session has never had
  production admin login credentials. Every admin-authenticated surface (dashboards,
  forms, the two guard-tests above) is verified locally and assumed — not confirmed —
  to behave identically in production, since the same code is deployed to both.
  Providing production admin credentials, or having the user spot-check these two
  admin-only items directly, would close this gap.
- **Minor, deliberately-accepted rough edge** (documented in `input_20.md`): when
  `updateEvent` rejects a themeless `eventType`, it reuses the existing generic
  `?error=1` redirect, whose message ("Couple names/Celebrant, date, and venue are
  required.") isn't precisely accurate for this specific rejection reason. Left as-is
  to stay minimal; a more specific error message would be a small, low-risk follow-up.
- **Local dev data side-effect**: during Phase 1 local testing, event `id 1` ("Amani
  na Zawadi") on the *local* database had its `venue` field overwritten to a test
  value as part of save-path verification (original value not captured beforehand).
  Local only — production's `id 1` ("Amani na Zawadi," Lavender Romance) was not
  touched by this and was independently verified unchanged above.
- **No theme exists yet for 7 of the 9 registered event types.** This is by design for
  Phase 1 (see `input_20.md` decisions 1–3) — bridal-shower, baby-shower, engagement,
  anniversary, graduation, corporate, and "other" are schema/registry-ready but
  invisible everywhere until a real theme is built and registered for each. Do not
  add a fallback/default theme for any of them without a new explicit decision — the
  whole point of this phase's guard is refusing to do that silently.

## Recommended next task

**Input 20 — Phase 2: Nullable `wedding_date`.** Per the plan's stated dependency
ordering, this is next because Phase 7 (booking-approval draft events) needs it, and
it's scoped as its own isolated, independently-testable phase specifically so it gets
verified before anything downstream depends on it. Full technical detail — schema
change, every dependent code path (`daysUntil()`, the `publishCore`/`unpublishCore`
split, the three `required` date `<input>` fields, `event_archive`'s matching
nullability) — is already written out in `input_20.md`'s Phase 2 section (§A/§B) and
its dedicated testing checklist (§H). Do not start Phase 3 or later, and do not build
the homepage, booking inquiries, client access, theme swatches, or admin CSS
extraction until Phase 2 is approved and merged, per the same one-phase-at-a-time
discipline used for Phase 1.
