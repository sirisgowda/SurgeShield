-- GATE 1 fixture, written against the TEAM's schema (varchar ids, no users FK).
--   event: 'gate1-event' with exactly ONE seat
--   users: 'gate1-user-1' .. 'gate1-user-200'  (no rows needed — no FK)
-- Re-runnable.

BEGIN;

DELETE FROM registrations WHERE event_id = 'gate1-event';
DELETE FROM decision_log  WHERE event_id::text = 'gate1-event';
DELETE FROM events        WHERE id = 'gate1-event';

INSERT INTO events (id, name, total_seats, seats_left, status,
                    start_time, end_time,
                    registration_opens_at, registration_closes_at)
VALUES ('gate1-event', 'GATE 1 - single seat', 1, 1, 'OPEN',
        now() + interval '1 day', now() + interval '1 day 2 hours',
        now() - interval '1 minute', now() + interval '1 hour');

COMMIT;

SELECT id, name, total_seats, seats_left,
       registration_opens_at, registration_closes_at
  FROM events WHERE id = 'gate1-event';
