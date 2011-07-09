
var logentries = require('node-logentries')

var log = logentries.logger({
  userkey:'YOUR_USER_KEY',
  host:'YOUR_HOST',
  log:'YOUR_LOG_NAME'
})

log.on('error',function(err){
  console.log('LOG ERROR: ', err)
})

var http = require('http');
http.createServer(function (req, res) {

  log.info( req.connection.remoteAddress+', '+req.method+', '+req.url)

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(1337, "127.0.0.1");
console.log('Server running at http://127.0.0.1:1337/');