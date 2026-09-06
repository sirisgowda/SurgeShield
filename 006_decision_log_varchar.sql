-- Fix for GATE 1 blocker: decision_log.event_id was UUID, but every other
-- event id in the live schema is varchar(64) ('gate1-event', 'event-1').
--
-- The reconciler claimed the seat and decremented seats_left correctly, then
-- threw 22P02 "invalid input syntax for type uuid" on the audit-log INSERT,
-- which rolled the whole transaction back. Symptom: no registration row and
-- seats_left unchanged, message retried 3x into the DLQ.
--
-- WIDENING, not replacing: no DROP, every existing row is preserved. A uuid
-- cast to text yields its canonical lowercase hyphenated form, which is the
-- exact string the dashboard already renders, so reads are unaffected.
-- Idempotent: re-running on an already-converted column is a no-op.

BEGIN;

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name='decision_log'
         AND column_name='event_id') = 'uuid'
  THEN
    ALTER TABLE decision_log
      ALTER COLUMN event_id TYPE varchar(64) USING event_id::text;
    RAISE NOTICE 'decision_log.event_id widened uuid -> varchar(64)';
  ELSE
    RAISE NOTICE 'decision_log.event_id already varchar - no change';
  END IF;
END $$;

COMMIT;

-- proof: type changed, row count and every event id intact
SELECT data_type, character_maximum_length
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='decision_log' AND column_name='event_id';

SELECT count(*) AS total_rows,
       count(event_id) AS rows_with_event_id,
       count(DISTINCT event_id) AS distinct_events
  FROM decision_log;
