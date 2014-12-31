var http=require('http'), le=require('../lib/logentries.js'); // le=require('node-logentries')

var leToken='YOUR_LE_TOKEN', log=le.logger({token:leToken});

log.on('error',function(err){
  console.log('LOG ERROR: ', err);
})

http.createServer(function(req, res){
  log.debug(req.connection.remoteAddress+', '+req.method+', '+req.url);
  if(req.url!='/favicon.ico'){
    log.info('INFO a=124',[1,2,3]);
    log.notice('NOTE b="xyz"',1,2,3);
    log.warning('WARN c:Hello','there');
    log.err('ERROR blah..');
    log.log('debug', {a:1, b:'two'});
    log.log('crap', 'hello');
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Simple log messages sent to LE Token '+leToken+'\n');
}).listen(1337);

console.log('Server running at http://localhost:1337/');
