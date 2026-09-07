# Objective 3 demo - the email circuit breaker, end to end.
#
# Gate 1 confirms exactly ONE seat, so it produces exactly ONE notify message.
# With maxReceiveCount=3 that is at most 3 failures - below the threshold of 5,
# so Gate 1 alone can never open the breaker. This driver uses a multi-seat
# event so a single batch carries enough messages to trip it.
#
# Three phases:
#   1 HEALTHY  - burst of registrations, expect NOTIFY_SENT for each
#   2 CHAOS    - chaos#email on: NOTIFY_FAILED x5 -> BREAKER_OPEN -> short
#                circuits -> messages age out into notify-dlq
#   3 RECOVERY - chaos off, wait out the 30s cooldown, next message is the
#                half-open probe -> BREAKER_CLOSED -> NOTIFY_SENT
#
# Usage:  . .\env.ps1  ;  .\chaos_email.ps1

$ErrorActionPreference = "Continue"
$EVENT   = "chaos-event"
$BURST   = 6            # > BREAKER_THRESHOLD (5), so one batch can trip it
$DLQ_URL = $Q -replace 'intents\.fifo', 'intents-dlq.fifo'
$NOTIFY  = "https://sqs.ap-south-1.amazonaws.com/094337892389/notify"
$NDLQ    = "https://sqs.ap-south-1.amazonaws.com/094337892389/notify-dlq"

function Invoke-Json($file, $content, [scriptblock]$cmd) {
  $content | Set-Content -Encoding ascii $file
  & $cmd
}

function Get-Depth($url) {
  $n = aws sqs get-queue-attributes --queue-url $url `
         --attribute-names ApproximateNumberOfMessages `
         --query "Attributes.ApproximateNumberOfMessages" --output text
  return [int]$n
}

function Send-Burst($prefix, $count) {
  $entries = @()
  for ($j = 1; $j -le $count; $j++) {
    $intentId = [guid]::NewGuid().ToString()
    $entries += @{
      Id                     = "m$j"
      MessageBody            = (ConvertTo-Json -InputObject @{ intentId = $intentId; eventId = $EVENT; userId = "$prefix-user-$j" } -Compress)
      MessageGroupId         = $EVENT
      MessageDeduplicationId = $intentId
    }
  }
  # -InputObject, not the pipeline: PS 5.1 would wrap the array as {"value":[...]}
  ConvertTo-Json -InputObject $entries -Depth 5 | Set-Content -Encoding ascii "$env:TEMP\cbatch.json"
  $r = aws sqs send-message-batch --queue-url $Q --entries "file://$env:TEMP\cbatch.json" | Out-String
  if ($LASTEXITCODE -ne 0) { Write-Host "send failed: $r" -Foreground Red; exit 1 }
  $f = ($r | ConvertFrom-Json).Failed
  if ($f) { Write-Host "SQS rejected: $($f | ConvertTo-Json -Compress)" -Foreground Red; exit 1 }
  Write-Host "  sent $count intents as $prefix-user-1..$count" -Foreground Green
}

function Wait-For($label, $sql, $want, $timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  do {
    Start-Sleep 5
    $n = [int](psql $PG -tAc $sql)
    Write-Host "  $label = $n / $want"
    if ($n -ge $want) { return $true }
  } while ((Get-Date) -lt $deadline)
  return $false
}

# ── PHASE 0 — reset ─────────────────────────────────────────────────────────
Write-Host "== PHASE 0: reset ==" -Foreground Cyan

@'
{"TableName":"ss_control","Key":{"k":{"S":"chaos#email"}}}
'@ | Set-Content -Encoding ascii "$env:TEMP\chaos-off.json"

# Reused for every breaker read. Inline JSON as a CLI argument does NOT survive
# PowerShell quoting - it arrives as {k:{S:breaker#email}} and the CLI rejects it.
@'
{"TableName":"ss_control","Key":{"k":{"S":"breaker#email"}}}
'@ | Set-Content -Encoding ascii "$env:TEMP\breaker-key.json"
aws dynamodb delete-item --cli-input-json "file://$env:TEMP\chaos-off.json" | Out-Null

@'
{"TableName":"ss_control","Item":{"k":{"S":"breaker#email"},"state":{"S":"CLOSED"},"fails":{"N":"0"}}}
'@ | Set-Content -Encoding ascii "$env:TEMP\breaker-reset.json"
aws dynamodb put-item --cli-input-json "file://$env:TEMP\breaker-reset.json" | Out-Null

psql $PG -v ON_ERROR_STOP=1 -q -c @"
BEGIN;
DELETE FROM registrations WHERE event_id = '$EVENT';
DELETE FROM decision_log  WHERE event_id = '$EVENT';
DELETE FROM events        WHERE id = '$EVENT';
INSERT INTO events (id, name, total_seats, seats_left, status, start_time, end_time,
                    registration_opens_at, registration_closes_at)
