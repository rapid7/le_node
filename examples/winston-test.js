var winston=require('winston'), le=require('../lib/logentries.js'); // le=require('node-logentries')

var leToken='YOUR_LE_TOKEN', leLog=le.logger({token:leToken});

leLog.winston(winston);

var logger = new winston.Logger({
  transports: [
    new winston.transports.LogentriesLogger({ level: 'debug' }),
    new winston.transports.File({ filename: 'somefile.log', level:'silly' })
  ]
});

//logger.transports.console.level('silly');

logger.log('silly','SILLY Howdy..');
logger.log('debug','DEBUG Howdy..');
logger.log('verbose','VERBOSE Howdy..');
logger.log('info','INFO Howdy..');
logger.log('warn','WARN Howdy..',['what','about','arrays']);
logger.log('error','ERROR Howdy %s %s','template','string',{a:1,b:2},function(){ console.log('Why (TF) would I want to do this?') });
logger.log('Whatever...'); // Nada..?