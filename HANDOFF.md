# SurgeShield — Handoff Brief

I'm "B" on a 4-person hackathon team. Deadline **Mon 11:00 IST** (code freeze 07:00).
I own the database schema and the reconciler Lambda — the correctness core.
Read this, then get me to Gate 1 passing.

---

## The architecture in one paragraph

Event registration platform that must stay available under a traffic surge.
**Core principle: never do seat math on the request path.** The API accepts a
registration, writes an intent, drops a message on an SQS **FIFO** queue with
`MessageGroupId = event_id`, and returns `202` — it never touches the seat
counter, so it cannot overbook and cannot be slow. A **Reconciler Lambda**
consumes that queue; because the message group is the event id, AWS guarantees
exactly one consumer per event, which gives single-writer seat allocation with
no locks. It claims `(event_id, user_id)` via a unique constraint, and only then
decrements `seats_left`. Confirmations go out on a second SQS queue with retries,
a DLQ and a circuit breaker.

## Current state

**Working**
- All AWS resources exist in `ap-south-1`: RDS Postgres, SQS `intents.fifo` +
  `intents-dlq.fifo`, SQS `notify` + `notify-dlq`, DynamoDB `ss_intents` and
  `ss_control` (TTL on `ttl`), IAM role `surgeshield-lambda`, ECR repo.
- Lambda `surgeshield-reconciler` is deployed with the real allocation logic and
  an SQS event-source mapping on `intents.fifo`.
- Verified end to end earlier: SQS → Lambda → RDS over TLS (`SKELETON_OK` row in
  `decision_log`).
- `decision_log` has ~206 rows including a seeded fake surge another teammate is
  building a dashboard against. **Do not delete `decision_log` rows.**

**Broken / unknown**
- A test message for `event_id='gate1-event'` was sent but no `registrations`
  row appeared and `seats_left` is still 1. Cause not yet diagnosed — check
  `aws logs tail /aws/lambda/surgeshield-reconciler --since 15m` first.
- Earlier failures already fixed: PowerShell mangled JSON passed as a CLI
  argument (now always use `--cli-input-json file://...`), and a poison message
  with a non-UUID event id was retrying (queue was purged).

## Hard constraints — do not violate these

1. **Never `DROP TABLE`.** Another teammate's app creates `events` and
   `registrations` with their own shape. We adapted *additively* — four columns
   added: `events.registration_opens_at`, `events.registration_closes_at`,
   `registrations.intent_id`, `registrations.reason_code`. Keep it that way.
2. **`events.id`, `registrations.event_id` and `registrations.user_id` are
   `varchar(64)`, not UUID.** Don't cast them.
3. **Event status is DERIVED** from `registration_opens_at` / `_closes_at` at
   read time. There is a stored `events.status` column from the other schema —
   ignore it, never write to it.
4. **The Records loop in the reconciler must stay serial.** No `Promise.all` —
   that discards the FIFO ordering the whole design depends on.
5. **Claim before allocate.** Insert the registration row with
   `ON CONFLICT (event_id,user_id) DO NOTHING RETURNING id` *first*; only
   decrement `seats_left` if that returned a row. Decrementing first leaks a seat
   on repeat requests.
6. Lambda account concurrency limit is **10** — reserved concurrency cannot be set.
7. Never commit `.env.shared`, `env.ps1`, or any AWS key.

## Files

```
env.ps1                     # dot-source it: sets $PG, $Q, $env:PGPASSWORD, region
.env.shared                 # DATABASE_URL, queue URLs, table names (gitignored)
global-bundle.pem           # RDS CA bundle; must also be inside the Lambda zip
001_schema.sql              # original schema (superseded — table already existed)
002_seed_fake_surge.sql     # seeds decision_log for the dashboard
003_gate1_fixture.sql       # creates 'gate1-event' with ONE seat
005_additive.sql            # the four added columns
deploy-reconciler.ps1       # zip + create/update Lambda + wire event source
gate1.ps1                   # THE TEST: 200 intents at 1 seat, prints PASS/FAIL
lambdas/reconciler/index.mjs
```

Environment: Windows, PowerShell 5.1, AWS CLI v2, Node 20, region `ap-south-1`.

## Your objective, in order

1. **Diagnose why the single test message didn't produce a registration.**
   Start with CloudWatch logs, then queue depth
   (`ApproximateNumberOfMessages`, `...NotVisible`) and the DLQ.
2. **Get `.\gate1.ps1` to PASS**: exactly 1 CONFIRMED, 199 WAITLISTED,
   `seats_left = 0`, 200 rows, DLQ empty. Run it three times — intermittent
   passes mean a real bug.
3. Then build the **notifier Lambda**: consumes SQS `notify`, mock email provider
   that fails when DynamoDB `ss_control` key `chaos#email` is enabled, circuit
   breaker (5 consecutive failures → open 30s → half-open), dedupe on
   `sent#<intentId>`, and `BREAKER_OPEN` / `BREAKER_CLOSED` / `NOTIFY_SENT` rows
   in `decision_log`.
4. Then an **invariants endpoint/query**: no overbooking, no double registration,
   `seats_left = total_seats - count(CONFIRMED)`.

## decision_log — the vocabulary is frozen

`INTENT_ACCEPTED · DUPLICATE_ABSORBED · MODE_CHANGE · SEAT_GRANTED · SEAT_DENIED ·
NOTIFY_SENT · NOTIFY_FAILED · BREAKER_OPEN · BREAKER_CLOSED · DLQ · SCALE ·
CHAOS_ON · CHAOS_OFF`

Columns: `ts, event_id, correlation_id, actor, action, reason, payload (jsonb)`.
Another teammate's dashboard reads exactly these strings — don't rename any.

## How I need you to work

- Explain what you changed and why, briefly. I have to defend every line of this
  in a 5-minute code walkthrough with a senior engineer, so no cleverness I can't
  explain.
- Windows quoting is a recurring trap: pass JSON to the AWS CLI via
  `--cli-input-json file://x.json`, never as an inline argument.
- Small steps. Run the verification after each change rather than batching.
