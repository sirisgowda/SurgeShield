import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const r = Router();

// Real events table has a text `id` column with no default — we must supply one.
function makeEventId(title) {
  const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${slug || 'event'}-${Date.now()}`;
}

// Real AWS table columns: id, name, start_time, end_time, registration_opens_at,
// registration_closes_at, total_seats, seats_left, status, created_at.
// No title/capacity/organizer_id/description/venue/event_mode/join_url exist yet —
// mapped here so the rest of the frontend (title, capacity, starts_at) keeps working
// unchanged. Ownership (organizer_id) and extra fields are not stored for now —
// flagged for the team to add to the real schema later.
export function statusOf(e, now = new Date()) {
  if (e.registration_opens_at && now < new Date(e.registration_opens_at)) return 'SCHEDULED';
  if (e.registration_closes_at && now >= new Date(e.registration_closes_at)) return 'CLOSED';
  return e.seats_left > 0 ? 'REGISTRATION_OPEN' : 'SOLD_OUT';
}
const decorate = (e) => ({
  ...e,
  title: e.title ?? e.name,
  capacity: e.capacity ?? e.total_seats,
  starts_at: e.starts_at ?? e.start_time,
  status: e.status ?? statusOf(e),
});

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
    if (problems.length) return res.status(400).json({ error: 'VALIDATION', problems });

    // NOTE: description/venue/join_url/event_mode from the form aren't saved —
    // the real events table has no columns for them yet.
        const { rows } = await db.query(
      `INSERT INTO events (id,name,start_time,registration_opens_at,registration_closes_at,
         total_seats,seats_left,status)
       VALUES ($1,$2,$3,$4,$5,$6,$6,'SCHEDULED') RETURNING *`,
      [
        makeEventId(b.title),
        b.title.trim(),
        b.starts_at,
        b.registration_opens_at,
        b.registration_closes_at,
        b.capacity,
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
// "me" as the :id param and this route never gets hit.
r.get('/me/registrations', requireAuth(), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT r.id,r.status,r.reason_code,r.created_at,
              e.name AS title,e.start_time AS starts_at
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