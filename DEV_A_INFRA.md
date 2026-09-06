# Dev A — Infrastructure & Ingest · Runbook

You own AWS, the API skeleton, the ingest endpoint, and the load harness.
**Everyone else is blocked on you until 10:30.** Do A1 and A2 fast, then breathe.

---

## Setup (do this first, 10 minutes)

```bash
aws configure          # region: ap-south-1 (Mumbai — lowest latency for you)
aws sts get-caller-identity   # must return your account. If not, stop and fix.
node -v                # need 20+
docker -v
export AWS_REGION=ap-south-1
export ACCT=$(aws sts get-caller-identity --query Account --output text)
```

Repo layout — create this now and push to GitHub so everyone clones the same thing:

```
surgeshield/
├── api/          src/{lib,routes}/  index.js  Dockerfile  package.json
├── lambdas/      reconciler/  notifier/
├── web/          (C creates — Vite React)
├── migrations/   001.sql
├── load/         surge.js
└── .env.example
```

---

## A1 · 09:00–09:30 — Create all AWS resources

**Start RDS first.** It takes ~10 minutes; everything else runs while it provisions.

```bash
# ---------- RDS (START THIS FIRST) ----------
aws rds create-db-instance \
  --db-instance-identifier surgeshield-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --master-username surgeshield \
  --master-user-password 'CHANGE_ME_LongPassword123' \
  --allocated-storage 20 \
  --db-name surgeshield \
  --publicly-accessible \
  --backup-retention-period 0

# ---------- DynamoDB ----------
aws dynamodb create-table --table-name ss_intents \
  --attribute-definitions AttributeName=intent_id,AttributeType=S \
  --key-schema AttributeName=intent_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
aws dynamodb create-table --table-name ss_control \
  --attribute-definitions AttributeName=k,AttributeType=S \
  --key-schema AttributeName=k,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# TTL — the one job TTL is actually right for
for t in ss_intents ss_control; do
  aws dynamodb update-time-to-live --table-name $t \
    --time-to-live-specification "Enabled=true,AttributeName=ttl"
done

# ---------- SQS: DLQs first, then main queues ----------
aws sqs create-queue --queue-name intents-dlq.fifo \
  --attributes FifoQueue=true
DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name intents-dlq.fifo --output text) \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

aws sqs create-queue --queue-name intents.fifo --attributes "$(cat <<EOF
{"FifoQueue":"true","VisibilityTimeout":"60",
 "RedrivePolicy":"{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"3\"}"}
EOF
)"

aws sqs create-queue --queue-name notify-dlq
NDLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name notify-dlq --output text) \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)
aws sqs create-queue --queue-name notify --attributes "$(cat <<EOF
{"VisibilityTimeout":"60",
 "RedrivePolicy":"{\"deadLetterTargetArn\":\"$NDLQ_ARN\",\"maxReceiveCount\":\"3\"}"}
EOF
)"

# ---------- ECR ----------
aws ecr create-repository --repository-name surgeshield-api
```

Now open RDS security: get the SG and allow 5432.

```bash
aws rds wait db-instance-available --db-instance-identifier surgeshield-db   # ~10 min
RDS_HOST=$(aws rds describe-db-instances --db-instance-identifier surgeshield-db \
  --query 'DBInstances[0].Endpoint.Address' --output text)
SG=$(aws rds describe-db-instances --db-instance-identifier surgeshield-db \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $SG \
  --protocol tcp --port 5432 --cidr 0.0.0.0/0
echo "postgresql://surgeshield:CHANGE_ME_LongPassword123@$RDS_HOST:5432/surgeshield"
```

> `0.0.0.0/0` is deliberate: App Runner has no static egress IP without a VPC connector,
> and setting that up costs an hour. **Write this in the README as a disclosed hackathon
> trade-off** with the production answer (VPC connector + private subnet). Evaluators
> respect a named trade-off; they punish an unnoticed hole.

### 🔴 Post in chat by 09:30

```
DATABASE_URL=postgresql://surgeshield:...@surgeshield-db.xxx.ap-south-1.rds.amazonaws.com:5432/surgeshield
INTENT_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/<acct>/intents.fifo
NOTIFY_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/<acct>/notify
DDB_INTENTS=ss_intents
DDB_CONTROL=ss_control
AWS_REGION=ap-south-1
JWT_SECRET=<generate one>
```

