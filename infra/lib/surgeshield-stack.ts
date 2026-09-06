import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as iam from 'aws-cdk-lib/aws-iam';

export class SurgeShieldStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. VPC setup for RDS PostgreSQL (Public subnets to meet A1 publicly-accessible requirements)
    const vpc = new ec2.Vpc(this, 'SurgeShieldVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // RDS Security Group (ingress port 5432 from 0.0.0.0/0 as specified in DEV_A_INFRA.md)
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      description: 'Allow PostgreSQL access for SurgeShield DB',
      allowAllOutbound: true,
    });
    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow public PostgreSQL access (hackathon trade-off)'
    );

    // RDS PostgreSQL Database Instance
    const dbInstance = new rds.DatabaseInstance(this, 'SurgeShieldDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromPassword(
        'surgeshield',
        SecretValue.unsafePlainText('CHANGE_ME_LongPassword123')
      ),
      allocatedStorage: 20,
      databaseName: 'surgeshield',
      publiclyAccessible: true,
      backupRetention: Duration.days(0),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 2. DynamoDB Tables
    const intentsTable = new dynamodb.Table(this, 'IntentsTable', {
      tableName: 'ss_intents',
      partitionKey: { name: 'intent_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const controlTable = new dynamodb.Table(this, 'ControlTable', {
      tableName: 'ss_control',
      partitionKey: { name: 'k', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 3. SQS Queues
    const intentsDLQ = new sqs.Queue(this, 'IntentsDLQ', {
      queueName: 'intents-dlq.fifo',
      fifo: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const intentsQueue = new sqs.Queue(this, 'IntentsQueue', {
      queueName: 'intents.fifo',
      fifo: true,
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: {
        queue: intentsDLQ,
        maxReceiveCount: 3,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const notifyDLQ = new sqs.Queue(this, 'NotifyDLQ', {
      queueName: 'notify-dlq',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const notifyQueue = new sqs.Queue(this, 'NotifyQueue', {
      queueName: 'notify',
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: {
        queue: notifyDLQ,
        maxReceiveCount: 3,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 4. ECR Repository
    const apiRepository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: 'surgeshield-api',
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // IAM Role for App Runner to pull image from ECR
    const appRunnerAccessRole = new iam.Role(this, 'AppRunnerECRAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
    });
    appRunnerAccessRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppRunnerServicePolicyForECRAccess')
    );

    // 5. Deploy AWS App Runner Service (Task A3)
    const databaseUrl = `postgresql://surgeshield:CHANGE_ME_LongPassword123@${dbInstance.dbInstanceEndpointAddress}:5432/surgeshield`;

    const appRunnerService = new apprunner.CfnService(this, 'ApiAppRunnerService', {
      serviceName: 'surgeshield-api-service',
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: appRunnerAccessRole.roleArn,
        },
        imageRepository: {
          imageIdentifier: `${apiRepository.repositoryUri}:latest`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '8080',
            runtimeEnvironmentVariables: [
              { name: 'DATABASE_URL', value: databaseUrl },
              { name: 'INTENT_QUEUE_URL', value: intentsQueue.queueUrl },
              { name: 'NOTIFY_QUEUE_URL', value: notifyQueue.queueUrl },
              { name: 'DDB_INTENTS', value: intentsTable.tableName },
              { name: 'DDB_CONTROL', value: controlTable.tableName },
              { name: 'AWS_REGION', value: this.region },
              { name: 'JWT_SECRET', value: 'surgeshield_jwt_secret_670f2c41b93dae58' },
            ],
          },
        },
      },
      healthCheckConfiguration: {
        path: '/healthz',
        protocol: 'HTTP',
      },
    });

    // 6. Stack Outputs
    new CfnOutput(this, 'DATABASE_URL', {
      description: 'PostgreSQL Database Connection URL',
      value: databaseUrl,
    });

    new CfnOutput(this, 'INTENT_QUEUE_URL', {
      description: 'SQS Queue URL for Intents FIFO Queue',
      value: intentsQueue.queueUrl,
    });

    new CfnOutput(this, 'NOTIFY_QUEUE_URL', {
      description: 'SQS Queue URL for Notify Queue',
      value: notifyQueue.queueUrl,
    });

    new CfnOutput(this, 'DDB_INTENTS', {
      description: 'DynamoDB Intents Table Name',
      value: intentsTable.tableName,
    });

    new CfnOutput(this, 'DDB_CONTROL', {
      description: 'DynamoDB Control Table Name',
      value: controlTable.tableName,
    });

    new CfnOutput(this, 'AWS_REGION', {
      description: 'AWS Region',
      value: this.region,
    });

    new CfnOutput(this, 'ECR_REPOSITORY_URI', {
      description: 'ECR Repository URI to push Docker image',
      value: apiRepository.repositoryUri,
    });

    new CfnOutput(this, 'API_URL', {
      description: 'Live Public AWS App Runner API URL',
      value: `https://${appRunnerService.attrServiceUrl}`,
    });
  }
}
