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
  accept_button_text   TEXT NOT NULL DEFAULT 'Accept with pleasure',
  decline_button_text  TEXT NOT NULL DEFAULT 'Decline with regret',
  decline_message      TEXT NOT NULL DEFAULT 'Thank you for letting us know. You are always welcome — if your plans change, we''d love to have you with us.',
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For databases that already had the events table before decline_message
-- existed (CREATE TABLE IF NOT EXISTS above won't add it retroactively).
ALTER TABLE events ADD COLUMN IF NOT EXISTS decline_message TEXT NOT NULL
  DEFAULT 'Thank you for letting us know. You are always welcome — if your plans change, we''d love to have you with us.';

CREATE TABLE IF NOT EXISTS guests (
  id            SERIAL PRIMARY KEY,
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  seat_count    INTEGER NOT NULL DEFAULT 1,
  passcode      TEXT UNIQUE NOT NULL,
  email         TEXT,
  rsvp_status   TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined')),
  responded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id);

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
