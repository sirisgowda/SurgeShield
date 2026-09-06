-- SurgeShield invariants. Read-only; safe to run any time, against live data.
--   psql $PG -f .\008_invariants.sql
--
-- Each invariant reports a VIOLATION COUNT. Zero everywhere means the system is
-- consistent. Anything else names the exact rows to go look at, below.
--
-- #5 exists because of a bug that shipped: the reconciler enqueued a
-- notification whenever the resulting status was CONFIRMED, and an absorbed
-- duplicate reports the EXISTING row's status - which is CONFIRMED. So three
-- repeat requests from one user produced three confirmation emails. Every one
-- of invariants 1-4 passed the whole time: no seat was overbooked, no seat
-- leaked, no duplicate registration row existed. The seat math was perfect and
-- the user still got spammed. An invariant set that only watches seats cannot
-- see a side effect that does not touch seats.

WITH seat_math AS (
  SELECT e.id, e.total_seats, e.seats_left,
         count(r.*) FILTER (WHERE r.status = 'CONFIRMED') AS confirmed
    FROM events e
    LEFT JOIN registrations r ON r.event_id = e.id
   GROUP BY e.id, e.total_seats, e.seats_left
),
dup_registration AS (
  SELECT event_id, user_id, count(*) AS n
    FROM registrations
   GROUP BY 1, 2
  HAVING count(*) > 1
),
dup_notification AS (
  -- decision_log has no user_id column; the notifier records it in the payload.
  SELECT event_id, payload->>'userId' AS user_id, count(*) AS n
    FROM decision_log
   WHERE actor = 'notifier'
     AND action = 'NOTIFY_SENT'
     AND payload->>'userId' IS NOT NULL
   GROUP BY 1, 2
  HAVING count(*) > 1
)
SELECT invariant, violations, violations = 0 AS ok
  FROM (
    SELECT '1. no_overbooking'             AS invariant,
           (SELECT count(*) FROM seat_math WHERE seats_left < 0)                        AS violations
    UNION ALL
    SELECT '2. seats_math',
           (SELECT count(*) FROM seat_math WHERE total_seats - confirmed <> seats_left)
    UNION ALL
    SELECT '3. no_double_registration',
           (SELECT count(*) FROM dup_registration)
    UNION ALL
    SELECT '4. no_confirmed_over_capacity',
           (SELECT count(*) FROM seat_math WHERE confirmed > total_seats)
    UNION ALL
    SELECT '5. no_duplicate_notifications',
           (SELECT count(*) FROM dup_notification)
  ) x
 ORDER BY invariant;

-- ── per-event detail ────────────────────────────────────────────────────────
-- Scalar subqueries, NOT two LEFT JOINs. Joining registrations and decision_log
-- in the same query multiplies them: 18 registrations x 34 log rows reported
-- 612 confirmed seats against a 60-seat event. Correlated subqueries each count
-- their own table, so nothing fans out.
SELECT e.id AS event_id, e.total_seats, e.seats_left,
       (SELECT count(*) FROM registrations r
         WHERE r.event_id = e.id AND r.status = 'CONFIRMED')            AS confirmed,
       e.total_seats - (SELECT count(*) FROM registrations r
         WHERE r.event_id = e.id AND r.status = 'CONFIRMED')
         = e.seats_left                                                 AS seats_ok,
       (SELECT count(*) FROM decision_log d
         WHERE d.event_id = e.id AND d.actor = 'notifier'
           AND d.action = 'NOTIFY_SENT')                                AS notified
  FROM events e
 ORDER BY e.id;

-- ── violations, if any ──────────────────────────────────────────────────────
SELECT 'double_registration' AS kind, event_id, user_id, count(*) AS n
  FROM registrations GROUP BY 1, 2, 3 HAVING count(*) > 1
UNION ALL
SELECT 'duplicate_notification', event_id, payload->>'userId', count(*)
  FROM decision_log
 WHERE actor = 'notifier' AND action = 'NOTIFY_SENT' AND payload->>'userId' IS NOT NULL
 GROUP BY 1, 2, 3 HAVING count(*) > 1;