---

## A2 · 09:30–10:30 — API skeleton + shared libs

```bash
cd api && npm init -y
npm i express cors pg jsonwebtoken bcryptjs google-auth-library \
      @aws-sdk/client-sqs @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb dotenv
npm i -D nodemon
```

`api/src/lib/db.js`
```js
import pg from 'pg';
export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,                          // 10 App Runner instances x 5 = 50 connections
  ssl: { rejectUnauthorized: false }
});
```

`api/src/lib/ddb.js`
```js
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
export const ddb = DynamoDBDocument.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
  { marshallOptions: { removeUndefinedValues: true } });
export const INTENTS = process.env.DDB_INTENTS;
export const CONTROL = process.env.DDB_CONTROL;
```

`api/src/lib/sqs.js`
```js
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
export const sqs = new SQSClient({ region: process.env.AWS_REGION });
export { SendMessageCommand };
```

`api/src/lib/log.js` — **every component calls this. Fire and forget; never block a request.**
```js
import { db } from './db.js';
export function logDecision({ event_id=null, correlation_id=null,
                              actor, action, reason=null, payload={} }) {
  db.query(
    `INSERT INTO decision_log (event_id,correlation_id,actor,action,reason,payload)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [event_id, correlation_id, actor, action, reason, JSON.stringify(payload)]
  ).catch(e => console.error('decision_log failed', e.message));
}
```

`api/src/index.js`
```js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './lib/db.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/healthz', (_, res) => res.json({ ok: true }));
app.get('/readyz', async (_, res) => {
  try { await db.query('SELECT 1'); res.json({ ok: true }); }
  catch (e) { res.status(503).json({ ok: false, error: e.message }); }
});

// C mounts these:  app.use('/api/auth', authRouter); app.use('/api/events', eventsRouter);
// D mounts these:  app.use('/api/ops', opsRouter);
// You mount:       app.use('/api', registerRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'INTERNAL', message: err.message });
});

app.listen(process.env.PORT || 8080, () => console.log('api up'));
```

**Push and tell C and D it's ready.** They run `npm run dev` locally against the real AWS resources.

---

## A3 · 10:30–11:30 — Deploy to App Runner

`api/Dockerfile`
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "src/index.js"]
```

```bash
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ACCT.dkr.ecr.$AWS_REGION.amazonaws.com
docker build --platform linux/amd64 -t surgeshield-api ./api
docker tag surgeshield-api:latest $ACCT.dkr.ecr.$AWS_REGION.amazonaws.com/surgeshield-api:latest
docker push $ACCT.dkr.ecr.$AWS_REGION.amazonaws.com/surgeshield-api:latest
```

> `--platform linux/amd64` matters if you're on an M-series Mac. Without it App Runner
> silently fails to start the container and you lose 30 minutes.

**Create the service in the AWS console** — faster than the CLI JSON for the first
creation. Settings:

- Source: ECR, your image, **automatic deployment ON**
- Port **8080**, health check path `/healthz`
- Instance: 1 vCPU / 2 GB
- **Auto scaling → create new config:** `Max concurrency 40`, `Min size 1`, `Max size 10`
- Environment variables: paste everything from A1

Low max-concurrency is deliberate — it makes scale-out happen early and *visibly*, which
is what the demo needs to show.

**Done when:** `curl https://<id>.ap-south-1.awsapprunner.com/healthz` returns `{"ok":true}`.
Post the URL in chat.

---

## A4 · 11:30–12:00 — Frontend hosting for C

Use **AWS Amplify Hosting**, not S3+CloudFront. It gives HTTPS out of the box (Google
Sign-In *requires* HTTPS) and auto-deploys from GitHub. Console → Amplify → Host web app
→ connect the repo → set:

- Base directory: `web`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL` = your App Runner URL

**Done when:** C's placeholder app is live on the `https://main.xxxx.amplifyapp.com` URL.

---

## A5–A7 · 12:00–15:30 — The ingest endpoint

`api/src/routes/register.js` — full implementation:

