#!/usr/bin/env bash
export AWS_PAGER=""
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo "==> Cleaning up unmanaged orphan resources from previous script runs in region $AWS_REGION..."

# 1. DynamoDB Tables
for t in ss_intents ss_control; do
    echo "Checking DynamoDB table: $t"
    aws dynamodb delete-table --table-name "$t" --region "$AWS_REGION" --no-cli-pager 2>/dev/null || true
done

# 2. ECR Repository
echo "Checking ECR repository: surgeshield-api"
aws ecr delete-repository --repository-name surgeshield-api --force --region "$AWS_REGION" --no-cli-pager 2>/dev/null || true

# 3. SQS Queues
for q in intents.fifo intents-dlq.fifo notify notify-dlq; do
    echo "Checking SQS queue: $q"
    URL=$(aws sqs get-queue-url --queue-name "$q" --region "$AWS_REGION" --output text --no-cli-pager 2>/dev/null || true)
    if [ -n "$URL" ]; then
        aws sqs delete-queue --queue-url "$URL" --region "$AWS_REGION" --no-cli-pager 2>/dev/null || true
    fi
done

# 4. RDS Instance
echo "Checking RDS instance: surgeshield-db"
aws rds delete-db-instance --db-instance-identifier surgeshield-db --skip-final-snapshot --delete-automated-backups --region "$AWS_REGION" --no-cli-pager 2>/dev/null || true

echo "==> Cleanup requests submitted. Pausing 10s for resource release..."
sleep 10
echo "==> Orphan resource cleanup finished!"
