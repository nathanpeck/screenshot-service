function poll() {
  console.log('Checking for work');
}

var interval = setInterval(poll, 2000);

process.on('SIGTERM', function() {
  clearInterval(interval);
});
