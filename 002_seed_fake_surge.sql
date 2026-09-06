-- Fake 90-second surge in decision_log so D can build Surge Story immediately.
-- Pure SQL — no Node, no drivers. Apply with:
--   psql "host=... sslmode=verify-full sslrootcert=./global-bundle.pem" -f 002_seed_fake_surge.sql
-- Re-runnable: clears previous fake rows first.

DELETE FROM decision_log WHERE correlation_id LIKE 'fake-%';

-- 1. the request stream: 2 accepted intents per second for 90s, with a load curve
WITH k AS (
  SELECT now() - interval '5 minutes' AS t0,
         '00000000-0000-0000-0000-000000000001'::uuid AS ev
)
INSERT INTO decision_log (ts, event_id, correlation_id, actor, action, reason, payload)
SELECT
  k.t0 + (s || ' seconds')::interval,
  k.ev,
  'fake-i-' || s || '-' || g,
  'api',
  'INTENT_ACCEPTED',
  NULL,
  jsonb_build_object(
    'inflight', inflight,
    'mode', CASE WHEN inflight >= 600 THEN 'HIGH'
                 WHEN inflight >= 200 THEN 'ELEVATED'
                 ELSE 'NORMAL' END)
FROM k,
     generate_series(1, 90) AS s,
     generate_series(1, 2)  AS g,
     LATERAL (SELECT round(50 + 900 * sin(least(s, 60)::float / 60 * pi()))::int
              AS inflight) c;

-- 2. seat grants, roughly one every 7 seconds until sold out
WITH k AS (
  SELECT now() - interval '5 minutes' AS t0,
         '00000000-0000-0000-0000-000000000001'::uuid AS ev
)
INSERT INTO decision_log (ts, event_id, correlation_id, actor, action, reason, payload)
SELECT k.t0 + (s || ' seconds')::interval, k.ev, 'fake-g-' || s,
       'reconciler', 'SEAT_GRANTED', NULL,
       jsonb_build_object('seats_left', greatest(0, 500 - s * 6), 'status', 'CONFIRMED')
FROM k, generate_series(1, 84, 7) AS s;

-- 3. the discrete events that make the timeline a story
WITH k AS (
  SELECT now() - interval '5 minutes' AS t0,
         '00000000-0000-0000-0000-000000000001'::uuid AS ev
)
INSERT INTO decision_log (ts, event_id, correlation_id, actor, action, reason, payload)
SELECT k.t0 + (v.s || ' seconds')::interval, k.ev, 'fake-e-' || v.s,
       v.actor, v.action, v.reason, v.payload::jsonb
FROM k, (VALUES
  ( 0, 'api',        'MODE_CHANGE',        'registration opened',      '{"mode":"NORMAL","inflight":12}'),
  (18, 'api',        'MODE_CHANGE',        'inflight=214',             '{"mode":"ELEVATED","inflight":214}'),
  (22, 'api',        'DUPLICATE_ABSORBED', 'idempotency key replay',   '{"count":37}'),
  (24, 'autoscaler', 'SCALE',              'concurrency threshold',    '{"from":2,"to":6}'),
  (31, 'api',        'MODE_CHANGE',        'inflight=640',             '{"mode":"HIGH","inflight":640}'),
  (36, 'chaos',      'CHAOS_ON',           'email',                    '{"target":"email"}'),
  (38, 'notifier',   'BREAKER_OPEN',       '5 consecutive failures',   '{"cooldown_ms":30000}'),
  (44, 'notifier',   'DLQ',                'max receive count',        '{"messages":3}'),
  (52, 'reconciler', 'SEAT_DENIED',        'SOLD_OUT',                 '{"seats_left":0}'),
  (66, 'chaos',      'CHAOS_OFF',          'email',                    '{"target":"email"}'),
  (69, 'notifier',   'BREAKER_CLOSED',     'probe succeeded',          '{"queued":61}'),
  (74, 'autoscaler', 'SCALE',              'traffic stabilised',       '{"from":6,"to":2}'),
  (80, 'api',        'MODE_CHANGE',        'inflight=88',              '{"mode":"NORMAL","inflight":88}')
) AS v(s, actor, action, reason, payload);

-- what D will see
SELECT action, count(*) AS rows, min(ts) AS first, max(ts) AS last
  FROM decision_log WHERE correlation_id LIKE 'fake-%'
 GROUP BY action ORDER BY 2 DESC;
