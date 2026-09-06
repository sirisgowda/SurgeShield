import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

export const ddb = DynamoDBDocument.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }),
  { marshallOptions: { removeUndefinedValues: true } }
);

export const INTENTS = process.env.DDB_INTENTS || 'ss_intents';
export const CONTROL = process.env.DDB_CONTROL || 'ss_control';
