import { Router } from 'express';
import { db } from '../lib/db.js';

const r = Router();

export function statusOf(event) {
  if (!event) return 'CLOSED';
  if (event.status) return event.status;
  const now = Date.now();
  if (event.start_time && new Date(event.start_time).getTime() > now) return 'SCHEDULED';
  if (event.end_time && new Date(event.end_time).getTime() < now) return 'CLOSED';
  return 'OPEN';
}

r.get('/events', async (_req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM events ORDER BY created_at DESC');
    res.json({ events: rows });
  } catch (e) { next(e); }
});

r.get('/events/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM events WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'NO_SUCH_EVENT' });
    res.json({ event: rows[0], status: statusOf(rows[0]) });
  } catch (e) { next(e); }
});

export default r;
