var assert = require('assert'), le = require('../lib/logentries.js'); // le=require('node-logentries')
var myToken = '1ed3e842-b5a1-4a8d-9783-0f266e7a6a4d';
var logger = le.logger({ token: myToken });
var errs=[], lines=[];

logger.on('error',function(err){
  errs.push(err);
})

logger.on('log',function(line){
  lines.push(line);
})

function logStuff(){
  console.log('Logging Stuff');
  errs = [];
  lines = [];
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
  //log.crap("CRAP - this should throw an error and exit");
  logger.log('crap', 'this should generate a logger error');
}


describe('logentries node logger default level=info',function(){
  
  logStuff();
  var len=lines.length; // TODO - figure out asynch mocha weirdness...
  
  it('should have logged 8 output lines (all bar debug)', function(){
    console.log('lines',lines.length);
    assert(len==8);
  });
  
  it('should have a few pointless random checks', function(){
    assert(lines[0].length==93);
    var n = myToken.length;
    assert(lines[0].substr(0,n)==myToken);
   });
  
  it('should have one log error', function() {
    assert(errs.length==1 && errs[0].length==23);
  });

});


describe('logentries node logger level=warning',function(){

  logger.level('warning');
  logStuff();

  it('should have logged 5 output lines (all bar debug, info and notice)', function(){
    assert(lines.length==5);
  });

});

logger.end();
