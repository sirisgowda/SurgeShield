# SurgeShield — create AWS resources (RDS already exists, skipped).
# PowerShell. Safe to re-run: every step tolerates "already exists".

$ErrorActionPreference = "Continue"

# ─────────────────────────────────────────────────────────────────────────
# REGION: ap-south-1 (Mumbai). Do NOT change this to ap-south-2 (Hyderabad)
# — App Runner is not available there, and the RDS instance is already in
# ap-south-1. Everything must live in one region: cross-region Lambda→RDS
# adds latency to the reconciler's hottest path and shows up in our p95.
# ─────────────────────────────────────────────────────────────────────────
$env:AWS_REGION = "ap-south-1"

$acct = aws sts get-caller-identity --query Account --output text
if (-not $acct) { Write-Host "AWS CLI not configured. Run: aws configure" -Foreground Red; exit 1 }
Write-Host "account $acct  region $env:AWS_REGION" -Foreground Green

# Find the RDS instance by name fragment — the identifier is CDK-generated,
# e.g. surgeshieldstack-surgeshielddb00fdca62-lqiaianukybm
$script:DBID = aws rds describe-db-instances `
  --query "DBInstances[?contains(DBInstanceIdentifier,'surgeshield')].DBInstanceIdentifier | [0]" `
  --output text 2>$null
if (-not $script:DBID -or $script:DBID -eq "None") {
  Write-Host "No RDS instance matching 'surgeshield' in $($env:AWS_REGION)." -Foreground Red
  Write-Host "Check the region, or list them with: aws rds describe-db-instances --query 'DBInstances[].DBInstanceIdentifier'" -Foreground Red
  exit 1
}
$rdsHost = aws rds describe-db-instances --db-instance-identifier $script:DBID `
             --query "DBInstances[0].Endpoint.Address" --output text
Write-Host "rds  $script:DBID" -Foreground Green
Write-Host "     $rdsHost" -Foreground Green
Write-Host ""

# ── 1. DynamoDB — the fast path ───────────────────────────────────────────
Write-Host "> DynamoDB tables..." -Foreground Cyan

aws dynamodb create-table --table-name ss_intents `
  --attribute-definitions AttributeName=intent_id,AttributeType=S `
  --key-schema AttributeName=intent_id,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST 2>$null | Out-Null

aws dynamodb create-table --table-name ss_control `
  --attribute-definitions AttributeName=k,AttributeType=S `
  --key-schema AttributeName=k,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST 2>$null | Out-Null

foreach ($t in @("ss_intents", "ss_control")) {
  aws dynamodb wait table-exists --table-name $t
  aws dynamodb update-time-to-live --table-name $t `
    --time-to-live-specification "Enabled=true,AttributeName=ttl" 2>$null | Out-Null
  Write-Host "  ok $t (TTL on 'ttl')" -Foreground Green
}
Write-Host ""

# ── 2. SQS — DLQs first, main queues reference their ARNs ─────────────────
Write-Host "> SQS queues..." -Foreground Cyan

aws sqs create-queue --queue-name intents-dlq.fifo --attributes FifoQueue=true 2>$null | Out-Null
$dlqUrl = aws sqs get-queue-url --queue-name intents-dlq.fifo --query QueueUrl --output text
$dlqArn = aws sqs get-queue-attributes --queue-url $dlqUrl `
            --attribute-names QueueArn --query "Attributes.QueueArn" --output text

# JSON via file:// — avoids all PowerShell quote-mangling with the AWS CLI
$intentAttrs = @"
{
  "FifoQueue": "true",
  "VisibilityTimeout": "60",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"$dlqArn\",\"maxReceiveCount\":\"3\"}"
}
"@
$intentAttrs | Set-Content -Encoding ascii "$env:TEMP\intents-attrs.json"
aws sqs create-queue --queue-name intents.fifo `
  --attributes "file://$env:TEMP\intents-attrs.json" 2>$null | Out-Null

aws sqs create-queue --queue-name notify-dlq 2>$null | Out-Null
$ndlqUrl = aws sqs get-queue-url --queue-name notify-dlq --query QueueUrl --output text
$ndlqArn = aws sqs get-queue-attributes --queue-url $ndlqUrl `
             --attribute-names QueueArn --query "Attributes.QueueArn" --output text

$notifyAttrs = @"
{
  "VisibilityTimeout": "60",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"$ndlqArn\",\"maxReceiveCount\":\"3\"}"
}
"@
$notifyAttrs | Set-Content -Encoding ascii "$env:TEMP\notify-attrs.json"
aws sqs create-queue --queue-name notify `
  --attributes "file://$env:TEMP\notify-attrs.json" 2>$null | Out-Null

