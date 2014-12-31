// Copyright 2014 logentries.com
var net=require('net'), tls=require('tls'), evt=require('events'), util=require('util');

function Logger(ops){
  
  var self=this, badLevelNames=['log','end','level','levels','on','once'];
  var options = {
    host: ops.host || 'api.logentries.com',
    port: ops.secure ? 20000 : 10000,
    token: ops.token
  }
  var sok = ops.secure ? tls.connect(options.port, options.host) : net.createConnection(options.port, options.host);

  self.levels = ops.levels || { debug:0, info:1, notice:2, warning:3, err:4, crit:5, alert:6, emerg:7 };
  self.minLevel = 1;

  // Create a named function for each level (dumb convenience!)
  for(var lx in self.levels) if(badLevelNames.indexOf(lx)<0) self[lx] = function(l){
    return function(){
      var args = Array.prototype.slice.call(arguments);
      args.unshift(l);
      self.log.apply(self,args);
    }
  }(lx);
 
  // Format and output log message
  self.log = function(){
    var a=arguments, line=ops.token;
    if(a[0] < self.minlevel) self.emit('error','unknown log level: '+a[0]);
    else{
      for(var i in a) line+=' '+(typeof(a[i])=='object' ? JSON.stringify(a[i]) : a[i]);
      line.replace(/\n/g, '\u2028');
      //console.log(line);
      try{ 
        sok.write(line+'\n');
        self.emit('log',line);
      }catch(e){ self.emit('error',e) }
    }
  };

  // Set min level (by name), below which log messages wil be discarded
  self.level = function(lmin){
    if(self.levels[lmin]>=0){
      self.minLevel = self.levels[lmin];
      if(self.winstonLogger) self.winstonLogger.level = lmin;
    }
  }

  // Register leLogger as transport with winston
  self.winston = function(winston,wops){
    self.levels = (wops && wops.levels) || winston.levels;
    if(!winston.transports.LogentriesLogger){
      var LogentriesLogger = winston.transports.LogentriesLogger = function(op){
        op = op || {};
        this.name = 'logentries';
        this.level = op.level || 'info';
        if(op.level) self.level(op.level);
        self.winstonLogger = this;
      }
      util.inherits(LogentriesLogger, winston.Transport);
      LogentriesLogger.prototype.log = function(level,msg,meta,callback){
        var data = msg + (meta ? ' '+JSON.stringify(meta) : '');
        self.log(level,data);
        callback(null, true); 
      }
    }
    winston.add(LogentriesLogger,wops);
  }
  
}

util.inherits(Logger, evt.EventEmitter);
exports.logger = function(o){ return new Logger(o) }
