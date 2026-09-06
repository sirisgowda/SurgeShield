# Build, deploy and wire the reconciler Lambda. Re-run after every code change.
# Run from the repo root (where .env.shared lives).

$ErrorActionPreference = "Continue"
$env:AWS_REGION = "ap-south-1"

# ── read .env.shared into a hashtable ──────────────────────────────────────
$cfg = @{}
Get-Content .env.shared | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $cfg[$Matches[1]] = $Matches[2] }
}
if ($cfg.DATABASE_URL -match 'REPLACE_WITH_PASSWORD') {
  Write-Host "DATABASE_URL still has the placeholder password. Fix .env.shared first." -Foreground Red
  exit 1
}

$FN = "surgeshield-reconciler"
Push-Location lambdas\reconciler

# ── make sure the CA bundle ships inside the zip ───────────────────────────
if (-not (Test-Path .\global-bundle.pem)) {
  Copy-Item ..\..\global-bundle.pem .\global-bundle.pem
}

# ── install deps once ──────────────────────────────────────────────────────
if (-not (Test-Path .\node_modules)) {
  Write-Host "> npm install..." -Foreground Cyan
  npm install --omit=dev --silent
}

# ── zip (contents at the root of the archive, not inside a folder) ─────────
Write-Host "> packaging..." -Foreground Cyan
if (Test-Path ..\reconciler.zip) { Remove-Item ..\reconciler.zip }
Compress-Archive -Path .\* -DestinationPath ..\reconciler.zip -Force
$zip = (Resolve-Path ..\reconciler.zip).Path

# ── create or update ───────────────────────────────────────────────────────
$exists = aws lambda get-function --function-name $FN --query "Configuration.FunctionName" --output text 2>$null

if (-not $exists -or $exists -eq "None") {
  Write-Host "> creating function..." -Foreground Cyan

  # env vars via JSON file — the DB password may contain characters that
  # break the CLI's shorthand Variables={k=v,k=v} syntax
  @{
    Variables = @{
      DATABASE_URL     = $cfg.DATABASE_URL
      DDB_INTENTS      = $cfg.DDB_INTENTS
      DDB_CONTROL      = $cfg.DDB_CONTROL
      NOTIFY_QUEUE_URL = $cfg.NOTIFY_QUEUE_URL
    }
  } | ConvertTo-Json -Depth 4 | Set-Content -Encoding ascii "$env:TEMP\lenv.json"

  aws lambda create-function --function-name $FN `
    --runtime nodejs20.x --handler index.handler `
    --role $cfg.LAMBDA_ROLE_ARN `
    --timeout 30 --memory-size 512 `
    --zip-file "fileb://$zip" `
    --environment "file://$env:TEMP\lenv.json" | Out-Null

  aws lambda wait function-active-v2 --function-name $FN


  Write-Host "> wiring SQS FIFO event source..." -Foreground Cyan
  aws lambda create-event-source-mapping --function-name $FN `
    --event-source-arn $cfg.INTENT_QUEUE_ARN --batch-size 10 | Out-Null
}
else {
  Write-Host "> updating code..." -Foreground Cyan
  aws lambda update-function-code --function-name $FN --zip-file "fileb://$zip" | Out-Null
  aws lambda wait function-updated-v2 --function-name $FN
}

Pop-Location
Write-Host "deployed $FN" -Foreground Green
Write-Host "tail logs with:  aws logs tail /aws/lambda/$FN --follow" -Foreground Yellow
