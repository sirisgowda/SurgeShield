import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../lib/db.js';
import { ddb, INTENTS, CONTROL } from '../lib/ddb.js';
import { sqs, SendMessageCommand } from '../lib/sqs.js';
import { logDecision } from '../lib/log.js';
import { requireAuth } from '../lib/auth.js';
import { statusOf } from './events.js';

const r = Router();
const now = () => Math.floor(Date.now() / 1000);

// ---- inflight counter + mode ----
const T1 = 200, T2 = 600;
export function modeFor(n, prev) {
  if (n >= T2) return 'HIGH';
  if (n >= T1) return 'ELEVATED';
  if (prev === 'HIGH' && n > T2 * 0.7) return 'HIGH';          // hysteresis
  if (prev === 'ELEVATED' && n > T1 * 0.7) return 'ELEVATED';
  return 'NORMAL';
}

async function bumpInflight(delta) {
  try {
    const out = await ddb.update({
      TableName: CONTROL, Key: { k: 'counter#inflight' },
      UpdateExpression: 'ADD n :d', ExpressionAttributeValues: { ':d': delta },
      ReturnValues: 'UPDATED_NEW' });
    return Number(out.Attributes?.n ?? 0);
  } catch (e) {
    console.warn('[DDB Inflight Warning]', e.message);
    return 1;
  }
}

let modeCache = { value: 'NORMAL', at: 0 };
async function applyMode(inflight, eventId) {
  const next = modeFor(inflight, modeCache.value);
  if (next !== modeCache.value) {
    modeCache = { value: next, at: Date.now() };
    try {
      await ddb.put({ TableName: CONTROL,
        Item: { k: 'mode#current', mode: next, at: Date.now() } });
      logDecision({ actor: 'api', action: 'MODE_CHANGE', event_id: eventId,
                    reason: `inflight=${inflight}`, payload: { mode: next, inflight } });
    } catch {}
  }
  return next;
}

// ---- the registration endpoint ----
r.post('/events/:id/register', requireAuth(), async (req, res, next) => {
  try {
    // RBAC: Only attendees are permitted to register for tickets
    if (req.user.role === 'organizer') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Organizers cannot book tickets. Please use an Attendee account to reserve seats.'
      });
    }

    const eventId = req.params.id, userId = req.user.sub;
    const key = req.headers['idempotency-key'] || crypto.randomUUID();
    const idemKey = 'idem#' + crypto.createHash('sha256')
      .update(`${userId}:${eventId}:${key}`).digest('hex');

    // 1. registration window — verified against real PostgreSQL database
    const { rows } = await db.query('SELECT * FROM events WHERE id=$1', [eventId]);
    if (!rows.length) return res.status(404).json({ error: 'NO_SUCH_EVENT', message: 'Event not found.' });
    
    const evt = rows[0];
    const st = statusOf(evt);
    if (st === 'SCHEDULED') {
      return res.status(409).json({ error: 'REGISTRATION_CLOSED', message: 'Registration has not opened yet.', status: st });
    }
    if (st === 'CLOSED') {
      return res.status(409).json({ error: 'REGISTRATION_CLOSED', message: 'Registration is now closed for this event.', status: st });
    }
    if (evt.seats_left <= 0) {
      return res.status(409).json({ error: 'SOLD_OUT', message: 'This event is completely sold out.', status: 'SOLD_OUT' });
    }

    // Check if user is already registered for this event
    const existing = await db.query(
      'SELECT id, status FROM registrations WHERE event_id=$1 AND user_id=$2 AND status=$3',
      [eventId, userId, 'CONFIRMED']
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'ALREADY_REGISTERED',
        message: 'You already have a confirmed ticket for this event.'
      });
    }

    // 2. idempotency — conditional put wins or returns the original
    const intentId = crypto.randomUUID();
    try {
      await ddb.put({ TableName: CONTROL,
        Item: { k: idemKey, intent_id: intentId, ttl: now() + 600 },
        ConditionExpression: 'attribute_not_exists(k)' });
    } catch (e) {
      if (e.name === 'ConditionalCheckFailedException') {
        const prev = await ddb.get({ TableName: CONTROL, Key: { k: idemKey } });
        logDecision({ actor:'api', action:'DUPLICATE_ABSORBED',
                      event_id:eventId, correlation_id:prev.Item.intent_id });
        return res.status(200).json({ intent_id: prev.Item.intent_id, duplicate: true, status: 'CONFIRMED' });
      }
    }

    // 3. Inflight counter & Mode
    const inflight = await bumpInflight(1);
    const mode = await applyMode(inflight, eventId);

    // Store in DDB
    try {
      await ddb.put({ TableName: INTENTS, Item: {
        intent_id: intentId, event_id: eventId, user_id: userId,
        status: 'PENDING', position: inflight, ttl: now() + 86400 }});
    } catch (e) {
      console.warn('[DDB Intent Put Warning]', e.message);
    }

    // 4. Enqueue to SQS if configured
    if (process.env.INTENT_QUEUE_URL) {
      try {
        await sqs.send(new SendMessageCommand({
          QueueUrl: process.env.INTENT_QUEUE_URL,
          MessageGroupId: eventId,
          MessageDeduplicationId: intentId,
          MessageBody: JSON.stringify({ intentId, eventId, userId, ts: Date.now() })
        }));
      } catch (sqsErr) {
        console.warn('[SQS Send Warning]', sqsErr.message);
      }
    }

    // 5. NO SEAT MATH ON THE REQUEST PATH.
    //
    // This used to INSERT the registration and decrement seats_left inline.
    // That bypassed the reconciler entirely: the row already existed by the
    // time the SQS message arrived, so every message took the ON CONFLICT
    // branch and logged DUPLICATE_ABSORBED instead of SEAT_GRANTED. Symptoms
    // were registrations.intent_id NULL and no NOTIFY_SENT ever firing.
    //
    // It was also unsafe. `GREATEST(0, seats_left - 1)` floors at zero rather
    // than refusing, so two concurrent requests for the last seat both passed
    // the seats_left > 0 check, both inserted, and both decremented - the
    // overbooking the FIFO single-writer design exists to prevent.
    //
    // The seat is now allocated exactly where it should be: by the reconciler,
    // single-writer per event via MessageGroupId, claim-before-allocate.

    logDecision({ actor:'api', action:'INTENT_ACCEPTED', event_id:eventId,
                  correlation_id:intentId, payload:{ inflight, mode } });

    res.status(202).json({
      intent_id: intentId,
      position: inflight,
      mode,
      // PENDING, not CONFIRMED: at this point the seat has not been allocated
      // yet. The client polls GET /api/intents/:id for the real outcome, which
      // the reconciler writes via syncStatus (typically well under a second).
      status: 'PENDING',
      message: 'Registration received.'
    });
  } catch (e) { next(e); }
});

// ---- status polling: DynamoDB ----
r.get('/intents/:id', async (req, res, next) => {
  try {
    const out = await ddb.get({ TableName: INTENTS, Key: { intent_id: req.params.id } });
    if (!out?.Item) return res.status(404).json({ error: 'NOT_FOUND', message: 'Intent not found' });
    const { status, position, reason, event_id } = out.Item;
    res.json({ status, position, reason, event_id, mode: modeCache.value });
  } catch (e) { next(e); }
});

export default r;
