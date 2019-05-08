const cdk = require('@aws-cdk/cdk');
const ecs = require('@aws-cdk/aws-ecs');
const ec2 = require('@aws-cdk/aws-ec2');

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
  }
}

class API extends cdk.Stack {
  constructor(parent, id, props) {
    super(parent, id, props);

    // Deploy an API component
    this.api = new ecs.LoadBalancedFargateService(this, 'api', {
      cluster: props.cluster,
      image: ecs.ContainerImage.fromAsset(this, 'api-image', {
        directory: './api-placeholder'
      }),
      desiredCount: 2,
      cpu: '256',
      memory: '512',
      createLogs: true
    });
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
        directory: './worker-placeholder'
      }),
      memoryLimitMiB: 4096,
      cpu: 2048,
      logging: new ecs.AwsLogDriver(this, 'worker-logs', {
        streamPrefix: 'worker'
      })
    });

    // Launch the image as a service in Fargate
    this.worker = new ecs.FargateService(this, 'worker', {
      cluster: props.cluster,
      desiredCount: 2,
      taskDefinition: this.workerDefinition,
    });
  }
}

class App extends cdk.App {
  constructor(argv) {
    super(argv);

    this.baseResources = new BaseResources(this, 'base-resources');

    this.api = new API(this, 'api', {
      cluster: this.baseResources.cluster
    });

    this.worker = new Worker(this, 'worker', {
      cluster: this.baseResources.cluster
    });
  }
}

new App().run();
