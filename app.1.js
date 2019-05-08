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
  }
}

class Worker extends cdk.Stack {
  constructor(parent, id, props) {
    super(parent, id, props);

    // Deploy a worker component
  }
}

class App extends cdk.App {
  constructor(argv) {
    super(argv);

    this.baseResources = new BaseResources(this, 'base-resources');

    this.api = new API(this, 'api', {});

    this.worker = new Worker(this, 'worker', {});
  }
}

new App().run();
