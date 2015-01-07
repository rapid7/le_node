var le=require('../lib/logentries.js'); // le=require('node-logentries')
var logger = le.logger({ token: '1ed3e842-b5a1-4a8d-9783-0f266e7a6a4d' });

logger.on('error',function(err){
  console.log('LOG ERROR: ', err);
})

logger.on('log',function(logline){
  console.log('LOGGED: ',logline);
})

logger.debug('DEBUG - The bottom of the log food chain');
logger.info('INFO - a=124 b=456',[1,2,3]);
logger.notice('NOTICE - b="xyz"',1,2,3);
logger.warning('WARNING - c:Hello','there');
logger.err('ERROR - blah..');
logger.log('debug', 'This sould work the same as log.debug().. Yeah..?!',{a:1, b:'two'});
logger.notice('NOTICE - Deeper object',{ a:1, b:{ c:2, d:[ {a:1, b:2}, {c:1, d:2} ] } });
logger.crit('CRITICAL - message that could not be delivered without having a .crit() function..?');
logger.alert('ALERT - Very different from CRIT');
logger.emerg('EMERGENCY -The top level of custom log food chain.. Mmm...');

//log.crap("CRAP - this shouldn't work");
logger.log('crap', 'this should generate an error');
logger.end();

console.log('Finished');
