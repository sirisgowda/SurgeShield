$ErrorActionPreference = "Stop"
$env:AWS_PAGER = ""

$AWS_REGION = $env:AWS_REGION
if ([string]::IsNullOrEmpty($AWS_REGION)) {
    $AWS_REGION = "ap-south-1"
}
$env:AWS_REGION = $AWS_REGION

Write-Host "==> Installing CDK dependencies in 'infra' directory..."
Push-Location "$PSScriptRoot\..\infra"
try {
    npm install
    Write-Host "==> Synthesizing and Deploying SurgeShield CDK Stack to region $AWS_REGION..."
    npx cdk bootstrap
    npx cdk deploy --require-approval never
} finally {
    Pop-Location
}
