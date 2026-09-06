import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const r = Router();

// Status is DERIVED from timestamps on every read. There is no status column,
// no cron job, no TTL to expire. That means: no drift between a stored value
// and reality, no missed-fire if a scheduled job doesn't run, and no
// disagreement between two clocks — "now" is computed once, at request time,
// from the same source for every event.
export function statusOf(e, now = new Date()) {
  if (now < new Date(e.registration_opens_at)) return 'SCHEDULED';
  if (now >= new Date(e.registration_closes_at)) return 'CLOSED';
  return e.seats_left > 0 ? 'REGISTRATION_OPEN' : 'SOLD_OUT';
}
const decorate = (e) => ({ ...e, status: statusOf(e) });

r.post('/', requireAuth('organizer'), async (req, res, next) => {
  try {
    const b = req.body;
    const problems = [];
    if (!b.title?.trim()) problems.push('Title is required.');
    if (!(b.capacity > 0)) problems.push('Capacity must be at least 1.');
    if (!b.starts_at) problems.push('Start time is required.');
    if (!b.registration_opens_at || !b.registration_closes_at) {
      problems.push('Registration open and close times are required.');
    } else if (new Date(b.registration_closes_at) <= new Date(b.registration_opens_at)) {
      problems.push('Registration must close after it opens.');
    }
    if (b.event_mode === 'virtual' && !b.join_url) problems.push('Virtual events need a join URL.');
    if (b.event_mode !== 'virtual' && !b.venue) problems.push('Physical events need a venue.');
    if (problems.length) return res.status(400).json({ error: 'VALIDATION', problems });

    const { rows } = await db.query(
      `INSERT INTO events (organizer_id,title,description,starts_at,
         registration_opens_at,registration_closes_at,capacity,seats_left,
         event_mode,venue,join_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10) RETURNING *`,
      [
        req.user.sub,
        b.title.trim(),
        b.description ?? null,
        b.starts_at,
        b.registration_opens_at,
        b.registration_closes_at,
        b.capacity,
        b.event_mode ?? 'physical',
        b.venue ?? null,
        b.join_url ?? null,
      ],
    );
    res.status(201).json(decorate(rows[0]));
  } catch (e) {
    next(e);
  }
});

r.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM events ORDER BY registration_opens_at ASC LIMIT 50');
    res.json(rows.map(decorate));
  } catch (e) {
    next(e);
  }
});

// IMPORTANT: this must stay declared before GET /:id, or Express matches
// "me" as the :id param and this route never gets hit. Classic 20-minute bug.
r.get('/me/registrations', requireAuth(), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT r.id,r.status,r.reason_code,r.created_at,
              e.title,e.starts_at,e.venue,e.join_url,e.event_mode
         FROM registrations r JOIN events e ON e.id=r.event_id
        WHERE r.user_id=$1 ORDER BY r.created_at DESC`,
      [req.user.sub],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

r.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM events WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json(decorate(rows[0]));
  } catch (e) {
    next(e);
  }
});

export default r;
