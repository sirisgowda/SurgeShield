$env:AWS_PAGER = ""
$AWS_REGION = $env:AWS_REGION
if ([string]::IsNullOrEmpty($AWS_REGION)) {
    $AWS_REGION = "ap-south-1"
}

Write-Host "==> Cleaning up unmanaged orphan resources from previous script runs in region $AWS_REGION..."

# 1. DynamoDB Tables
foreach ($t in @("ss_intents", "ss_control")) {
    Write-Host "Checking DynamoDB table: $t"
    try {
        aws dynamodb delete-table --table-name $t --region $AWS_REGION --no-cli-pager 2>$null
    } catch {}
}

# 2. ECR Repository
Write-Host "Checking ECR repository: surgeshield-api"
try {
    aws ecr delete-repository --repository-name surgeshield-api --force --region $AWS_REGION --no-cli-pager 2>$null
} catch {}

# 3. SQS Queues
foreach ($q in @("intents.fifo", "intents-dlq.fifo", "notify", "notify-dlq")) {
    Write-Host "Checking SQS queue: $q"
    try {
        $url = (aws sqs get-queue-url --queue-name $q --region $AWS_REGION --output text --no-cli-pager 2>$null)
        if ($url) {
            aws sqs delete-queue --queue-url $url --region $AWS_REGION --no-cli-pager 2>$null
        }
    } catch {}
}

# 4. RDS Instance (if existing unmanaged instance exists)
Write-Host "Checking RDS instance: surgeshield-db"
try {
    aws rds delete-db-instance --db-instance-identifier surgeshield-db --skip-final-snapshot --delete-automated-backups --region $AWS_REGION --no-cli-pager 2>$null
} catch {}

Write-Host "==> Cleanup requests submitted. Pausing 10s for resource release..."
Start-Sleep -Seconds 10
Write-Host "==> Orphan resource cleanup finished!"
