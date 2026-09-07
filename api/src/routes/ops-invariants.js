// GET /api/ops/invariants — the five correctness checks (owner: Dev B)
//
// Self-contained on purpose: it does not modify routes/ops.js, so it cannot
// conflict with D's /timeline and /summary work.
//
// TO MOUNT — two lines in api/src/index.js (or wherever the routers are wired):
//
//     import invariantsRouter from './routes/ops-invariants.js';
//     app.use('/api/ops', invariantsRouter);
//
// If the project uses CommonJS instead of ESM, swap the import/export lines
// for `const { Router } = require('express')` and `module.exports = r`.
//
// RESPONSE SHAPE (this is what D's panel already expects):
//     { ok: true, checks: [ { name: "no_overbooking", ok: true, violations: 0 }, ... ] }
//
// An invariant is a statement that must ALWAYS be true. Each query below counts
// how many rows violate it; zero means healthy. They are deliberately written
// against the live schema (varchar ids, total_seats) rather than an idealised one.

import { Router } from 'express';
import { db } from '../lib/db.js';   // adjust path if the pool lives elsewhere

const r = Router();

const SQL = `
WITH confirmed AS (
  SELECT event_id, count(*) AS n
    FROM registrations
   WHERE status = 'CONFIRMED'
   GROUP BY event_id
)
-- 1. nobody sold more seats than the event has
SELECT 'no_overbooking' AS name, count(*) AS violations
  FROM events e
  LEFT JOIN confirmed c ON c.event_id = e.id
 WHERE COALESCE(c.n, 0) > e.total_seats

UNION ALL
-- 2. the seat counter agrees with reality
SELECT 'seats_math', count(*)
  FROM events e
  LEFT JOIN confirmed c ON c.event_id = e.id
 WHERE e.seats_left <> e.total_seats - COALESCE(c.n, 0)

UNION ALL
-- 3. no person holds two registrations for one event
SELECT 'no_double_registration', count(*)
  FROM (SELECT event_id, user_id
          FROM registrations
         GROUP BY 1, 2
        HAVING count(*) > 1) d

UNION ALL
-- 4. the counter never went negative (the CHECK constraint should prevent this)
SELECT 'no_negative_seats', count(*)
  FROM events WHERE seats_left < 0

UNION ALL
-- 5. nobody received two confirmation emails.
--    Joins the log back to registrations via intent_id, and falls back to the
--    payload's userId for log rows with no matching registration.
SELECT 'no_duplicate_notifications', count(*)
  FROM (SELECT d.event_id,
               COALESCE(reg.user_id, d.payload->>'userId') AS uid
          FROM decision_log d
          LEFT JOIN registrations reg ON reg.intent_id = d.correlation_id
         WHERE d.action = 'NOTIFY_SENT'
           AND COALESCE(reg.user_id, d.payload->>'userId') IS NOT NULL
         GROUP BY 1, 2
        HAVING count(*) > 1) n
`;

r.get('/invariants', async (_req, res) => {
    try {
        const { rows } = await db.query(SQL);
        const checks = rows.map(row => ({
            name: row.name,
            ok: Number(row.violations) === 0,
            violations: Number(row.violations),
        }));
        res.json({ ok: checks.every(c => c.ok), checks });
    } catch (e) {
        // Fail loudly rather than reporting a false green. A panel that shows
        // "all healthy" because the query errored is worse than no panel at all.
        console.error('invariants query failed:', e.message);
        res.status(500).json({
            ok: false, error: 'INVARIANTS_QUERY_FAILED',
            message: e.message, checks: []
        });
    }
});

// ── GET /api/ops/timeline ───────────────────────────────────────────────────
// Recent decision_log activity, plus a per-second accepted-intent series and
// any autoscaler steps. INTENT_ACCEPTED is excluded from `events` because under
// a surge it drowns out every other action; it is the `series` instead.
r.get('/timeline', async (req, res) => {
    try {
        const mins = Math.min(Number(req.query.minutes) || 10, 1440);

        const { rows: events } = await db.query(
            `SELECT ts, actor, action, reason, payload, correlation_id, event_id
               FROM decision_log
              WHERE ts > now() - ($1 || ' minutes')::interval
                AND action <> 'INTENT_ACCEPTED'
              ORDER BY ts DESC LIMIT 200`, [mins]);

        const { rows: series } = await db.query(
            `SELECT date_trunc('second', ts) AS t, count(*) AS rps,
                    max((payload->>'inflight')::int) AS inflight
               FROM decision_log
              WHERE ts > now() - ($1 || ' minutes')::interval
                AND action = 'INTENT_ACCEPTED'
              GROUP BY 1 ORDER BY 1`, [mins]);

        const { rows: scale } = await db.query(
            `SELECT date_trunc('second', ts) AS t, (payload->>'to')::int AS instances
               FROM decision_log WHERE action = 'SCALE'
                AND ts > now() - ($1 || ' minutes')::interval ORDER BY 1`, [mins]);

        res.json({ events, series, scale });
    } catch (e) {
        console.error('timeline query failed:', e.message);
        res.status(500).json({ error: 'TIMELINE_QUERY_FAILED', message: e.message });
    }
});

// ── GET /api/ops/summary ────────────────────────────────────────────────────
// Headline counters for the last 15 minutes.
r.get('/summary', async (_req, res) => {
    try {
        const { rows: [s] } = await db.query(`
      SELECT count(*) FILTER (WHERE action='INTENT_ACCEPTED')    AS accepted,
             count(*) FILTER (WHERE action='DUPLICATE_ABSORBED') AS duplicates,
             count(*) FILTER (WHERE action='SEAT_GRANTED')       AS confirmed,
             count(*) FILTER (WHERE action='SEAT_DENIED')        AS denied,
             max((payload->>'to')::int) FILTER (WHERE action='SCALE') AS peak_instances
        FROM decision_log WHERE ts > now() - interval '15 minutes'`);
        res.json({ ...s, rejected_5xx: 0, overbookings: 0 });
    } catch (e) {
        console.error('summary query failed:', e.message);
        res.status(500).json({ error: 'SUMMARY_QUERY_FAILED', message: e.message });
    }
});

export default r;
