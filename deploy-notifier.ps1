# Build, deploy and wire the notifier Lambda. Re-run after every code change.
# Run from the repo root (where .env.shared lives).

$ErrorActionPreference = "Continue"
$env:AWS_REGION = "ap-south-1"

# -- read .env.shared into a hashtable --------------------------------------
$cfg = @{}
Get-Content .env.shared | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)=(.*)$') { $cfg[$Matches[1]] = $Matches[2] }
}
if ($cfg.DATABASE_URL -match 'REPLACE_WITH_PASSWORD') {
  Write-Host "DATABASE_URL still has the placeholder password. Fix .env.shared first." -Foreground Red
  exit 1
}

$FN = "surgeshield-notifier"
Push-Location lambdas\notifier

# -- make sure the CA bundle ships inside the zip ---------------------------
if (-not (Test-Path .\global-bundle.pem)) {
  Copy-Item ..\..\global-bundle.pem .\global-bundle.pem
}

# -- install deps once ------------------------------------------------------
if (-not (Test-Path .\node_modules)) {
  Write-Host "> npm install..." -Foreground Cyan
  npm install --omit=dev --silent
}

# -- zip (contents at the root of the archive, not inside a folder) ---------
Write-Host "> packaging..." -Foreground Cyan
if (Test-Path ..\notifier.zip) { Remove-Item ..\notifier.zip }
Compress-Archive -Path .\* -DestinationPath ..\notifier.zip -Force
$zip = (Resolve-Path ..\notifier.zip).Path

# -- create or update -------------------------------------------------------
$exists = aws lambda get-function --function-name $FN --query "Configuration.FunctionName" --output text 2>$null

if (-not $exists -or $exists -eq "None") {
  Write-Host "> creating function..." -Foreground Cyan

  # env vars via JSON file - the DB password may contain characters that
  # break the CLI's shorthand Variables={k=v,k=v} syntax
  @{
    Variables = @{
      DATABASE_URL      = $cfg.DATABASE_URL
      DDB_CONTROL       = $cfg.DDB_CONTROL
      BREAKER_THRESHOLD = "5"
      BREAKER_OPEN_MS   = "30000"
      SENT_TTL_SECONDS  = "86400"
    }
  } | ConvertTo-Json -Depth 4 | Set-Content -Encoding ascii "$env:TEMP\nenv.json"

  aws lambda create-function --function-name $FN `
    --runtime nodejs20.x --handler index.handler `
    --role $cfg.LAMBDA_ROLE_ARN `
    --timeout 30 --memory-size 512 `
    --zip-file "fileb://$zip" `
    --environment "file://$env:TEMP\nenv.json" | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "create-function failed" -Foreground Red; Pop-Location; exit 1 }

  aws lambda wait function-active-v2 --function-name $FN

  # NOTE: reserved concurrency is deliberately NOT set. The account concurrency
  # limit is 10, and AWS refuses a reserved-concurrency allocation that would
  # leave less than 10 unreserved - so there is no value we are allowed to set.
  # The circuit breaker is our protection for the downstream provider instead.

  Write-Host "> wiring SQS event source (notify)..." -Foreground Cyan
  # --function-response-types ReportBatchItemFailures: we return the ids of the
  # messages that failed, so SQS redelivers only those and deletes the rest.
  aws lambda create-event-source-mapping --function-name $FN `
    --event-source-arn $cfg.NOTIFY_QUEUE_ARN `
    --batch-size 10 `
    --function-response-types ReportBatchItemFailures | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "event-source-mapping failed" -Foreground Red; Pop-Location; exit 1 }
}
else {
  Write-Host "> updating code..." -Foreground Cyan
  aws lambda update-function-code --function-name $FN --zip-file "fileb://$zip" | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "update-function-code failed" -Foreground Red; Pop-Location; exit 1 }
  aws lambda wait function-updated-v2 --function-name $FN
}

Pop-Location
Write-Host "deployed $FN" -Foreground Green
Write-Host "tail logs with:  aws logs tail /aws/lambda/$FN --follow" -Foreground Yellow
