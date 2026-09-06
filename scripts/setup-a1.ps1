$ErrorActionPreference = "Continue"

$AWS_REGION = $env:AWS_REGION
if ([string]::IsNullOrEmpty($AWS_REGION)) {
    $AWS_REGION = "ap-south-1"
}
$env:AWS_REGION = $AWS_REGION

Write-Host "==> Using AWS Region: $AWS_REGION"
$ACCT = aws sts get-caller-identity --query Account --output text
Write-Host "==> Account ID: $ACCT"

# 1. RDS Database
Write-Host "==> Creating RDS Instance: surgeshield-db..."
$rdsCheck = aws rds describe-db-instances --db-instance-identifier surgeshield-db --region $AWS_REGION 2>$null
if ($LASTEXITCODE -ne 0) {
    aws rds create-db-instance `
      --db-instance-identifier surgeshield-db `
      --db-instance-class db.t4g.micro `
      --engine postgres `
      --master-username surgeshield `
      --master-user-password 'CHANGE_ME_LongPassword123' `
      --allocated-storage 20 `
      --db-name surgeshield `
      --publicly-accessible `
      --backup-retention-period 0 `
      --region $AWS_REGION
} else {
    Write-Host "    RDS instance 'surgeshield-db' already exists."
}

# 2. DynamoDB Tables
Write-Host "==> Creating DynamoDB tables..."
aws dynamodb describe-table --table-name ss_intents --region $AWS_REGION 2>$null
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name ss_intents `
      --attribute-definitions AttributeName=intent_id,AttributeType=S `
      --key-schema AttributeName=intent_id,KeyType=HASH `
      --billing-mode PAY_PER_REQUEST `
      --region $AWS_REGION
}

aws dynamodb describe-table --table-name ss_control --region $AWS_REGION 2>$null
if ($LASTEXITCODE -ne 0) {
    aws dynamodb create-table --table-name ss_control `
      --attribute-definitions AttributeName=k,AttributeType=S `
      --key-schema AttributeName=k,KeyType=HASH `
      --billing-mode PAY_PER_REQUEST `
      --region $AWS_REGION
}

Write-Host "==> Enabling TTL on DynamoDB tables..."
foreach ($t in @("ss_intents", "ss_control")) {
    aws dynamodb update-time-to-live --table-name $t `
      --time-to-live-specification "Enabled=true,AttributeName=ttl" `
      --region $AWS_REGION 2>$null
}

# 3. SQS Queues
Write-Host "==> Creating SQS Queues..."
aws sqs create-queue --queue-name intents-dlq.fifo --attributes FifoQueue=true --region $AWS_REGION 2>$null
$INTENTS_DLQ_URL = aws sqs get-queue-url --queue-name intents-dlq.fifo --region $AWS_REGION --output text
$DLQ_ARN = aws sqs get-queue-attributes --queue-url $INTENTS_DLQ_URL --attribute-names QueueArn --query 'Attributes.QueueArn' --output text --region $AWS_REGION

$redriveIntent = '{"FifoQueue":"true","VisibilityTimeout":"60","RedrivePolicy":"{\"deadLetterTargetArn\":\"' + $DLQ_ARN + '\",\"maxReceiveCount\":\"3\"}"}'
aws sqs create-queue --queue-name intents.fifo --attributes $redriveIntent --region $AWS_REGION 2>$null
$INTENT_QUEUE_URL = aws sqs get-queue-url --queue-name intents.fifo --region $AWS_REGION --output text

aws sqs create-queue --queue-name notify-dlq --region $AWS_REGION 2>$null
$NOTIFY_DLQ_URL = aws sqs get-queue-url --queue-name notify-dlq --region $AWS_REGION --output text
$NDLQ_ARN = aws sqs get-queue-attributes --queue-url $NOTIFY_DLQ_URL --attribute-names QueueArn --query 'Attributes.QueueArn' --output text --region $AWS_REGION

$redriveNotify = '{"VisibilityTimeout":"60","RedrivePolicy":"{\"deadLetterTargetArn\":\"' + $NDLQ_ARN + '\",\"maxReceiveCount\":\"3\"}"}'
aws sqs create-queue --queue-name notify --attributes $redriveNotify --region $AWS_REGION 2>$null
$NOTIFY_QUEUE_URL = aws sqs get-queue-url --queue-name notify --region $AWS_REGION --output text

# 4. ECR Repository
Write-Host "==> Creating ECR Repository: surgeshield-api..."
aws ecr describe-repositories --repository-names surgeshield-api --region $AWS_REGION 2>$null
if ($LASTEXITCODE -ne 0) {
    aws ecr create-repository --repository-name surgeshield-api --region $AWS_REGION
}

# 5. Wait for RDS and set Security Group
Write-Host "==> Waiting for RDS instance to be available (~10 min)..."
aws rds wait db-instance-available --db-instance-identifier surgeshield-db --region $AWS_REGION

$RDS_HOST = aws rds describe-db-instances --db-instance-identifier surgeshield-db --region $AWS_REGION --query 'DBInstances[0].Endpoint.Address' --output text
$SG = aws rds describe-db-instances --db-instance-identifier surgeshield-db --region $AWS_REGION --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text

Write-Host "==> Authorizing PostgreSQL ingress (port 5432) for security group $SG..."
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 5432 --cidr 0.0.0.0/0 --region $AWS_REGION 2>$null

$JWT_SECRET = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
$DATABASE_URL = "postgresql://surgeshield:CHANGE_ME_LongPassword123@${RDS_HOST}:5432/surgeshield"

Write-Host ""
Write-Host "============================================================"
Write-Host "           A1 AWS INFRASTRUCTURE DEPLOYMENT COMPLETE         "
Write-Host "============================================================"
Write-Host ""
Write-Host "Copy the environment variables below for team / .env file:"
Write-Host ""
Write-Host "DATABASE_URL=$DATABASE_URL"
Write-Host "INTENT_QUEUE_URL=$INTENT_QUEUE_URL"
Write-Host "NOTIFY_QUEUE_URL=$NOTIFY_QUEUE_URL"
Write-Host "DDB_INTENTS=ss_intents"
Write-Host "DDB_CONTROL=ss_control"
Write-Host "AWS_REGION=$AWS_REGION"
Write-Host "JWT_SECRET=$JWT_SECRET"
Write-Host ""
Write-Host "============================================================"
