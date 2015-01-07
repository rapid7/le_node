// Test logentries log service as transport in winston

var winston=require('winston'), le=require('../lib/logentries.js'); // le=require('node-logentries')

var leToken='YOUR_LE_TOKEN', leLog=le.logger({token:leToken});

leLog.winston(winston);

var wl = new winston.Logger({
  transports: [
    new winston.transports.LogentriesLogger({ level: 'debug' }),
    new winston.transports.File({ filename: 'winston.out', level:'silly' })
  ]
});

wl.log('silly', 'SILLY Howdy..');
wl.log('debug', 'DEBUG Howdy..');
wl.log('verbose', 'VERBOSE Howdy..');
wl.log('info', 'INFO Howdy..');
wl.log('warn', 'WARN Howdy..', ['what','about','arrays']);
wl.log('error', 'ERROR Howdy %s %s', 'template', 'string', {a:1, b:2}, function(){ console.log('Why would I want to do this?') });
wl.log('Whatever...'); // Should do nothing!

leLog.end();

console.log('Finished');
