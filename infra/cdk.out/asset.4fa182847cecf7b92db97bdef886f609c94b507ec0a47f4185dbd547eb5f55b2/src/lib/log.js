import { db } from './db.js';

export function logDecision({ event_id = null, correlation_id = null,
                              actor, action, reason = null, payload = {} }) {
  db.query(
    `INSERT INTO decision_log (event_id, correlation_id, actor, action, reason, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [event_id, correlation_id, actor, action, reason, JSON.stringify(payload)]
  ).catch(e => console.error('decision_log failed:', e.message));
}