```js
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
  const out = await ddb.update({
    TableName: CONTROL, Key: { k: 'counter#inflight' },
    UpdateExpression: 'ADD n :d', ExpressionAttributeValues: { ':d': delta },
    ReturnValues: 'UPDATED_NEW' });
  return Number(out.Attributes?.n ?? 0);
}

let modeCache = { value: 'NORMAL', at: 0 };
async function applyMode(inflight, eventId) {
  const next = modeFor(inflight, modeCache.value);
  if (next !== modeCache.value) {
    modeCache = { value: next, at: Date.now() };
    await ddb.put({ TableName: CONTROL,
      Item: { k: 'mode#current', mode: next, at: Date.now() } });
    logDecision({ actor: 'api', action: 'MODE_CHANGE', event_id: eventId,
                  reason: `inflight=${inflight}`, payload: { mode: next, inflight } });
  }
  return next;
}

// ---- the endpoint ----
r.post('/events/:id/register', requireAuth(), async (req, res, next) => {
  try {
    const eventId = req.params.id, userId = req.user.sub;
    const key = req.headers['idempotency-key'] || crypto.randomUUID();
    const idemKey = 'idem#' + crypto.createHash('sha256')
      .update(`${userId}:${eventId}:${key}`).digest('hex');

    // 1. registration window — derived, no scheduler
    const { rows } = await db.query('SELECT * FROM events WHERE id=$1', [eventId]);
    if (!rows.length) return res.status(404).json({ error: 'NO_SUCH_EVENT' });
    const st = statusOf(rows[0]);
    if (st === 'SCHEDULED' || st === 'CLOSED')
      return res.status(409).json({ error: 'REGISTRATION_CLOSED', status: st });

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
        return res.status(200).json({ intent_id: prev.Item.intent_id, duplicate: true });
      }
      throw e;
    }

    // 3. QUEUED record BEFORE the send, so an instant poll never 404s
    const inflight = await bumpInflight(1);
    const mode = await applyMode(inflight, eventId);
    await ddb.put({ TableName: INTENTS, Item: {
      intent_id: intentId, event_id: eventId, user_id: userId,
      status: 'QUEUED', position: inflight, ttl: now() + 86400 }});

    // 4. enqueue — MessageGroupId = event_id IS the architecture
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.INTENT_QUEUE_URL,
      MessageGroupId: eventId,
      MessageDeduplicationId: intentId,
      MessageBody: JSON.stringify({ intentId, eventId, userId, ts: Date.now() })
    }));

    logDecision({ actor:'api', action:'INTENT_ACCEPTED', event_id:eventId,
                  correlation_id:intentId, payload:{ inflight, mode } });

    res.status(202).json({ intent_id: intentId, position: inflight, mode });
  } catch (e) { next(e); }
});

// ---- status polling: DynamoDB ONLY. Never Postgres. ----
r.get('/intents/:id', async (req, res, next) => {
  try {
    const out = await ddb.get({ TableName: INTENTS, Key: { intent_id: req.params.id } });
    if (!out.Item) return res.status(404).json({ error: 'NOT_FOUND' });
    const { status, position, reason, event_id } = out.Item;
    res.json({ status, position, reason, event_id, mode: modeCache.value });
  } catch (e) { next(e); }
});

export default r;
```

**Test it:**
```bash
TOKEN=<from C's login endpoint>
curl -s -XPOST $API/api/events/$EVENT/register \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: test-1" | jq
# run twice — second call must return the SAME intent_id with duplicate:true
```

---

## A8 · 15:30–17:00 — Gate 1 with B

`load/gate1.sh` — 200 parallel registrations at a 1-seat event:

```bash
#!/bin/bash
# usage: ./gate1.sh <api-url> <event-id> <token>
API=$1; EVENT=$2; TOKEN=$3
seq 1 200 | xargs -P 200 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  -XPOST "$API/api/events/$EVENT/register" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: gate1-{}" | sort | uniq -c
sleep 8
psql "$DATABASE_URL" -c "
  SELECT status, count(*) FROM registrations WHERE event_id='$EVENT' GROUP BY 1;
  SELECT seats_left FROM events WHERE id='$EVENT';"
```

**Pass condition:** 200× `202`, exactly 1 `CONFIRMED`, 199 `WAITLISTED`, `seats_left = 0`.
Run it five times. Different users each run (or reset the table between runs — the
`UNIQUE(event_id,user_id)` constraint will otherwise dedupe).

---

## A9 · 17:00–18:00 — Chaos + readiness

