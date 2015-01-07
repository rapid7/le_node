"use strict";

var util = require('util'),  
    net = require('net'), 
    tls = require('tls'), 
    events = require('events');


function LogEntriesTransport(opts, logger){

  var self = this,
      queue = null,
      connected = false,
      connecting = false,
      socket = null,
      usequotes = !!opts.usequotes;


  function process(){
    console.log('PROCESS',queue);
    while(queue.length > 0){
      
      var entry=queue[0], logline=opts.token;   
      console.log('ENTRY',entry);

      logline += usequotes ? ('"'+entry.join('" "')+'"\n') : (' '+entry.join(' ')+'\n');
      console.log('LOGLINE',entry);
      
      try{
        queue.shift();
        logger.emit('log',logline);
        socket.write(logline);
      }
      catch(e){
        logger.emit('error',e);
        queue.unshift(entry);
        connected = false;
        connecting = false;
        break;
      }
    }
  }


  function connect(){

    if(socket){
      try{
        socket.end();
      }
      catch(e){
        logger.emit('error',e);
      }
    }

    var options = {
      host: opts.host || 'api.logentries.com',
      port: opts.secure ? 20000 : 10000,
      token: opts.token
    }

    logger.emit('connect',options);

    socket = opts.secure ? tls.connect(options.port, options.host, secureConnection) : net.createConnection(options.port, options.host);

    connecting = true;

    function handleConnection(){
      connecting = false;
      connected = true;
      process();
    }

    function handleError(e){
      logger.emit('error',e);
      connected = false;
      connecting = false;
    }

    function secureConnection(){
      if(!socket.authorized) handleError(new Error(socket.authorizationError)); // tls module will accept all certs by default
      else handleConnection()
    }

    socket.on('connect', handleConnection);

    socket.on('error', handleError);

    socket.on('close', function(){
      connected = false;
      connecting = false;
    });
  }


  self.queue = function(q){
    queue = q;
  }

  self.consume = function(){
    if(connected) process();
    else if(!connecting) connect();
  }

  self.end = function(){
    if(socket){
      try{
        socket.end();
      }
      catch(e){
        logger.emit('error',e);
      }
      logger.emit('end');
    }
  }
}


/*
 *  opts:
 *    token:    required; Logentries Destination Token UUID
 *
 *    transport:  LogEntriesTransport; transport object
 *    levels:     syslog-style; custom log levels
 *    printerror: true; print errors to STDERR with console.error
 *    secure: false; Use tls for communication 
 *    flatten: true; JSON entries will be flattened.
 */
function Logger( opts ) {
  var self = this;
  events.EventEmitter.call(self); // Huh..?

  opts = opts || {};

  opts.printerror = typeof(opts.printerror)=='undefined' ? true : opts.printerror;
  opts.flatten = typeof(opts.flatten)=='undefined' ? true : opts.flatten;

  // register at least one listener for 'error' as logging failure should not bring down server
  self.on('error',function(err){
    if(opts.printerror) console.error(err);
  })

  self.levels = opts.levels || {
    debug:   0,
    info:    1,
    notice:  2,
    warning: 3,
    err:     4,
    crit:    5,
    alert:   6,
    emerg:   7
  }

  var levelname, queue=[], loglevel=-1,  transport = opts.transport || new LogEntriesTransport(opts,self);

  transport.queue(queue);

  // TODO - this is ugly and incomprehensible...!
  for(var level in self.levels){
    if(!({log:1,end:1,level:1,levels:1,on:1,once:1}[level])){ //WTF??
      self[level] = function(level){
        return function(){
          var args = Array.prototype.slice.call(arguments);
          args.unshift(level);
          self.log.apply(self,args);
        }
      }(level);
    }
  };

  function flatten(json, prefix){
    var result = "";
    Object.keys(json).forEach(function(key){
      var value = json[key];
      if((value && typeof(value) == 'object') || Array.isArray(value)){
        result += flatten(value, prefix + key + ".");
      } 
      else{
        result += prefix + key + "=" + value + " ";
      }
    });
    return result;
  }


  self.log = function(){
    var args = Array.prototype.slice.call(arguments),
        arglevel = args[0],
        levelval = self.levels[arglevel],
        timestamp = opts.timestamp===undefined || opts.timestamp===true;

    if(levelval==undefined) self.emit('error','unknown log level: '+arglevel);

    if(loglevel <= levelval){
      var data = args[1];
      if(data && data.toISOString && data.getTimezoneOffset) args[1] = data.toISOString();
      else if(data && 'object' == typeof( data ) || Array.isArray(data)){
        args[1] = opts.flatten ? flatten(data,'') : JSON.stringify(data);
      }
      else{
        args[1] = '' + data;
      };

      //Replace newlines with unicode line separator
      args[1] = args[1].replace(/\n/g, "\u2028"); // Why?

      if(timestamp){
        args.unshift(new Date().toISOString());
      }

      queue.push(args)
      transport.consume()
    }
  };


  self.end = function(){
    transport.end && transport.end();
  };


  self.level = function(level){
    if(level != undefined){
      if(self.levels[level] != undefined){
        loglevel = self.levels[level];
        levelname = level;
        if(self.winstonLogger) self.winstonLogger.level = levelname
      }
      else{
        throw new Error('unknown log level: '+level)
      }
    }
    return levelname
  }


  self.winston = function(winston,opts){
    for(var l in self.levels){
      delete self[l]; // WTF?
    }

    self.levels = (opts && opts.levels) || winston.levels;

    if(!winston.transports.LogentriesLogger){
      var LogentriesLogger = winston.transports.LogentriesLogger = function(options){
        options = options || {};
        this.name = 'logentries';
        this.level = options.level || 'info';
        if(options.level) self.level(options.level);
        self.winstonLogger = this;
      }
      util.inherits(LogentriesLogger, winston.Transport);

      LogentriesLogger.prototype.log = function(level, msg, meta, callback){
        var data = msg + (meta ? ' '+JSON.stringify(meta) : '');
        self.log(level,data);
        callback(null, true); 
      }
    }

    winston.add(LogentriesLogger,opts);
  }


}
util.inherits(Logger, events.EventEmitter);



exports.logger = function(opts){
  return new Logger(opts);
}
