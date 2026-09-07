// SurgeShield — Notifier Lambda (objective 3: confirmations, with a circuit breaker)
//
// Consumes the `notify` standard queue (NOT FIFO — confirmation emails have no
// ordering requirement, unlike seat allocation) and calls a mock email provider.
//
// Three properties, in the order the code enforces them:
//
//   1. BREAKER FIRST. If the provider is known-broken we refuse before doing any
//      work at all. A breaker that still calls the provider is just a counter.
//   2. CLAIM BEFORE SEND. `sent#<intentId>` is written with a conditional put
//      BEFORE the provider call, so two concurrent deliveries of the same message
//      cannot both email the user. On failure the claim is DELETED, so a retry is
//      still allowed to send. Same shape as the reconciler's claim-before-allocate.
//   3. REPORT PER-MESSAGE FAILURES. Every record in the batch is attempted, then
//      we hand SQS the ids that failed (ReportBatchItemFailures). Those are
//      redelivered; after maxReceiveCount=3 they land in notify-dlq. The
//      claim/release pair is what makes that retry safe.
//
//      Why not just throw on the first failure, the way the reconciler does?
//      Two reasons. It abandons the rest of the batch, and — because the notify
//      queue's visibility timeout is 60s — it would let the breaker observe only
//      ONE failure per invocation, so a threshold of 5 could take five minutes to
//      reach. It would also redeliver messages that already sent successfully.
//      The reconciler throws because it is FIFO: there, a failure MUST block its
//      message group to preserve ordering. Here, per-message isolation is correct.
//
// BREAKER STATE LIVES IN DYNAMODB, NOT IN MODULE SCOPE. Lambda may run up to 10
// concurrent containers here, and a per-container counter would need 5 failures
// *per container* to trip — the breaker would effectively never open under load.
// `ss_control` is the shared source of truth. Every transition uses a single
// atomic write whose previous value tells us whether WE caused it, so exactly
// one invocation logs each transition.
//
// NOTE ON CONCURRENCY: the account limit is 10 and reserved concurrency cannot be
// set on this function, so we cannot cap the notifier's fan-out at the platform
// level. The breaker is what protects a struggling provider instead — it is a
// deliberate substitute for the throttle we are not allowed to configure.

import fs from 'node:fs';
import pg from 'pg';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { ca: fs.readFileSync(new URL('./global-bundle.pem', import.meta.url), 'utf8') },
});

const ddb = DynamoDBDocument.from(new DynamoDBClient({}),
  { marshallOptions: { removeUndefinedValues: true } });

const CONTROL     = process.env.DDB_CONTROL;
const BREAKER_KEY = 'breaker#email';
const CHAOS_KEY   = 'chaos#email';

const THRESHOLD  = Number(process.env.BREAKER_THRESHOLD ?? 5);      // consecutive failures
const OPEN_MS    = Number(process.env.BREAKER_OPEN_MS   ?? 30000);  // cooldown
const SENT_TTL_S = Number(process.env.SENT_TTL_SECONDS  ?? 86400);  // dedupe window

// ── decision_log ────────────────────────────────────────────────────────────
// Frozen vocabulary. actor='notifier' is what separates these rows from the
// reconciler's on the dashboard.
async function logDecision(eventId, correlationId, action, reason, payload) {
  try {
    await pool.query(
      `INSERT INTO decision_log (event_id, correlation_id, actor, action, reason, payload)
       VALUES ($1, $2, 'notifier', $3, $4, $5)`,
      [eventId ?? null, correlationId ?? null, action, reason ?? null,
       JSON.stringify(payload ?? {})]);
  } catch (e) {
    // The audit log must never be the reason a send is retried. This is exactly
    // the failure mode that broke Gate 1 in the reconciler.
    console.error('decision_log write failed (non-fatal)', action, e.message);
  }
}

// ── breaker ─────────────────────────────────────────────────────────────────
async function readBreaker() {
  const r = await ddb.get({ TableName: CONTROL, Key: { k: BREAKER_KEY }, ConsistentRead: true });
  const it = r.Item ?? {};
  return {
    state:     it.state ?? 'CLOSED',
    fails:     Number(it.fails ?? 0),
    openUntil: Number(it.open_until ?? 0),
  };
}

// Returns 'CLOSED' (send normally) | 'TRIAL' (half-open probe) | 'OPEN' (refuse).
async function breakerGate(now) {
  const b = await readBreaker();
  if (b.state === 'CLOSED') return 'CLOSED';
  if (b.state === 'OPEN' && now < b.openUntil) return 'OPEN';

  // Cooldown elapsed. Move OPEN -> HALF_OPEN conditionally so that exactly ONE
  // invocation gets the probe; everyone else keeps failing fast.
  try {
    await ddb.update({
      TableName: CONTROL, Key: { k: BREAKER_KEY },
      UpdateExpression: 'SET #s = :half',
      ConditionExpression: '#s = :open AND open_until <= :now',
      ExpressionAttributeNames:  { '#s': 'state' },
      ExpressionAttributeValues: { ':half': 'HALF_OPEN', ':open': 'OPEN', ':now': now },
    });
    return 'TRIAL';
  } catch (e) {
    if (e.name !== 'ConditionalCheckFailedException') throw e;
    const b2 = await readBreaker();          // lost the race, or a probe is running
    return b2.state === 'CLOSED' ? 'CLOSED' : 'OPEN';
  }
}

