const express = require('express');
const morgan = require('morgan');
const app = express();

// Log requests
app.use(morgan('tiny'));

// Simple healthcheck route so the load balancer
// knows that the application is up and accepting requests
app.get('/', async function(req, res) {
  res.send('Placeholder up and running!');
});

app.listen(process.env.PORT || 80);

console.log('API up and running');
