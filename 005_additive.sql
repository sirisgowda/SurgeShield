-- Additive migration: adapt the EXISTING schema instead of replacing it.
-- Drops nothing, so A's code keeps working and a re-run of their
-- CREATE TABLE IF NOT EXISTS is a harmless no-op.
--
-- The reconciler needs exactly four things that aren't there yet:
--   events.registration_opens_at   — the window, so status can be DERIVED
--   events.registration_closes_at
--   registrations.intent_id        — correlation back to the queue message
--   registrations.reason_code      — why a request was denied

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_opens_at  TIMESTAMPTZ NOT NULL
    DEFAULT (now() - interval '1 minute');
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_closes_at TIMESTAMPTZ NOT NULL
    DEFAULT (now() + interval '365 days');

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS intent_id   TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS reason_code TEXT;

-- one registration per queue message
CREATE UNIQUE INDEX IF NOT EXISTS registrations_intent_uq
  ON registrations (intent_id) WHERE intent_id IS NOT NULL;

-- the backstop: turn a seat-accounting bug into a failed transaction
DO $$
BEGIN
  ALTER TABLE events ADD CONSTRAINT events_seats_nonneg CHECK (seats_left >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS registrations_event_status_idx
  ON registrations (event_id, status);

SELECT 'events' AS t, column_name FROM information_schema.columns
 WHERE table_name='events' AND column_name LIKE 'registration%'
UNION ALL
SELECT 'registrations', column_name FROM information_schema.columns
 WHERE table_name='registrations' AND column_name IN ('intent_id','reason_code')
 ORDER BY 1,2;