// Atomic increment, then trip if we crossed the threshold. ReturnValues
// UPDATED_OLD tells us whether WE caused the transition, so only one
// invocation writes BREAKER_OPEN.
async function onFailure(now) {
  const inc = await ddb.update({
    TableName: CONTROL, Key: { k: BREAKER_KEY },
    UpdateExpression: 'ADD fails :one',
    ExpressionAttributeValues: { ':one': 1 },
    ReturnValues: 'UPDATED_NEW',
  });
  const fails = Number(inc.Attributes?.fails ?? 0);
  if (fails < THRESHOLD) return { fails, opened: false };

  const trip = await ddb.update({
    TableName: CONTROL, Key: { k: BREAKER_KEY },
    UpdateExpression: 'SET #s = :open, open_until = :until',
    ExpressionAttributeNames:  { '#s': 'state' },
    ExpressionAttributeValues: { ':open': 'OPEN', ':until': now + OPEN_MS },
    ReturnValues: 'UPDATED_OLD',
  });
  // Also covers a failed HALF_OPEN probe: prev='HALF_OPEN' -> re-open for
  // another full cooldown and log it again.
  return { fails, opened: (trip.Attributes?.state ?? 'CLOSED') !== 'OPEN' };
}

// One write closes the breaker and zeroes the counter; the old state tells us
// whether this was a recovery worth logging.
async function onSuccess() {
  const r = await ddb.update({
    TableName: CONTROL, Key: { k: BREAKER_KEY },
    UpdateExpression: 'SET #s = :closed, fails = :zero REMOVE open_until',
    ExpressionAttributeNames:  { '#s': 'state' },
    ExpressionAttributeValues: { ':closed': 'CLOSED', ':zero': 0 },
    ReturnValues: 'UPDATED_OLD',
  });
  return (r.Attributes?.state ?? 'CLOSED') !== 'CLOSED';   // did we just recover?
}

// ── dedupe ──────────────────────────────────────────────────────────────────
async function claimSend(intentId, now) {
  try {
    await ddb.put({
      TableName: CONTROL,
      Item: {
        k: `sent#${intentId}`,
        sent_at: now,
        ttl: Math.floor(now / 1000) + SENT_TTL_S,   // ss_control reaps on `ttl`
      },
      ConditionExpression: 'attribute_not_exists(k)',
    });
    return true;
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') return false;
    throw e;
  }
}

// Release on failure so a redelivery is still allowed to send. Without this a
// single provider blip would permanently suppress that user's email.
async function releaseSend(intentId) {
  try {
    await ddb.delete({ TableName: CONTROL, Key: { k: `sent#${intentId}` } });
  } catch (e) {
    console.error('claim release failed', intentId, e.message);
  }
}

// ── the mock provider ───────────────────────────────────────────────────────
// Fails iff ss_control key `chaos#email` has enabled=true. ConsistentRead so the
// demo reacts on the very next invocation rather than eventually.
async function sendEmailMock({ intentId, userId, eventId }) {
  const c = await ddb.get({ TableName: CONTROL, Key: { k: CHAOS_KEY }, ConsistentRead: true });
  if (c.Item?.enabled === true) {
    throw new Error('email provider unavailable (chaos#email enabled)');
  }
  return { providerMessageId: `mock-${intentId}`, to: `${userId}@example.test`, eventId };
}

// ── one message ─────────────────────────────────────────────────────────────
// Throws if the message should be retried; returns normally if it is done with
// (sent, or a duplicate we deliberately absorbed, or unparseable).
async function processRecord(record) {
  let msg;
  try { msg = JSON.parse(record.body); }
  catch { console.error('unparseable body, dropping:', record.body); return; }

  const { intentId, userId, eventId } = msg;
  const now = Date.now();

  // 1. BREAKER — refuse before touching the provider or claiming a dedupe slot.
  const gate = await breakerGate(now);
  if (gate === 'OPEN') {
    await logDecision(eventId, intentId, 'NOTIFY_FAILED', 'BREAKER_OPEN',
                      { intentId, short_circuited: true });
    console.log(JSON.stringify({ intentId, outcome: 'SHORT_CIRCUITED' }));
    throw new Error(`breaker open, refusing to send ${intentId}`);
  }

  // 2. CLAIM
  if (!await claimSend(intentId, now)) {
    await logDecision(eventId, intentId, 'DUPLICATE_ABSORBED', 'ALREADY_SENT', { intentId });
    console.log(JSON.stringify({ intentId, outcome: 'ALREADY_SENT' }));
    return;
  }

  // 3. SEND
  try {
    const res = await sendEmailMock(msg);
    const recovered = await onSuccess();
    if (recovered) {
      await logDecision(eventId, intentId, 'BREAKER_CLOSED', 'provider recovered',
                        { probe: gate === 'TRIAL' });
    }
    await logDecision(eventId, intentId, 'NOTIFY_SENT', null,
                      { userId, provider_message_id: res.providerMessageId });
    console.log(JSON.stringify({ intentId, outcome: 'SENT', gate }));
  } catch (err) {
    await releaseSend(intentId);
    const { fails, opened } = await onFailure(now);
    await logDecision(eventId, intentId, 'NOTIFY_FAILED', err.message,
                      { consecutive_failures: fails, probe: gate === 'TRIAL' });
    if (opened) {
      await logDecision(eventId, intentId, 'BREAKER_OPEN',
                        `${fails} consecutive failures`,
                        { threshold: THRESHOLD, open_ms: OPEN_MS });
    }
    console.log(JSON.stringify({ intentId, outcome: 'FAILED', fails, opened }));
    throw err;   // reported to SQS below; 3 receives -> notify-dlq
  }
}

// ── handler ─────────────────────────────────────────────────────────────────
// Attempt every record, then tell SQS which ones to redeliver. Records that
// succeeded are deleted from the queue even when a sibling in the same batch
// failed, so a good send is never retried into a duplicate.
export const handler = async (event) => {
  const batchItemFailures = [];
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (e) {
      console.error('notify failed', record.messageId, e.message);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
};
