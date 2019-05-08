const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const AWS = require('aws-sdk');
const morgan = require('morgan');
const uuidv1 = require('uuid/v1');
const SQS = new AWS.SQS();
const DocumentClient = new AWS.DynamoDB.DocumentClient();

const QUEUE_URL = process.env.QUEUE_URL;

app.use(morgan('tiny'));
app.use(bodyParser.json());

// Simple healthcheck route so the load balancer
// knows that the application is up and accepting requests
app.get('/', async function(req, res) {
  res.send('Up and running!');
});

// Submit a URI to be screenshot
app.post('/job', async function(req, res) {
  let uri = req.body.uri;

  if (!uri) {
    return res.status(400).send('Expected query parameter `uri` with URI of page to screenshot');
  }

  var id = uuidv1();

  // Add the job to the table
  await DocumentClient.put({
    TableName: process.env.TABLE,
    Item: {
      id: id,
      status: 'submitted',
      sourceUri: uri
    }
  }).promise();

  // Add the job to the queue
  await SQS.sendMessage({
    MessageBody: JSON.stringify({
      id: id,
      uri: uri
    }),
    QueueUrl: QUEUE_URL
  }).promise();

  // Return the job ID to the client
  return res.status(200).send({
    id: id
  });
});

// Get the status of a job using its job ID
app.get('/job/:id', async function(req, res) {
  var status = await DocumentClient.get({
    TableName: process.env.TABLE,
    Key: { id: req.params.id }
  }).promise();

  if (!status.Item) {
    return res.status(400).send('Not Found');
  } else {
    return res.status(200).send(status.Item);
  }
});

app.listen(process.env.PORT || 80);

console.log('API up and running');