VALUES ('$EVENT', 'CHAOS - breaker demo', 60, 60, 'OPEN',
        now() + interval '1 day', now() + interval '1 day 2 hours',
        now() - interval '1 minute', now() + interval '2 hours');
COMMIT;
"@
if ($LASTEXITCODE -ne 0) { Write-Host "fixture failed" -Foreground Red; exit 1 }
Write-Host "  chaos off, breaker CLOSED/0, event reset with 60 seats" -Foreground Green

# ── PHASE 1 — healthy ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "== PHASE 1: healthy provider ==" -Foreground Cyan
Send-Burst "p1" $BURST
$ok = Wait-For "NOTIFY_SENT" `
  "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action='NOTIFY_SENT';" $BURST 90
if (-not $ok) { Write-Host "  PHASE 1 did not reach $BURST NOTIFY_SENT" -Foreground Red }

# ── PHASE 2 — chaos ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "== PHASE 2: chaos#email ON ==" -Foreground Cyan
@'
{"TableName":"ss_control","Item":{"k":{"S":"chaos#email"},"enabled":{"BOOL":true}}}
'@ | Set-Content -Encoding ascii "$env:TEMP\chaos-on.json"
aws dynamodb put-item --cli-input-json "file://$env:TEMP\chaos-on.json" | Out-Null
Write-Host "  chaos#email enabled=true" -Foreground Yellow

Send-Burst "p2" $BURST
$opened = Wait-For "BREAKER_OPEN rows" `
  "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action='BREAKER_OPEN';" 1 120
if ($opened) { Write-Host "  breaker OPENED" -Foreground Yellow }
else         { Write-Host "  breaker did NOT open" -Foreground Red }

aws dynamodb get-item --cli-input-json "file://$env:TEMP\breaker-key.json" --query "Item" --output json

Write-Host "  waiting for failed messages to age into notify-dlq (3 receives x 60s visibility)..." -Foreground Cyan
$deadline = (Get-Date).AddSeconds(300)
do {
  Start-Sleep 15
  $d = Get-Depth $NDLQ
  Write-Host "  notify-dlq depth = $d"
} while ($d -lt 1 -and (Get-Date) -lt $deadline)

# ── PHASE 3 — recovery ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "== PHASE 3: chaos OFF, recovery ==" -Foreground Cyan
aws dynamodb delete-item --cli-input-json "file://$env:TEMP\chaos-off.json" | Out-Null
Write-Host "  chaos#email cleared; waiting out the 30s cooldown..." -Foreground Yellow
Start-Sleep 35

Send-Burst "p3" $BURST
$closed = Wait-For "BREAKER_CLOSED rows" `
  "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action='BREAKER_CLOSED';" 1 120
if ($closed) { Write-Host "  breaker CLOSED (probe succeeded)" -Foreground Green }
else         { Write-Host "  breaker did NOT close" -Foreground Red }

# ── RESULT ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "== RESULT ==" -Foreground Cyan
psql $PG -c "SELECT action, reason, count(*) FROM decision_log WHERE event_id='$EVENT' AND actor='notifier' GROUP BY 1,2 ORDER BY 3 DESC;"
psql $PG -c "SELECT to_char(ts,'HH24:MI:SS') AS t, action, reason FROM decision_log WHERE event_id='$EVENT' AND action IN ('BREAKER_OPEN','BREAKER_CLOSED') ORDER BY ts;"
aws dynamodb get-item --cli-input-json "file://$env:TEMP\breaker-key.json" --query "Item" --output json

$sent   = [int](psql $PG -tAc "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action='NOTIFY_SENT';")
$failed = [int](psql $PG -tAc "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action='NOTIFY_FAILED';")
$nopen  = [int](psql $PG -tAc "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action='BREAKER_OPEN';")
$nclose = [int](psql $PG -tAc "SELECT count(*) FROM decision_log WHERE event_id='$EVENT' AND action='BREAKER_CLOSED';")
$ndlq   = Get-Depth $NDLQ

Write-Host ""
Write-Host "NOTIFY_SENT=$sent   NOTIFY_FAILED=$failed   BREAKER_OPEN=$nopen   BREAKER_CLOSED=$nclose   notify-dlq=$ndlq"
if ($sent -ge $BURST -and $failed -ge 5 -and $nopen -ge 1 -and $nclose -ge 1 -and $ndlq -ge 1) {
  Write-Host "CHAOS DEMO PASS - breaker opened under failure and closed on recovery" -Foreground Green
} else {
  Write-Host "CHAOS DEMO INCOMPLETE" -Foreground Red
}
