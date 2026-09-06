#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SurgeShieldStack } from '../lib/surgeshield-stack';

const app = new cdk.App();

new SurgeShieldStack(app, 'SurgeShieldStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-south-1',
  },
});
