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
  wedding_date         DATE NOT NULL,
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
  wedding_date        DATE NOT NULL,
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
