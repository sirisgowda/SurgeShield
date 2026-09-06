-- Reference schema for the tables routes/auth.js and routes/events.js expect.
-- A owns migrations per the runbook — reconcile column names/types with
-- whatever A already created before merging; this is here so you (and
-- anyone testing your routes standalone) know the exact shape assumed.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_sub    TEXT,
  role          TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('attendee', 'organizer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id                       SERIAL PRIMARY KEY,
  organizer_id             INTEGER NOT NULL REFERENCES users(id),
  title                    TEXT NOT NULL,
  description              TEXT,
  starts_at                TIMESTAMPTZ NOT NULL,
  registration_opens_at    TIMESTAMPTZ NOT NULL,
  registration_closes_at   TIMESTAMPTZ NOT NULL,
  capacity                 INTEGER NOT NULL CHECK (capacity > 0),
  seats_left               INTEGER NOT NULL,
  event_mode               TEXT NOT NULL DEFAULT 'physical' CHECK (event_mode IN ('physical', 'virtual')),
  venue                    TEXT,
  join_url                 TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Owned by D (registration flow) — included here only so events.js's
-- JOIN in GET /me/registrations has something to compile/test against.
CREATE TABLE IF NOT EXISTS registrations (
  id          SERIAL PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL,
  reason_code TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
