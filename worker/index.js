const Squiss = require('squiss');
const AWS = require('aws-sdk');
const puppeteer = require('puppeteer');
const DocumentClient = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();

// Configure the SQS queue to watch for jobs.
var workQueue = new Squiss({
  queueUrl: process.env.QUEUE_URL,
  bodyFormat: 'json',
  maxInFlight: 3
});

// What to do when a job pops up on the queue.
workQueue.on('message', async function(msg) {
  console.log(`Job ${msg.body.id}, rendering ${msg.body.uri}`);

  // Update the status to started
  await DocumentClient.update({
    TableName: process.env.TABLE,
    Key: { id: msg.body.id },
    UpdateExpression: 'SET #s = :s',
    ExpressionAttributeNames: {
      '#s': 'status'
    },
    ExpressionAttributeValues: {
      ':s': 'started'
    }
  }).promise();

  let uri;

  try {
    const browser = await puppeteer.launch({
      args: [
        // Disable sandbox, its preferable to granting CAP_SYS_ADMIN to enable sandbox
        // Fargate tasks have their own isolation model anyway.
        '--no-sandbox', '--disable-setuid-sandbox',
        // Use local /tmp instead of shared memory
        '--disable-dev-shm-usage'
      ]
    });
    const page = await browser.newPage();

    page.setViewport({
      width: 2560,
      height: 1600
    });

    await page.goto(msg.body.uri);

    console.log(`Opened ${msg.body.uri}, now rendering to PNG`);

    // Grab a screenshot of the full page into an in-memory buffer
    const buffer = await page.screenshot({ fullPage: true });

    console.log(`Saving PNG for ${msg.body.id} to S3`);

    // Upload the binary data to S3
    var key = `${msg.body.id}.png`;

    await S3.putObject({
      Bucket: process.env.BUCKET,
      Key: key,
      Body: buffer,
      ACL: 'public-read',
      ContentType: 'image/png'
    }).promise();

    uri = `https://s3.amazonaws.com/${process.env.BUCKET}/${key}`;
    console.log(`PNG saved to ${uri}`);
  } catch (e) {
    console.error(e);

    // Update job status to failed
    await DocumentClient.update({
      TableName: process.env.TABLE,
      Key: { id: msg.body.id },
      UpdateExpression: 'SET #s = :s, #r = :r',
      ExpressionAttributeNames: {
        '#s': 'status',
        '#r': 'reason'
      },
      ExpressionAttributeValues: {
        ':s': 'failed',
        ':r': e.toString()
      }
    }).promise();

    return msg.del();
  }

  // Update job status to done
  await DocumentClient.update({
    TableName: process.env.TABLE,
    Key: { id: msg.body.id },
    UpdateExpression: 'SET #s = :s, #u = :u',
    ExpressionAttributeNames: {
      '#s': 'status',
      '#u': 'uri'
    },
    ExpressionAttributeValues: {
      ':s': 'done',
      ':u': uri
    }
  }).promise();

  console.log(`Done with job ${msg.body.id}`);
  msg.del();
});

// This handler executes when the process is told to shutdown,
// this happens when ECS stops a task and docker sends SIGTERM to
// the container.
process.on('SIGTERM', function() {
  console.log('Shutting down');

  // Stop listening for new jobs off the queue.
  workQueue.stop();
});

// Let's get started!
workQueue.start();
console.log('Started listening for work');
