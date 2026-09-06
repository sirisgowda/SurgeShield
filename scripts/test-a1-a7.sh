#!/usr/bin/env bash
set -e

API_URL="http://localhost:8080"

echo "============================================================"
echo "         SURGESHIELD A1-A7 END-TO-END TEST                  "
echo "============================================================"
echo ""

echo -n "[1/5] Testing GET /healthz... "
H_OUT=$(curl -s "$API_URL/healthz")
echo "$H_OUT" | grep -q '"ok":true' && echo "[PASS]" || echo "[FAIL]"

echo -n "[2/5] Testing GET /readyz (PostgreSQL DB)... "
R_OUT=$(curl -s "$API_URL/readyz")
echo "$R_OUT" | grep -q '"ok":true' && echo "[PASS]" || echo "[FAIL]"

IDEM_KEY="bash-test-$RANDOM"
echo -n "[3/5] Testing POST /api/events/event-1/register... "
REG1=$(curl -s -XPOST "$API_URL/api/events/event-1/register" -H "Idempotency-Key: $IDEM_KEY")
INTENT_ID=$(echo "$REG1" | grep -o '"intent_id":"[^"]*' | cut -d'"' -f4)

if [ -n "$INTENT_ID" ]; then
  echo "[PASS] (Intent ID: $INTENT_ID)"
else
  echo "[FAIL: $REG1]"
  exit 1
fi

echo -n "[4/5] Testing Idempotency (Duplicate Request)... "
REG2=$(curl -s -XPOST "$API_URL/api/events/event-1/register" -H "Idempotency-Key: $IDEM_KEY")
echo "$REG2" | grep -q '"duplicate":true' && echo "[PASS]" || echo "[FAIL]"

echo -n "[5/5] Testing GET /api/intents/:id (DynamoDB Polling)... "
POLL=$(curl -s "$API_URL/api/intents/$INTENT_ID")
echo "$POLL" | grep -q '"status":"QUEUED"' && echo "[PASS]" || echo "[FAIL]"

echo ""
echo "============================================================"
echo "                ALL A1-A7 TESTS COMPLETED                   "
echo "============================================================"