$intentQueueUrl = aws sqs get-queue-url --queue-name intents.fifo --query QueueUrl --output text
$intentQueueArn = aws sqs get-queue-attributes --queue-url $intentQueueUrl `
                    --attribute-names QueueArn --query "Attributes.QueueArn" --output text
$notifyQueueUrl = aws sqs get-queue-url --queue-name notify --query QueueUrl --output text
$notifyQueueArn = aws sqs get-queue-attributes --queue-url $notifyQueueUrl `
                    --attribute-names QueueArn --query "Attributes.QueueArn" --output text
Write-Host "  ok intents.fifo + dlq, notify + dlq" -Foreground Green
Write-Host ""

# ── 3. IAM role the Lambdas assume ────────────────────────────────────────
Write-Host "> IAM role..." -Foreground Cyan
$trust = @"
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
"@
$trust | Set-Content -Encoding ascii "$env:TEMP\trust.json"
aws iam create-role --role-name surgeshield-lambda `
  --assume-role-policy-document "file://$env:TEMP\trust.json" 2>$null | Out-Null

foreach ($p in @("service-role/AWSLambdaBasicExecutionRole",
                 "AmazonSQSFullAccess", "AmazonDynamoDBFullAccess")) {
  aws iam attach-role-policy --role-name surgeshield-lambda `
    --policy-arn "arn:aws:iam::aws:policy/$p" 2>$null | Out-Null
}
Write-Host "  ok arn:aws:iam::${acct}:role/surgeshield-lambda" -Foreground Green
Write-Host ""

# ── 4. ECR for A's API image ──────────────────────────────────────────────
Write-Host "> ECR repository..." -Foreground Cyan
aws ecr create-repository --repository-name surgeshield-api 2>$null | Out-Null
Write-Host "  ok $acct.dkr.ecr.$($env:AWS_REGION).amazonaws.com/surgeshield-api" -Foreground Green
Write-Host ""

# ── 5. Check the RDS security group allows the API in ─────────────────────
Write-Host "> RDS security group..." -Foreground Cyan
$sg = aws rds describe-db-instances --db-instance-identifier $script:DBID `
        --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" --output text
$open = aws ec2 describe-security-groups --group-ids $sg `
          --query "SecurityGroups[0].IpPermissions[?FromPort==``5432``].IpRanges[].CidrIp" --output text
Write-Host "  sg $sg currently allows: $open"
if ($open -notmatch "0\.0\.0\.0/0") {
  Write-Host "  adding 0.0.0.0/0 so App Runner can connect (disclosed trade-off)" -Foreground Yellow
  aws ec2 authorize-security-group-ingress --group-id $sg `
    --protocol tcp --port 5432 --cidr 0.0.0.0/0 2>$null | Out-Null
}
Write-Host ""

# ── 6. Write the shared env file ──────────────────────────────────────────
$jwt = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
@"
AWS_REGION=$($env:AWS_REGION)
AWS_ACCOUNT=$acct
DATABASE_URL=postgresql://surgeshield:REPLACE_WITH_PASSWORD@${rdsHost}:5432/surgeshield
PGSSLROOTCERT=./global-bundle.pem
INTENT_QUEUE_URL=$intentQueueUrl
INTENT_QUEUE_ARN=$intentQueueArn
NOTIFY_QUEUE_URL=$notifyQueueUrl
NOTIFY_QUEUE_ARN=$notifyQueueArn
DDB_INTENTS=ss_intents
DDB_CONTROL=ss_control
LAMBDA_ROLE_ARN=arn:aws:iam::${acct}:role/surgeshield-lambda
ECR_URI=$acct.dkr.ecr.$($env:AWS_REGION).amazonaws.com/surgeshield-api
JWT_SECRET=$jwt
"@ | Set-Content -Encoding ascii ".env.shared"

Write-Host "============================================" -Foreground Green
Write-Host "Done. Wrote .env.shared" -Foreground Green
Write-Host "Put the real DB password into DATABASE_URL, then share with the team." -Foreground Yellow
Write-Host "============================================" -Foreground Green
Get-Content .env.shared
