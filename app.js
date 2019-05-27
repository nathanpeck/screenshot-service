const cdk = require('@aws-cdk/cdk');
const ec2 = require('@aws-cdk/aws-ec2');
const ecs = require('@aws-cdk/aws-ecs');
const s3 = require('@aws-cdk/aws-s3');
const sqs = require('@aws-cdk/aws-sqs');
const dynamodb = require('@aws-cdk/aws-dynamodb');

class BaseResources extends cdk.Stack {
  constructor(parent, id, props) {
    super(parent, id, props);

    // Network
    this.vpc = new ec2.VpcNetwork(this, 'vpc', {
      maxAZs: 2,
      natGateways: 1
    });

    // ECS cluster
    this.cluster = new ecs.Cluster(this, 'cluster', {
      vpc: this.vpc
    });

    // S3
    this.bucket = new s3.Bucket(this, 'bucket', {
      publicReadAccess: true,
    });

    // SQS
    this.queue = new sqs.Queue(this, 'queue');

    // DynamoDB
    this.table = new dynamodb.Table(this, 'table', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.String },
      billingMode: dynamodb.BillingMode.PayPerRequest
    });
  }
}

class API extends cdk.Stack {
  constructor(parent, id, props) {
    super(parent, id, props);

    // API
    this.api = new ecs.LoadBalancedFargateService(this, 'api', {
      cluster: props.cluster,
      image: ecs.ContainerImage.fromAsset(this, 'api-image', {
        directory: './api'
      }),
      desiredCount: 2,
      cpu: '256',
      memory: '512',
      environment: {
        QUEUE_URL: props.queue.queueUrl,
        TABLE: props.table.tableName
      },
      createLogs: true
    });

    props.queue.grantSendMessages(this.api.service.taskDefinition.taskRole);
    props.table.grantReadWriteData(this.api.service.taskDefinition.taskRole);
  }
}

class Worker extends cdk.Stack {
  constructor(parent, id, props) {
    super(parent, id, props);

    // Worker
    this.workerDefinition = new ecs.FargateTaskDefinition(this, 'worker-definition', {
      cpu: '2048',
      memoryMiB: '4096'
    });

    this.container = this.workerDefinition.addContainer('worker', {
      image: ecs.ContainerImage.fromAsset(this, 'worker-image', {
        directory: './worker'
      }),
      cpu: 2048,
      memoryLimitMiB: 4096,
      environment: {
        QUEUE_URL: props.queue.queueUrl,
        TABLE: props.table.tableName,
        BUCKET: props.bucket.bucketName
      },
      logging: new ecs.AwsLogDriver(this, 'worker-logs', {
        streamPrefix: 'worker'
      })
    });

    this.worker = new ecs.FargateService(this, 'worker', {
      cluster: props.cluster,
      desiredCount: 2,
      taskDefinition: this.workerDefinition
    });

    props.queue.grantConsumeMessages(this.workerDefinition.taskRole);
    props.table.grantReadWriteData(this.workerDefinition.taskRole);
    props.bucket.grantReadWrite(this.workerDefinition.taskRole);
  }
}

class App extends cdk.App {
  constructor(argv) {
    super(argv);

    this.baseResources = new BaseResources(this, 'base-resources', {});

    this.api = new API(this, 'api', {
      cluster: this.baseResources.cluster,
      table: this.baseResources.table,
      queue: this.baseResources.queue,
    });

    this.worker = new Worker(this, 'worker', {
      cluster: this.baseResources.cluster,
      table: this.baseResources.table,
      queue: this.baseResources.queue,
      bucket: this.baseResources.bucket
    });
  }
}

new App().run();
