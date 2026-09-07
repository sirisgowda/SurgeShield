-- GATE 2 fixture: an event with FIVE seats, used to prove that three requests
-- from the SAME user consume exactly ONE of them.
--
-- Five seats (not one) is deliberate: with a 1-seat event a seat leak would hit
-- the floor and hide behind SOLD_OUT. With five, a leak is directly visible as
-- seats_left = 2 instead of 4.
--
-- Re-runnable. Requires 006 (decision_log.event_id is varchar(64), so the
-- delete below needs no ::text cast).

BEGIN;

DELETE FROM registrations WHERE event_id = 'gate2-event';
DELETE FROM decision_log  WHERE event_id = 'gate2-event';
DELETE FROM events        WHERE id = 'gate2-event';

INSERT INTO events (id, name, total_seats, seats_left, status,
                    start_time, end_time,
                    registration_opens_at, registration_closes_at)
VALUES ('gate2-event', 'GATE 2 - duplicate absorption', 5, 5, 'OPEN',
        now() + interval '1 day', now() + interval '1 day 2 hours',
        now() - interval '1 minute', now() + interval '1 hour');

COMMIT;

SELECT id, name, total_seats, seats_left,
       registration_opens_at, registration_closes_at
  FROM events WHERE id = 'gate2-event';
