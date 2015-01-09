// Logentries Node module
// Copyright (c) 2014 logentries.com

var net=require('net'), tls=require('tls'), evt=require('events'), util=require('util');

function Logger(ops){
  
  var sok, que=[], connecting, self=this; 
  var badLevelNames = ['log','end','level','levels','on','once'];
  var options = {
    host: ops.host || 'api.logentries.com',
    secure: ops.secure,
    port: ops.secure ? 20000 : 10000,
    token: ops.token,
    timestamp: ops.timestamp!==undefined ? !!ops.timestamp : true
  }
  
  self.levels = ops.levels || { debug:0, info:1, notice:2, warning:3, err:4, crit:5, alert:6, emerg:7 };
  self.minLevel = 1;

  // Create a named function for each level (convenience?!)
  for(var lx in self.levels) if(badLevelNames.indexOf(lx)<0) self[lx] = function(l){
    return function(){
      var args = Array.prototype.slice.call(arguments);
      args.unshift(l);
      self.log.apply(self,args);
    }
  }(lx);

  function processQue(){
    while(sok && sok.writable && que.length){
      var line = que.shift();
      try{
        self.emit('log',line);
        sok.write(line);
      }catch(e){
        self.emit('error',e);
        que.unshift(line);
      }
    }
  }
  
  function connect(op){
    connecting = true;
    if(sok) try{ sok.end() } catch(e){ self.emit('error',e) };
    sok = op.secure ? tls.connect(op.port, op.host, onSecure) : net.createConnection(op.port, op.host);

    function onSecure(){
      if(!sok.authorized) onErr(new Error(sok.authorizationError));
      else onConnect();
    }

    function onConnect(){
      self.emit('connect')
      connecting = false;
      processQue();
    }

    function onErr(e){
      self.emit('error',e);
      connecting = false;
    }

    sok.on('connect', onConnect);
    sok.on('error', onErr);
    sok.on('end', function(e){ self.emit('end',e) });
    sok.on('close', function(e){ self.emit('close',e) });
  }

  // Format and output log message
  self.log = function(){
    var a=arguments, line=ops.token;
    if(a[0]===undefined || self.levels[a[0]]===undefined) self.emit('error','unknown log level: '+a[0]);
    else if(self.levels[a[0]] >= self.minLevel){
      // HACK - if single JSON object then add level and timestamp to object rather than prepend strings.
      if(a.length==2 && typeof(a[1])=='object'){
        a[1].level = a[0];
        if(options.timestamp) a[1].time = new Date().toISOString();
        line+=' '+JSON.stringify(a[1]);
      }else{
        if(options.timestamp) line+=' '+new Date().toISOString();
        for(var i in a) line+=' '+(typeof(a[i])=='object' ? JSON.stringify(a[i]) : a[i]);
      }
      line.replace(/\n/g, '\u2028');
      que.push(line+'\n');
      if(sok && sok.writable) processQue();
      else if(!connecting) connect(options);
    }
  };

  // Set min level (by name), below which log messages wil be discarded
  self.level = function(lmin){
    if(self.levels[lmin]>=0){
      self.minLevel = self.levels[lmin];
      if(self.winstonLogger) self.winstonLogger.level = lmin;
    }
  };
  
  self.end = function(){
    if(sok) try{ sok.end() } catch(e){ self.emit('error',e) }
    self.emit('end');
  };

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
        self.log(level, data);
        callback(null, true); 
      }
    }
    winston.add(LogentriesLogger,wops);
  };
  
}

util.inherits(Logger, evt.EventEmitter);
exports.logger = function(o){ return new Logger(o) }

// Do we need to support multiple logger instances (with different tokens) within single Node app..?
