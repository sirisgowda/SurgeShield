# GATE 2 - duplicate absorption. Proves claim-before-allocate does not leak seats.
#
# Gate 1 sends 200 DISTINCT users, so it never once takes the ON CONFLICT branch.
# This gate sends the SAME userId three times with three DIFFERENT intentIds
# against a 5-seat event - the repeat-request case the design is built for.
#
# PASS = 1 CONFIRMED row for that user, seats_left = 4, 2 DUPLICATE_ABSORBED
#        rows, and seats_left = total_seats - count(CONFIRMED).
#
# WHY seats_left = 4 IS THE WHOLE POINT:
#   Claim first (what we do):     insert wins once  -> decrement once  -> 4 left.
#   Decrement first (the bug):    decrement 3 times -> insert wins once -> 2 left,
#                                 two seats leaked and unrecoverable.
#   A 5-seat event is used so a leak shows up as a wrong number rather than
#   hiding behind SOLD_OUT at the zero floor.
#
# Usage:  . .\env.ps1  ;  .\gate2_duplicate.ps1

$ErrorActionPreference = "Continue"
$EVENT = "gate2-event"
$USER  = "gate2-user-1"
$N     = 3

Write-Host "== resetting fixture ==" -Foreground Cyan
psql $PG -v ON_ERROR_STOP=1 -f .\007_gate2_fixture.sql
if ($LASTEXITCODE -ne 0) { Write-Host "fixture failed" -Foreground Red; exit 1 }

Write-Host "== sending $N intents, all for the SAME user ($USER) ==" -Foreground Cyan
for ($i = 1; $i -le $N; $i++) {
  # Distinct intentId per send: these are three genuinely separate requests
  # (retry / double-click / replay), NOT one message redelivered. A shared
  # MessageDeduplicationId would let SQS swallow them and prove nothing.
  $intentId = [guid]::NewGuid().ToString()
  $body = ConvertTo-Json -InputObject @{ intentId = $intentId; eventId = $EVENT; userId = $USER } -Compress
  $req  = @{
    QueueUrl               = $Q
    MessageGroupId         = $EVENT   # same group => strict order, one consumer
    MessageBody            = $body
    MessageDeduplicationId = $intentId
  }
  # --cli-input-json file://... : never pass JSON as an inline CLI argument here.
  ConvertTo-Json -InputObject $req -Depth 5 | Set-Content -Encoding ascii "$env:TEMP\gate2-msg.json"
  $resp = aws sqs send-message --cli-input-json "file://$env:TEMP\gate2-msg.json" | Out-String
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  send #$i failed (exit $LASTEXITCODE)" -Foreground Red
    Write-Host $resp; exit 1
  }
  Write-Host "  sent #$i  intentId=$intentId"
}

# Drain on decision_log, NOT on registrations: two of these three requests
# correctly produce no registration row, so a row count would stall at 1.
Write-Host "== draining (waiting up to 60s) ==" -Foreground Cyan
$deadline = (Get-Date).AddSeconds(60)
do {
  Start-Sleep 3
  $done = psql $PG -tAc "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action IN ('SEAT_GRANTED','SEAT_DENIED','DUPLICATE_ABSORBED');"
  Write-Host "  decisions logged $done / $N"
} while ([int]$done -lt $N -and (Get-Date) -lt $deadline)

Write-Host ""
Write-Host "== RESULT ==" -Foreground Cyan
psql $PG -c "SELECT user_id, status, reason_code, count(*) FROM registrations WHERE event_id='$EVENT' GROUP BY 1,2,3 ORDER BY 1;"
psql $PG -c "SELECT action, reason, count(*) FROM decision_log WHERE event_id='$EVENT' GROUP BY 1,2 ORDER BY 3 DESC;"
psql $PG -c "SELECT total_seats, seats_left FROM events WHERE id='$EVENT';"

$confirmed = [int](psql $PG -tAc "SELECT count(*) FROM registrations WHERE event_id='$EVENT' AND user_id='$USER' AND status='CONFIRMED';")
$rowsUser  = [int](psql $PG -tAc "SELECT count(*) FROM registrations WHERE event_id='$EVENT' AND user_id='$USER';")
$seats     = [int](psql $PG -tAc "SELECT seats_left FROM events WHERE id='$EVENT';")
$dupes     = [int](psql $PG -tAc "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action='DUPLICATE_ABSORBED';")
$invariant = "$(psql $PG -tAc "SELECT (e.total_seats - count(r.*) FILTER (WHERE r.status='CONFIRMED')) = e.seats_left FROM events e LEFT JOIN registrations r ON r.event_id = e.id WHERE e.id='$EVENT' GROUP BY e.total_seats, e.seats_left;")".Trim()
$dlq       = [int](aws sqs get-queue-attributes --queue-url ($Q -replace 'intents\.fifo','intents-dlq.fifo') `
                     --attribute-names ApproximateNumberOfMessages `
                     --query "Attributes.ApproximateNumberOfMessages" --output text)

Write-Host ""
Write-Host "confirmed=$confirmed (want 1)   rows_for_user=$rowsUser (want 1)   seats_left=$seats (want 4)"
Write-Host "duplicates_absorbed=$dupes (want 2)   invariant_seats_math=$invariant (want t)   dlq=$dlq (want 0)"
if ($confirmed -eq 1 -and $rowsUser -eq 1 -and $seats -eq 4 -and $dupes -eq 2 -and $invariant -eq 't' -and $dlq -eq 0) {
  Write-Host "GATE 2 PASS" -Foreground Green
} else {
  Write-Host "GATE 2 FAIL" -Foreground Red
  if ($seats -eq 2) {
    Write-Host "  seats_left=2 means the decrement ran before the claim: 2 seats leaked." -Foreground Yellow
  }
}
