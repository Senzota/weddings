-- Weddings 103 schema
-- Applied manually or via `npm run db:migrate`.

CREATE TABLE IF NOT EXISTS admin (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id                   SERIAL PRIMARY KEY,
  couple_names         TEXT NOT NULL,
  wedding_date         DATE,
  venue                TEXT NOT NULL,
  theme_color          TEXT NOT NULL DEFAULT '#8a6d3b',
  card_image           TEXT,
  card_image_public_id TEXT,
  accept_button_text   TEXT NOT NULL DEFAULT 'Accept with pleasure',
  decline_button_text  TEXT NOT NULL DEFAULT 'Decline with regret',
  decline_message      TEXT NOT NULL DEFAULT 'Thank you for letting us know. You are always welcome — if your plans change, we''d love to have you with us.',
  theme                TEXT NOT NULL DEFAULT 'botanical-bloom',
  itinerary            TEXT,
  invitation_message   TEXT,
  contact_details       TEXT,
  access_mode          TEXT NOT NULL DEFAULT 'closed' CHECK (access_mode IN ('open', 'recognized', 'closed')),
  event_type           TEXT NOT NULL DEFAULT 'wedding' CHECK (event_type IN (
                         'wedding', 'birthday', 'bridal-shower', 'baby-shower',
                         'engagement', 'anniversary', 'graduation', 'corporate', 'other'
                       )),
  subtitle             TEXT,
  footer_note          TEXT,
  event_time_note      TEXT,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For databases that already had the events table before these columns
-- existed (CREATE TABLE IF NOT EXISTS above won't add them retroactively).
ALTER TABLE events ADD COLUMN IF NOT EXISTS decline_message TEXT NOT NULL
  DEFAULT 'Thank you for letting us know. You are always welcome — if your plans change, we''d love to have you with us.';
ALTER TABLE events ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'botanical-bloom';
ALTER TABLE events ADD COLUMN IF NOT EXISTS itinerary TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS invitation_message TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS contact_details TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS card_image_public_id TEXT;
-- Default 'closed' keeps every event that already existed behaving exactly
-- as it did before this field existed (full code + RSVP + QR + scanner).
ALTER TABLE events ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'closed'
  CHECK (access_mode IN ('open', 'recognized', 'closed'));
-- input_15: generalizes events beyond weddings. Default 'wedding' keeps
-- every existing event (and every caller unaware of this field) behaving
-- exactly as before. couple_names/wedding_date are reused as-is (holding
-- the celebrant's name / event date for a birthday); subtitle, footer_note
-- and event_time_note are new free-text fields usable by any event type.
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'wedding'
  CHECK (event_type IN ('wedding', 'birthday'));
-- input_20 Phase 1: widens the taxonomy from 2 to 9 event types. The
-- ADD COLUMN above only ever fires once (when the column doesn't exist
-- yet), so on every database that already has this column — local dev,
-- and production — its CHECK constraint needs widening explicitly here.
-- Drop-then-add on the same (Postgres-auto-generated) constraint name is
-- idempotent and safe to re-run. No column is renamed; no existing row's
-- event_type value changes — every event created before this input keeps
-- reading back exactly as 'wedding' or 'birthday'. New types are added to
-- the taxonomy only; nothing in the admin/public UI offers them yet
-- (see config/eventTypes.js + admin.controller.js's active-type filter).
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;
ALTER TABLE events ADD CONSTRAINT events_event_type_check CHECK (event_type IN (
  'wedding', 'birthday', 'bridal-shower', 'baby-shower',
  'engagement', 'anniversary', 'graduation', 'corporate', 'other'
));
ALTER TABLE events ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS footer_note TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time_note TEXT;

-- input_20 Phase 2: a booking-approved draft event won't have a real date
-- yet (no artificial placeholder date — see input_20.md decision 5), so
-- wedding_date can no longer be unconditionally NOT NULL. The inline
-- CREATE TABLE above already reflects this for a brand-new database;
-- DROP NOT NULL is itself idempotent (a no-op if already nullable), so
-- it's safe to run on every database that already has this column,
-- including ones created before this input. Existing rows are untouched
-- — dropping a NOT NULL constraint never rewrites data, and every event
-- that already had a real date keeps it exactly as it was.
ALTER TABLE events ALTER COLUMN wedding_date DROP NOT NULL;
-- The one thing that must never be true: a *live* event with no date —
-- guests would see a page with no date to plan around. Named so the
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT pair is idempotent, same
-- pattern as events_event_type_check above. This is the hard backstop;
-- the application layer (admin.controller.js's publish guard) is what
-- actually stops this in normal use — this constraint exists for the
-- case that guard is ever bypassed (a direct SQL update, a future bug).
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_live_requires_date;
ALTER TABLE events ADD CONSTRAINT events_live_requires_date
  CHECK (status <> 'live' OR wedding_date IS NOT NULL);

-- Theme slug renamed from 'design-1' to 'botanical-bloom' (input_8) — fix
-- up any events created under the old name.
UPDATE events SET theme = 'botanical-bloom' WHERE theme = 'design-1';

-- Card images uploaded before input_11 (local disk, wiped by every Render
-- deploy) point at paths that no longer exist. Clearing them so the admin
-- page shows a clean "no image" state rather than a broken <img>, prompting
-- a re-upload straight to Cloudinary.
UPDATE events SET card_image = NULL WHERE card_image IS NOT NULL AND card_image LIKE '/uploads/%';

CREATE TABLE IF NOT EXISTS guests (
  id            SERIAL PRIMARY KEY,
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  seat_count    INTEGER NOT NULL DEFAULT 1,
  passcode      TEXT UNIQUE NOT NULL,
  email         TEXT,
  invite_group  TEXT,
  rsvp_status   TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined')),
  responded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id);
-- input_15 §A7: purely descriptive free text (e.g. "Family celebration ·
-- 4 guests"), admin-typed, not tied to any logic.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS invite_group TEXT;

CREATE TABLE IF NOT EXISTS gatepasses (
  id                  SERIAL PRIMARY KEY,
  guest_id            INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  qr_token            TEXT UNIQUE NOT NULL,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in          BOOLEAN NOT NULL DEFAULT false,
  checked_in_at       TIMESTAMPTZ,
  duplicate_attempts  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gatepasses_guest_id ON gatepasses(guest_id);

-- Stores Cloudinary URLs only, never image bytes.
CREATE TABLE IF NOT EXISTS gallery_photos (
  id           SERIAL PRIMARY KEY,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  public_id    TEXT NOT NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_event_id ON gallery_photos(event_id);

-- Cameos: photos of family/friends "who wish to be seen," each with a
-- title/caption -- that's what distinguishes this from gallery_photos.
-- Same Cloudinary-backed pattern (URL + public_id only, never bytes).
CREATE TABLE IF NOT EXISTS cameo_photos (
  id           SERIAL PRIMARY KEY,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  public_id    TEXT NOT NULL,
  title        TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cameo_photos_event_id ON cameo_photos(event_id);

-- input_13 Part B: a Cameo photo no longer requires a caption.
ALTER TABLE cameo_photos ALTER COLUMN title DROP NOT NULL;

-- Anonymous summary metrics preserved when an event is deleted (manually or
-- by the 30-day auto-sweep). Never purged by anything.
CREATE TABLE IF NOT EXISTS event_archive (
  id                  SERIAL PRIMARY KEY,
  couple_names        TEXT NOT NULL,
  wedding_date        DATE,
  venue               TEXT NOT NULL,
  total_guests        INTEGER NOT NULL,
  total_seats         INTEGER NOT NULL,
  accepted_count      INTEGER NOT NULL,
  declined_count      INTEGER NOT NULL,
  pending_count       INTEGER NOT NULL,
  seats_accepted      INTEGER NOT NULL,
  checked_in_count    INTEGER NOT NULL,
  response_rate       NUMERIC,
  attendance_rate     NUMERIC,
  event_created_at    TIMESTAMPTZ NOT NULL,
  archived_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- input_20 Phase 2: a dateless draft event must be deletable (archiveAndDelete
-- inserts the event's own wedding_date here before removing it from events)
-- without failing on a NOT NULL violation. Idempotent (no-op if already
-- nullable); no existing archived row's data changes.
ALTER TABLE event_archive ALTER COLUMN wedding_date DROP NOT NULL;

-- input_20 Phase 5: public booking inquiries from the new homepage's Book
-- Now form. A brand-new table, not a widened existing column, so the plain
-- idempotent CREATE TABLE IF NOT EXISTS is sufficient — no DROP/ADD
-- CONSTRAINT dance needed the way events.event_type's CHECK required.
-- event_type's CHECK mirrors events_event_type_check's full 9-value list
-- (defense-in-depth — the app only ever submits an ACTIVE type, but the
-- constraint itself doesn't need to track which types are active today).
-- preferred_theme has no CHECK, same precedent as events.theme, so themes
-- can be added later without a migration. event_id is nullable and is only
-- ever set once, by a future phase's approve transaction — Phase 5 never
-- writes it. decided_by references admin(id) for the same future phase;
-- Phase 5 never writes decided_at/decided_by either.
CREATE TABLE IF NOT EXISTS booking_inquiries (
  id               SERIAL PRIMARY KEY,
  full_name        TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT NOT NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN (
                     'wedding', 'birthday', 'bridal-shower', 'baby-shower',
                     'engagement', 'anniversary', 'graduation', 'corporate', 'other'
                   )),
  preferred_theme  TEXT,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'declined')),
  event_id         INTEGER REFERENCES events(id) ON DELETE SET NULL,
  decided_at       TIMESTAMPTZ,
  decided_by       INTEGER REFERENCES admin(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_inquiries_status ON booking_inquiries(status);

-- input_20 Phase 7: one client-access token per approved inquiry's event.
-- event_id UNIQUE — one event has exactly one client token, ever; if a
-- token ever needs rotating (lost link, security concern), that's a
-- delete-and-reissue on this row, not a new table shape. token_hash only
-- (sha256 hex of the raw token) — the raw token is never stored, only
-- ever shown once at approval time, in the admin's one-time result page.
CREATE TABLE IF NOT EXISTS client_access (
  id           SERIAL PRIMARY KEY,
  event_id     INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- input_20 Phase 10A: self-service client account identity — separate from,
-- and not yet linked to, booking_inquiries/events (that linkage is a later
-- phase). Same minimal shape as the existing admin table (id/email UNIQUE/
-- password_hash/created_at), plus full_name and optional phone since a
-- client, unlike the single seeded admin, fills these in themselves at
-- signup. email is stored already lowercased/trimmed by the application
-- (models/client.model.js) before every insert, so this UNIQUE constraint
-- is case-normalized in practice without needing a functional index.
CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- input_20 Phase 10B: ownership linkage only — ties a booking inquiry (and
-- later, the event it becomes) to the client account that submitted it, if
-- any. Both columns are nullable: a signed-out visitor can still submit an
-- inquiry exactly as before, leaving client_id NULL end to end. ON DELETE
-- SET NULL rather than CASCADE — deleting a client account must never
-- silently delete someone's booking inquiry or event; it should just
-- become unowned again, the same state an anonymous submission is already
-- in. No backfill: rows created before this phase have no session-derived
-- client to attribute them to, so they stay NULL rather than being guessed
-- at from email text (see inquiry.model.js's approve() for why email
-- matching is deliberately never used to infer ownership).
ALTER TABLE booking_inquiries ADD COLUMN IF NOT EXISTS client_id INTEGER
  REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_id INTEGER
  REFERENCES clients(id) ON DELETE SET NULL;

-- Bug-fix pass (post-input_20): the authenticated client booking form never
-- collected an access-mode preference, so every approved inquiry silently
-- became events.access_mode = 'closed' (that column's own default) with no
-- way for the client to ask for anything else. This column is the missing
-- link: an optional, nullable preference recorded at booking time and read
-- only by inquiry.model.js's approve() transaction (see that file). No
-- DEFAULT here deliberately — NULL means "no preference stated," which
-- covers every pre-existing row (nothing to backfill; a guess from old data
-- would be exactly the kind of invented value this column exists to avoid)
-- and the still-supported anonymous/legacy /inquiries path, which has no
-- access-mode field either and must keep landing on events.access_mode's
-- own existing default, completely unchanged. events.access_mode itself is
-- untouched — this is additive on booking_inquiries only.
ALTER TABLE booking_inquiries ADD COLUMN IF NOT EXISTS preferred_access_mode TEXT
  CHECK (preferred_access_mode IN ('open', 'recognized', 'closed'));
