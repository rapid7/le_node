var net=require('net'), tls=require('tls'), evt=require('events'), util=require('util');

function Logger(ops){
  var options = {
    host: ops.host || 'api.logentries.com',
    port: ops.secure ? 20000 : 10000,
    token: ops.token
  }
  var sok = ops.secure ? tls.connect(options.port, options.host) : net.createConnection(options.port, options.host);
  
  var self=this, badLevelNames=['log','end','level','levels','on','once'];
  self.levels = ops.levels || { debug:0, info:1, notice:2, warning:3, err:4, crit:5, alert:6, emerg:7 };

  // Create a named function for each level (dumb convenience!)
  for(var lx in self.levels) if(badLevelNames.indexOf(lx)<0) self[lx] = function(l){
    return function(){
      var args = Array.prototype.slice.call(arguments);
      args.unshift(l);
      self.log.apply(self,args);
    }
  }(lx);

  self.log = function(){
    var a=arguments, line=ops.token;
    for(var i in a) line+=' '+(typeof(a[i])=='object' ? JSON.stringify(a[i]) : a[i]);
    //console.log(line);
    try{ sok.write(line+'\n') }
    catch(e){ console.log(e) }
  };
}

util.inherits(Logger, evt.EventEmitter);
exports.logger = function(o){ return new Logger(o) }