```js
// api/src/routes/ops-chaos.js
r.post('/chaos', requireAuth('organizer'), async (req, res) => {
  const { target, enabled } = req.body;           // 'email' | 'latency'
  await ddb.put({ TableName: CONTROL, Item: { k: `chaos#${target}`, enabled } });
  logDecision({ actor:'chaos', action: enabled ? 'CHAOS_ON' : 'CHAOS_OFF',
                reason: target });
  res.json({ target, enabled });
});
```

Upgrade `/readyz` to check all three dependencies (DB, SQS, DynamoDB) so App Runner pulls
a genuinely broken instance out of rotation.

---

## A10 · 18:00–19:30 — Load harness

`load/surge.js`
```js
import http from 'k6/http';
import { check } from 'k6';
export const options = { stages: [
  { duration: '10s', target: 200 },
  { duration: '20s', target: 5000 },
  { duration: '30s', target: 5000 },
  { duration: '20s', target: 0 },
]};
export default function () {
  const r = http.post(`${__ENV.API}/api/events/${__ENV.EVENT}/register`, null, {
    headers: { Authorization: `Bearer ${__ENV.TOKEN}`,
               'Idempotency-Key': `${__VU}-${__ITER}` }});
  check(r, { accepted: x => x.status === 202 || x.status === 200 });
}
```
```bash
brew install k6   # or: docker run -i grafana/k6 run - < load/surge.js
API=$API EVENT=$EVENT TOKEN=$TOKEN k6 run load/surge.js
```

**Start at 200 VUs, not 5000.** Confirm 100% `202` before scaling up.

---

## A11 · 19:30–21:00 — Scale watcher + connection audit

```js
// scripts/scale-watch.js — run on your laptop during load tests
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
setInterval(async () => {
  const out = await cw.send(new GetMetricStatisticsCommand({
    Namespace: 'AWS/AppRunner', MetricName: 'ActiveInstances',
    Dimensions: [{ Name: 'ServiceName', Value: 'surgeshield-api' }],
    StartTime: new Date(Date.now() - 120000), EndTime: new Date(),
    Period: 60, Statistics: ['Maximum'] }));
  const n = out.Datapoints.at(-1)?.Maximum;
  if (n !== undefined && n !== last) {
    logDecision({ actor:'autoscaler', action:'SCALE',
                  reason:'concurrency threshold', payload:{ from:last, to:n }});
    last = n;
  }
}, 10000);
```

**Connection audit — do this before the 2000 VU run:**
```bash
psql "$DATABASE_URL" -c "SHOW max_connections; SELECT count(*) FROM pg_stat_activity;"
aws lambda put-function-concurrency --function-name surgeshield-reconciler \
  --reserved-concurrent-executions 10
aws lambda put-function-concurrency --function-name surgeshield-notifier \
  --reserved-concurrent-executions 5
```
App Runner max 10 × pool 5 = 50, plus Lambda 15 = 65, under the ~80 limit. If you see
`too many connections`, lower the App Runner max size before touching anything else.

---

## A12–A13 · 21:00–07:00 (sleep 01:00–05:00)

Load runs at 500 → 2000 → 5000. After the final run, fill in `ARCHITECTURE.md` §12:

```sql
SELECT count(*) FILTER (WHERE action='INTENT_ACCEPTED') AS accepted,
       count(*) FILTER (WHERE action='SEAT_GRANTED')    AS confirmed,
       count(*) FILTER (WHERE action='DUPLICATE_ABSORBED') AS duplicates
FROM decision_log WHERE ts > now() - interval '10 minutes';
```

Cost: instance-minutes × App Runner rate + RDS hourly + a few cents of DynamoDB/SQS.
Round it honestly and put it on the closing slide.

---

## Common failures and the 30-second fix

| Symptom | Cause | Fix |
|---|---|---|
| App Runner stuck "Operation in progress" | Wrong CPU architecture | Rebuild with `--platform linux/amd64` |
| `ECONNREFUSED` to RDS | SG rule missing | `authorize-security-group-ingress` port 5432 |
| `self signed certificate` | RDS SSL | `ssl: { rejectUnauthorized: false }` in the pool |
| `too many connections` | Pools uncapped | Lower App Runner max size, set reserved concurrency |
| SQS send succeeds, Lambda silent | Event source mapping missing | `aws lambda create-event-source-mapping` |
| `MessageGroupId` error | FIFO queue needs it on every send | It's already in the code — check you're hitting the right queue |
