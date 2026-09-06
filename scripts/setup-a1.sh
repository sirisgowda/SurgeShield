#!/usr/bin/env bash
set -e

# Region setup
AWS_REGION="${AWS_REGION:-ap-south-1}"
export AWS_REGION

echo "==> Using AWS Region: $AWS_REGION"
ACCT=$(aws sts get-caller-identity --query Account --output text)
echo "==> Account ID: $ACCT"

# 1. RDS Database
echo "==> Creating RDS Instance: surgeshield-db..."
if aws rds describe-db-instances --db-instance-identifier surgeshield-db --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "    RDS instance 'surgeshield-db' already exists."
else
  aws rds create-db-instance \
    --db-instance-identifier surgeshield-db \
    --db-instance-class db.t4g.micro \
    --engine postgres \
    --master-username surgeshield \
    --master-user-password 'CHANGE_ME_LongPassword123' \
    --allocated-storage 20 \
    --db-name surgeshield \
    --publicly-accessible \
    --backup-retention-period 0 \
    --region "$AWS_REGION"
fi

# 2. DynamoDB Tables
echo "==> Creating DynamoDB tables..."
if ! aws dynamodb describe-table --table-name ss_intents --region "$AWS_REGION" >/dev/null 2>&1; then
  aws dynamodb create-table --table-name ss_intents \
    --attribute-definitions AttributeName=intent_id,AttributeType=S \
    --key-schema AttributeName=intent_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION"
fi

if ! aws dynamodb describe-table --table-name ss_control --region "$AWS_REGION" >/dev/null 2>&1; then
  aws dynamodb create-table --table-name ss_control \
    --attribute-definitions AttributeName=k,AttributeType=S \
    --key-schema AttributeName=k,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION"
fi

echo "==> Enabling TTL on DynamoDB tables..."
for t in ss_intents ss_control; do
  aws dynamodb update-time-to-live --table-name "$t" \
    --time-to-live-specification "Enabled=true,AttributeName=ttl" \
    --region "$AWS_REGION" || true
done

# 3. SQS Queues
echo "==> Creating SQS Queues..."
# intents-dlq.fifo
aws sqs create-queue --queue-name intents-dlq.fifo \
  --attributes FifoQueue=true \
  --region "$AWS_REGION" || true

INTENTS_DLQ_URL=$(aws sqs get-queue-url --queue-name intents-dlq.fifo --region "$AWS_REGION" --output text)
DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$INTENTS_DLQ_URL" \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text --region "$AWS_REGION")

# intents.fifo
REDRIVE_POLICY_INTENT="{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"3\"}"
aws sqs create-queue --queue-name intents.fifo \
  --attributes "FifoQueue=true,VisibilityTimeout=60,RedrivePolicy=$REDRIVE_POLICY_INTENT" \
  --region "$AWS_REGION" || true

INTENT_QUEUE_URL=$(aws sqs get-queue-url --queue-name intents.fifo --region "$AWS_REGION" --output text)

# notify-dlq
aws sqs create-queue --queue-name notify-dlq --region "$AWS_REGION" || true
NOTIFY_DLQ_URL=$(aws sqs get-queue-url --queue-name notify-dlq --region "$AWS_REGION" --output text)
NDLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$NOTIFY_DLQ_URL" \
  --attribute-names QueueArn --query 'Attributes.QueueArn' --output text --region "$AWS_REGION")

# notify
REDRIVE_POLICY_NOTIFY="{\"deadLetterTargetArn\":\"$NDLQ_ARN\",\"maxReceiveCount\":\"3\"}"
aws sqs create-queue --queue-name notify \
  --attributes "VisibilityTimeout=60,RedrivePolicy=$REDRIVE_POLICY_NOTIFY" \
  --region "$AWS_REGION" || true

NOTIFY_QUEUE_URL=$(aws sqs get-queue-url --queue-name notify --region "$AWS_REGION" --output text)

# 4. ECR Repository
echo "==> Creating ECR Repository: surgeshield-api..."
if ! aws ecr describe-repositories --repository-names surgeshield-api --region "$AWS_REGION" >/dev/null 2>&1; then
  aws ecr create-repository --repository-name surgeshield-api --region "$AWS_REGION"
fi

# 5. Wait for RDS and set Security Group
echo "==> Waiting for RDS instance to be available (~10 min)..."
aws rds wait db-instance-available --db-instance-identifier surgeshield-db --region "$AWS_REGION"

RDS_HOST=$(aws rds describe-db-instances --db-instance-identifier surgeshield-db \
  --region "$AWS_REGION" --query 'DBInstances[0].Endpoint.Address' --output text)
SG=$(aws rds describe-db-instances --db-instance-identifier surgeshield-db \
  --region "$AWS_REGION" --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)

echo "==> Authorizing PostgreSQL ingress (port 5432) for security group $SG..."
aws ec2 authorize-security-group-ingress --group-id "$SG" \
  --protocol tcp --port 5432 --cidr 0.0.0.0/0 --region "$AWS_REGION" || true

JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "surgeshield_jwt_secret_$(date +%s)")

DATABASE_URL="postgresql://surgeshield:CHANGE_ME_LongPassword123@${RDS_HOST}:5432/surgeshield"

echo ""
echo "============================================================"
echo "           A1 AWS INFRASTRUCTURE DEPLOYMENT COMPLETE         "
echo "============================================================"
echo ""
echo "Copy the environment variables below for team / .env file:"
echo ""
echo "DATABASE_URL=$DATABASE_URL"
echo "INTENT_QUEUE_URL=$INTENT_QUEUE_URL"
echo "NOTIFY_QUEUE_URL=$NOTIFY_QUEUE_URL"
echo "DDB_INTENTS=ss_intents"
echo "DDB_CONTROL=ss_control"
echo "AWS_REGION=$AWS_REGION"
echo "JWT_SECRET=$JWT_SECRET"
echo ""
echo "============================================================"
