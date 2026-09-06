-- SurgeShield schema. Apply with:
--   psql "host=... sslmode=verify-full sslrootcert=./global-bundle.pem" -f 001_schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_sub    TEXT UNIQUE,
  role          TEXT NOT NULL DEFAULT 'attendee',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id           UUID NOT NULL REFERENCES users(id),
  title                  TEXT NOT NULL,
  description            TEXT,
  starts_at              TIMESTAMPTZ NOT NULL,
  registration_opens_at  TIMESTAMPTZ NOT NULL,
  registration_closes_at TIMESTAMPTZ NOT NULL,
  capacity               INT  NOT NULL CHECK (capacity > 0),
  seats_left             INT  NOT NULL CHECK (seats_left >= 0),  -- backstop
  event_mode             TEXT NOT NULL DEFAULT 'physical',       -- physical | virtual
  venue                  TEXT,
  join_url               TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  intent_id   TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL,          -- PENDING | CONFIRMED | WAITLISTED | REJECTED
  reason_code TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)          -- the claim the reconciler competes for
);

CREATE TABLE IF NOT EXISTS decision_log (
  id             BIGSERIAL PRIMARY KEY,
  ts             TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id       UUID,                -- deliberately no FK: logs outlive events
  correlation_id TEXT,
  actor          TEXT NOT NULL,       -- api | reconciler | notifier | autoscaler | chaos
  action         TEXT NOT NULL,
  reason         TEXT,
  payload        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS decision_log_ts_idx       ON decision_log (ts DESC);
CREATE INDEX IF NOT EXISTS decision_log_event_ts_idx ON decision_log (event_id, ts DESC);
CREATE INDEX IF NOT EXISTS registrations_event_idx   ON registrations (event_id, status);

-- sanity
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' ORDER BY 1;
