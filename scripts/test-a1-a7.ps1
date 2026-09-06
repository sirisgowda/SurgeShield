$ErrorActionPreference = "Stop"
$API_URL = "http://localhost:8080"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "         SURGESHIELD A1-A7 WINDOWS END-TO-END TEST          " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Healthz Check
Write-Host "[1/5] Testing GET /healthz..." -NoNewline
try {
    $res1 = Invoke-RestMethod -Uri "$API_URL/healthz" -Method Get
    if ($res1.ok -eq $true) {
        Write-Host " [PASS]" -ForegroundColor Green
    } else {
        Write-Host " [FAIL]" -ForegroundColor Red
    }
} catch {
    Write-Host " [FAIL: $_]" -ForegroundColor Red
}

# 2. Readyz Check (RDS PostgreSQL)
Write-Host "[2/5] Testing GET /readyz (PostgreSQL DB)..." -NoNewline
try {
    $res2 = Invoke-RestMethod -Uri "$API_URL/readyz" -Method Get
    if ($res2.ok -eq $true) {
        Write-Host " [PASS]" -ForegroundColor Green
    } else {
        Write-Host " [FAIL]" -ForegroundColor Red
    }
} catch {
    Write-Host " [FAIL: $_]" -ForegroundColor Red
}

# 3. Registration Ingest Test
$idemKey = "win-test-" + (Get-Random)
Write-Host "[3/5] Testing POST /api/events/event-1/register..." -NoNewline
$intentId = $null
try {
    $res3 = Invoke-RestMethod -Uri "$API_URL/api/events/event-1/register" `
        -Method Post `
        -Headers @{ "Idempotency-Key" = $idemKey }
    
    $intentId = $res3.intent_id
    if ($intentId -and $res3.mode) {
        Write-Host " [PASS] (Intent ID: $intentId, Position: $($res3.position), Mode: $($res3.mode))" -ForegroundColor Green
    } else {
        Write-Host " [FAIL: Unexpected response]" -ForegroundColor Red
    }
} catch {
    Write-Host " [FAIL: $_]" -ForegroundColor Red
}

# 4. Idempotency (Duplicate Absorption) Test
Write-Host "[4/5] Testing Idempotency (Duplicate Request)..." -NoNewline
try {
    $res4 = Invoke-RestMethod -Uri "$API_URL/api/events/event-1/register" `
        -Method Post `
        -Headers @{ "Idempotency-Key" = $idemKey }
    
    if ($res4.intent_id -eq $intentId -and $res4.duplicate -eq $true) {
        Write-Host " [PASS] (Absorbed duplicate, returned same Intent ID)" -ForegroundColor Green
    } else {
        Write-Host " [FAIL: Duplicate not detected properly]" -ForegroundColor Red
    }
} catch {
    Write-Host " [FAIL: $_]" -ForegroundColor Red
}

# 5. Status Polling Test (DynamoDB query)
Write-Host "[5/5] Testing GET /api/intents/:id (DynamoDB Polling)..." -NoNewline
if ($intentId) {
    try {
        $res5 = Invoke-RestMethod -Uri "$API_URL/api/intents/$intentId" -Method Get
        if ($res5.status -eq "QUEUED" -and $res5.event_id -eq "event-1") {
            Write-Host " [PASS] (Status: $($res5.status), Mode: $($res5.mode))" -ForegroundColor Green
        } else {
            Write-Host " [FAIL: Status mismatch]" -ForegroundColor Red
        }
    } catch {
        Write-Host " [FAIL: $_]" -ForegroundColor Red
    }
} else {
    Write-Host " [SKIPPED: Previous step failed]" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "                ALL A1-A7 TESTS COMPLETED                   " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
