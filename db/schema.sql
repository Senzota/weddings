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
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
