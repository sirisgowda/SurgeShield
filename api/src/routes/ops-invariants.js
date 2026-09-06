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

export default r;
