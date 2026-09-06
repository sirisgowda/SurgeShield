#!/usr/bin/env bash
set -e
export AWS_PAGER=""

AWS_REGION="${AWS_REGION:-ap-south-1}"
export AWS_REGION

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../infra"

echo "==> Installing CDK dependencies in 'infra' directory..."
cd "$INFRA_DIR"
npm install

echo "==> Synthesizing and Deploying SurgeShield CDK Stack to region $AWS_REGION..."
npx cdk bootstrap
npx cdk deploy --require-approval never
