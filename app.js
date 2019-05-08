const cdk = require('@aws-cdk/cdk');
const ecs = require('@aws-cdk/aws-ecs');
const ec2 = require('@aws-cdk/aws-ec2');
const s3 = require('@aws-cdk/aws-s3');
const sqs = require('@aws-cdk/aws-sqs');
const dynamodb = require('@aws-cdk/aws-dynamodb');

class BaseResources extends cdk.Stack {
  constructor(parent, id, props) {
    super(parent, id, props);

    // Network to run everything in
    this.vpc = new ec2.VpcNetwork(this, 'vpc', {
      maxAZs: 2,
      natGateways: 1
    });

    // Cluster all the containers will run in
    this.cluster = new ecs.Cluster(this, 'cluster', { vpc: this.vpc });

    // S3 bucket to hold resized image
    this.screenshotBucket = new s3.Bucket(this, 'screenshot-bucket', {
      publicReadAccess: true
    });

    // SQS queue to tell worker to resize an image
    this.screenshotQueue = new sqs.Queue(this, 'screenshot-queue');

    // DynamoDB table to keep track of websites we took screenshots of
    this.jobsTable = new dynamodb.Table(this, 'jobs', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.String },
      billingMode: dynamodb.BillingMode.PayPerRequest
    });
  }
}

class API extends cdk.Stack {
  constructor(parent, id, props) {
    super(parent, id, props);

    // Deploy an API component
    this.api = new ecs.LoadBalancedFargateService(this, 'api', {
      cluster: props.cluster,
      image: ecs.ContainerImage.fromAsset(this, 'api-image', {
        directory: './api'
      }),
      desiredCount: 2,
      cpu: '256',
      memory: '512',
      environment: {
        QUEUE_URL: props.screenshotQueue.queueUrl,
        TABLE: props.jobsTable.tableName
      },
      createLogs: true
    });

    // Write access to the SQS queue, write access to table
    props.screenshotQueue.grantSendMessages(this.api.service.taskDefinition.taskRole);
    props.jobsTable.grantReadWriteData(this.api.service.taskDefinition.taskRole);
  }
}

class Worker extends cdk.Stack {
  constructor(parent, id, props) {
    super(parent, id, props);

    // Deploy a worker component
    this.workerDefinition = new ecs.FargateTaskDefinition(this, 'worker-definition', {
      cpu: '2048',
      memoryMiB: '4096'
    });

    this.container = this.workerDefinition.addContainer('worker', {
      image: ecs.ContainerImage.fromAsset(this, 'worker-image', {
        directory: './worker'
      }),
      memoryLimitMiB: 4096,
      cpu: 2048,
      environment: {
        QUEUE_NAME: props.screenshotQueue.queueName,
        TABLE: props.jobsTable.tableName,
        BUCKET: props.screenshotBucket.bucketName
      },
      logging: new ecs.AwsLogDriver(this, 'worker-logs', {
        streamPrefix: 'worker'
      })
    });

    // Launch the image as a service in Fargate
    this.worker = new ecs.FargateService(this, 'worker', {
      cluster: props.cluster,
      desiredCount: 2,
      taskDefinition: this.workerDefinition
    });

    // Poll access to the queue, write access to bucket,
    // write access to the table
    props.screenshotQueue.grantConsumeMessages(this.workerDefinition.taskRole);
    props.jobsTable.grantReadWriteData(this.workerDefinition.taskRole);
    props.screenshotBucket.grantReadWrite(this.workerDefinition.taskRole);
  }
}

class App extends cdk.App {
  constructor(argv) {
    super(argv);

    this.baseResources = new BaseResources(this, 'base-resources');

    this.api = new API(this, 'api', {
      cluster: this.baseResources.cluster,
      screenshotQueue: this.baseResources.screenshotQueue,
      jobsTable: this.baseResources.jobsTable
    });

    this.worker = new Worker(this, 'worker', {
      cluster: this.baseResources.cluster,
      screenshotQueue: this.baseResources.screenshotQueue,
      jobsTable: this.baseResources.jobsTable,
      screenshotBucket: this.baseResources.screenshotBucket
    });
  }
}

new App().run();
