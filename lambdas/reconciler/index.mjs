// SurgeShield — Reconciler Lambda (B4/B5: the real allocation transaction)
//
// This is the only process in the system that writes events.seats_left.
// It is only ever ONE process per event, because the intent queue is SQS FIFO
// with MessageGroupId = event_id, and AWS guarantees one active consumer per
// message group. That guarantee — not clever SQL — is where our no-overbooking
// property comes from. There is no race to lose.
//
// Two deliberate choices you will be asked about:
//   1. Pool at MODULE scope so warm invocations reuse connections (max 2).
//   2. The Records loop is SERIAL. Promise.all would discard the FIFO ordering
//      that is the entire reason we chose a FIFO queue.

import fs from 'node:fs';
import pg from 'pg';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { ca: fs.readFileSync(new URL('./global-bundle.pem', import.meta.url), 'utf8') },
});

const ddb = DynamoDBDocument.from(new DynamoDBClient({}),
  { marshallOptions: { removeUndefinedValues: true } });
const sqs = new SQSClient({});

const INTENTS = process.env.DDB_INTENTS;
const CONTROL = process.env.DDB_CONTROL;

// Runs after the transaction commits: publish the outcome to the fast read path
// the client is polling, and release the in-flight slot.
async function syncStatus(intentId, status, reason) {
  try {
    await ddb.update({
      TableName: INTENTS,
      Key: { intent_id: intentId },
      UpdateExpression: 'SET #s = :s, reason = :r',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': status, ':r': reason ?? null },
    });
    await ddb.update({
      TableName: CONTROL,
      Key: { k: 'counter#inflight' },
      UpdateExpression: 'ADD n :d',
      ExpressionAttributeValues: { ':d': -1 },
    });
  } catch (e) {
    // Never fail the batch over the read-path mirror: Postgres is the source of
    // truth and already committed. Worst case the client polls a stale status.
    console.error('ddb sync failed (non-fatal)', intentId, e.message);
  }
}

export const handler = async (event) => {
  for (const record of event.Records) {
    let msg;
    try { msg = JSON.parse(record.body); }
    catch { console.error('unparseable body, dropping:', record.body); continue; }

    const { intentId, eventId, userId } = msg;
    let status, reason = null, seatsLeft = null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ── STEP 1: CLAIM ────────────────────────────────────────────────────
      // Insert the (event_id, user_id) row FIRST. The unique constraint is the
      // gate, not an afterthought. If this is a no-op the user already holds a
      // registration, so we must not decrement — decrementing first would leak
      // a seat on any repeat request after the idempotency window expires.
      const claim = await client.query(
        `INSERT INTO registrations (event_id, user_id, intent_id, status)
         VALUES ($1, $2, $3, 'PENDING')
         ON CONFLICT (event_id, user_id) DO NOTHING
         RETURNING id`,
        [eventId, userId, intentId]);

      if (claim.rows.length === 0) {
        const prev = await client.query(
          `SELECT status FROM registrations WHERE event_id = $1 AND user_id = $2`,
          [eventId, userId]);
        status = prev.rows[0]?.status ?? 'CONFIRMED';
        reason = 'ALREADY_REGISTERED';

        await client.query(
          `INSERT INTO decision_log (event_id, correlation_id, actor, action, reason, payload)
           VALUES ($1, $2, 'reconciler', 'DUPLICATE_ABSORBED', $3, $4)`,
          [eventId, intentId, reason, JSON.stringify({ existing_status: status })]);

        await client.query('COMMIT');
      } else {
        // ── STEP 2: ALLOCATE ───────────────────────────────────────────────
        // One guarded statement covering capacity AND the registration window.
        // Zero rows back means "no seat for you" — we then read why.
        const upd = await client.query(
          `UPDATE events SET seats_left = seats_left - 1
            WHERE id = $1
              AND seats_left > 0
              AND now() >= registration_opens_at
              AND now() <  registration_closes_at
          RETURNING seats_left`, [eventId]);

        if (upd.rows.length) {
          status = 'CONFIRMED';
          seatsLeft = upd.rows[0].seats_left;
        } else {
          const ev = await client.query(
            `SELECT seats_left,
                    now() <  registration_opens_at  AS early,
                    now() >= registration_closes_at AS late
               FROM events WHERE id = $1`, [eventId]);
          const e = ev.rows[0];
          if (!e) { status = 'REJECTED'; reason = 'NO_SUCH_EVENT'; }
          else if (e.early) { status = 'REJECTED'; reason = 'NOT_OPEN'; }
          else if (e.late)  { status = 'REJECTED'; reason = 'WINDOW_CLOSED'; }
          else { status = 'WAITLISTED'; reason = 'SOLD_OUT'; }
          seatsLeft = e?.seats_left ?? null;
        }

        await client.query(
          `UPDATE registrations SET status = $1, reason_code = $2 WHERE id = $3`,
          [status, reason, claim.rows[0].id]);

        await client.query(
          `INSERT INTO decision_log (event_id, correlation_id, actor, action, reason, payload)
           VALUES ($1, $2, 'reconciler', $3, $4, $5)`,
          [eventId, intentId,
           status === 'CONFIRMED' ? 'SEAT_GRANTED' : 'SEAT_DENIED',
           reason, JSON.stringify({ seats_left: seatsLeft, status })]);

        await client.query('COMMIT');
      }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('reconcile failed', intentId, e.message);
      throw e;   // SQS redelivers; 3 failures → DLQ. The claim makes retry safe.
    } finally {
      client.release();
    }

    await syncStatus(intentId, status, reason);

    if (status === 'CONFIRMED' && process.env.NOTIFY_QUEUE_URL) {
      try {
        await sqs.send(new SendMessageCommand({
          QueueUrl: process.env.NOTIFY_QUEUE_URL,
          MessageBody: JSON.stringify({ intentId, userId, eventId }),
        }));
      } catch (e) {
        console.error('notify enqueue failed (non-fatal)', intentId, e.message);
      }
    }

    console.log(JSON.stringify({ intentId, eventId, status, reason, seatsLeft }));
  }
};
