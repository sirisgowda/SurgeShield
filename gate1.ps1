# GATE 1 — 200 concurrent registrations against a 1-seat event.
# Drives the queue DIRECTLY, so it does not need A's API to exist.
#
# PASS = exactly 1 CONFIRMED, 199 WAITLISTED, seats_left = 0, no DLQ messages.
#
# Usage:  . .\env.ps1  ;  .\gate1.ps1

$ErrorActionPreference = "Continue"
$EVENT = "gate1-event"
$N     = 200

Write-Host "== resetting fixture ==" -Foreground Cyan
psql $PG -v ON_ERROR_STOP=1 -f .\003_gate1_fixture.sql
if ($LASTEXITCODE -ne 0) { Write-Host "fixture failed" -Foreground Red; exit 1 }

Write-Host "== sending $N intents to the queue ==" -Foreground Cyan
$sent = 0
for ($i = 1; $i -le $N; $i += 10) {
  $entries = @()
  for ($j = $i; $j -lt ($i + 10) -and $j -le $N; $j++) {
    $userId   = "gate1-user-$j"
    $intentId = [guid]::NewGuid().ToString()
    $entries += @{
      Id                     = "m$j"
      MessageBody            = (@{ intentId = $intentId; eventId = $EVENT; userId = $userId } | ConvertTo-Json -Compress)
      MessageGroupId         = $EVENT          # same group => one consumer, strict order
      MessageDeduplicationId = $intentId
    }
  }
  # -InputObject, NOT the pipeline. In PS 5.1 `$array | ConvertTo-Json` wraps the
  # collection as {"value":[...],"Count":n}; SQS needs a bare [ ... ] array.
  ConvertTo-Json -InputObject $entries -Depth 5 | Set-Content -Encoding ascii "$env:TEMP\batch.json"
  # Do NOT swallow this call. A silently-failed send shows up 90s later as
  # "rows=0 FAIL", which looks like a reconciler bug and isn't one.
  $resp = aws sqs send-message-batch --queue-url $Q --entries "file://$env:TEMP\batch.json" | Out-String
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  send-message-batch exited $LASTEXITCODE at i=$i" -Foreground Red
    Write-Host $resp; exit 1
  }
  $failed = ($resp | ConvertFrom-Json).Failed
  if ($failed) {
    Write-Host "  SQS rejected entries: $($failed | ConvertTo-Json -Compress)" -Foreground Red
    exit 1
  }
  $sent += $entries.Count
}
Write-Host "  sent $sent" -Foreground Green

Write-Host "== draining (waiting up to 90s) ==" -Foreground Cyan
$deadline = (Get-Date).AddSeconds(90)
do {
  Start-Sleep 5
  $done = psql $PG -tAc "SELECT count(*) FROM registrations WHERE event_id='$EVENT' AND status <> 'PENDING';"
  Write-Host "  reconciled $done / $N"
} while ([int]$done -lt $N -and (Get-Date) -lt $deadline)

Write-Host ""
Write-Host "== RESULT ==" -Foreground Cyan
psql $PG -c "SELECT status, reason_code, count(*) FROM registrations WHERE event_id='$EVENT' GROUP BY 1,2 ORDER BY 3 DESC;"
psql $PG -c "SELECT seats_left, total_seats FROM events WHERE id='$EVENT';"

$confirmed = [int](psql $PG -tAc "SELECT count(*) FROM registrations WHERE event_id='$EVENT' AND status='CONFIRMED';")
$seats     = [int](psql $PG -tAc "SELECT seats_left FROM events WHERE id='$EVENT';")
$total     = [int](psql $PG -tAc "SELECT count(*) FROM registrations WHERE event_id='$EVENT';")
$dlq       = [int](aws sqs get-queue-attributes --queue-url ($Q -replace 'intents\.fifo','intents-dlq.fifo') `
                     --attribute-names ApproximateNumberOfMessages `
                     --query "Attributes.ApproximateNumberOfMessages" --output text)

Write-Host ""
Write-Host "confirmed=$confirmed (want 1)   seats_left=$seats (want 0)   rows=$total (want $N)   dlq=$dlq (want 0)"
if ($confirmed -eq 1 -and $seats -eq 0 -and $total -eq $N -and $dlq -eq 0) {
  Write-Host "GATE 1 PASS" -Foreground Green
} else {
  Write-Host "GATE 1 FAIL" -Foreground Red
}
