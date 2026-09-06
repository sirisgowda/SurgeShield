import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export const sqs = new SQSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
export { SendMessageCommand };
