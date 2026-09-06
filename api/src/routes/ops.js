import { Router } from 'express';
import { db } from '../lib/db.js';

const r = Router();

// NOTE (coordinate before editing): this router is shared —
// A adds /chaos and B adds /invariants onto the same `opsRouter`. Only
// /timeline and /summary below are Dev D's.

r.get('/timeline', async (req, res, next) => {
  try {
    const mins = Math.min(Number(req.query.minutes) || 10, 1440);

    const { rows: events } = await db.query(
      `SELECT ts, actor, action, reason, payload, correlation_id
         FROM decision_log
        WHERE ts > now() - ($1 || ' minutes')::interval
          AND action <> 'INTENT_ACCEPTED'     -- too noisy for the timeline
        ORDER BY ts DESC LIMIT 200`, [mins]);

    // one row per second: request rate + inflight from the accepted-intent rows
    const { rows: series } = await db.query(
      `SELECT date_trunc('second', ts) AS t,
              count(*) AS rps,
              max((payload->>'inflight')::int) AS inflight
         FROM decision_log
        WHERE ts > now() - ($1 || ' minutes')::interval
          AND action = 'INTENT_ACCEPTED'
        GROUP BY 1 ORDER BY 1`, [mins]);

    const { rows: scale } = await db.query(
      `SELECT date_trunc('second', ts) AS t, (payload->>'to')::int AS instances
         FROM decision_log WHERE action='SCALE'
          AND ts > now() - ($1 || ' minutes')::interval ORDER BY 1`, [mins]);

    res.json({ events, series, scale });
  } catch (e) { next(e); }
});

r.get('/summary', async (req, res, next) => {
  try {
    const { rows: [s] } = await db.query(`
      SELECT count(*) FILTER (WHERE action='INTENT_ACCEPTED')    AS accepted,
             count(*) FILTER (WHERE action='DUPLICATE_ABSORBED') AS duplicates,
             count(*) FILTER (WHERE action='SEAT_GRANTED')       AS confirmed,
             count(*) FILTER (WHERE action='SEAT_DENIED')        AS denied,
             max((payload->>'to')::int) FILTER (WHERE action='SCALE') AS peak_instances
        FROM decision_log WHERE ts > now() - interval '15 minutes'`);
    res.json({ ...s, rejected_5xx: 0, overbookings: 0 });
  } catch (e) { next(e); }
});

export default r;
