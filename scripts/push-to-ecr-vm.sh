#!/usr/bin/env bash
set -e

AWS_REGION="${AWS_REGION:-ap-south-1}"
ACCT=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCT.dkr.ecr.$AWS_REGION.amazonaws.com/surgeshield-api:latest"

echo "==> Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ACCT.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "==> Building Docker image for linux/amd64..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docker build --platform linux/amd64 -t surgeshield-api "$SCRIPT_DIR/../api"

echo "==> Tagging and pushing to ECR ($ECR_URI)..."
docker tag surgeshield-api:latest "$ECR_URI"
docker push "$ECR_URI"

echo "==> Docker image pushed successfully to ECR!"
