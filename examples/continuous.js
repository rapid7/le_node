// Test logentries log service. You must insert your logentries token below !

var le = require('../lib/le_node.js'); // le=require('le_node')
var logger = le.logger({ token: 'YOUR_LE_TOKEN' });

logger.on('connect',function(){ console.log('LE CONNECT') });
logger.on('error',function(e){ console.log('LE ERROR', e) });
logger.on('close',function(e){ console.log('LE CLOSE', e?'Socket Error':'Normal') });
logger.on('end',function(e){ console.log('LE END', e) });
logger.on('log',function(s){ /*console.log('LE LOGGED',s)*/ });

function logStuff(){
  //console.log('TICK');
  logger.debug('DEBUG - The bottom of the log food chain');
  logger.info('INFO - a=124 b=456',[1,2,3]);
  logger.notice('NOTICE - b="xyz"',1,2,3);
  logger.warning('WARNING - c:Hello','there');
  logger.err('ERROR - blah..');
  logger.log('debug', 'This sould work the same as log.debug().. Yeah..?!',{a:1, b:'two'});
  logger.notice('NOTICE - Deeper object',{ a:1, b:{ c:2, d:[ {a:1, b:2}, {c:1, d:2} ] } });
  logger.crit('CRITICAL - message that could not be delivered without having a .crit() function..?');
  logger.alert('ALERT - Very different from CRIT');
  logger.emerg({ A:"Pure JS object", That:"should display as JSON in leWeb", In:"theory" });
}

setInterval(logStuff,3000);
