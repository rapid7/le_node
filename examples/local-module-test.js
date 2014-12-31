var http=require('http'), le=require('../lib/logentries.js');//, winston=require('winston');

var leToken='1ed3e842-b5a1-4a8d-9783-0f266e7a6a4d', log=le.logger({token:leToken});

//log.winston(winston,{
//  transports: [
//    new winston.transports.Console({ level: 'warn' }),
//    new winston.transports.File({ filename: 'somefile.log', level:'silly' })
//  ]
//});

log.on('error',function(err){
  console.log('LOG ERROR: ', err);
})

// Why would I want to do this ?
log.on('log',function(e){
  console.log('LOG EVENT', e);
})

http.createServer(function(req, res){
  log.debug(req.connection.remoteAddress+', '+req.method+', '+req.url);
  if(req.url!='/favicon.ico'){
    log.info('INFO a=124',[1,2,3]);
    log.notice('NOTE b="xyz"',1,2,3);
    log.warning('WARN c:Hello','there');
    log.err('ERROR blah..');
    log.log("debug", {a:1, b:'two'});
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Simple log messages sent to LE Token '+leToken+'\n');
}).listen(1337);

console.log('Server running at http://localhost:1337/');
