/* Copyright (c) 2011 Richard Rodger */

var util   = require('util')
var http   = require('http')
var events = require('events')


var MARK = 'logentries: '


function LogEntriesTransport( opts, logger ) {
  var self = this

  var queue = null
  var connected = false
  var req = null

  function process() {

    while( 0 < queue.length ) {
      var entry = queue[0]

      var logline = opts.token + '"' + entry.join('" "') + '"\n';
      
      try {
        queue.shift()
        logger.emit('log',logline)
        req.write(logline)
      }
      catch(e) {
        logger.emit('error',e)
        queue.unshift(entry)
        connected = false
        break
      }
    }
  }


  function connect() {
    if( req ) {
      try {
        req.end()
      }
      catch( e ) {
        logger.emit('error',e)
      }
    }

    var options = {
      host: 'api.logentries.com',
      port: 10000,
      token: opts.token
    }

    logger.emit('connect',options)

    req = http.request(options, function(res) {
      if( 200 != res.statusCode ) {
        res.setEncoding('utf8');

        var err = {
          statusCode: res.statusCode,
          headers: res.headers
        }

        var body = []
        res.on('data',function(chunk){
          body.push(chunk)
        })

        res.on('end',function(){
          try {
            err.body = JSON.parse(body.join(''))
          }
          catch(e) {
            err.body = {msg:body.join('')}
          }
          logger.emit('error',err)
        })
      }
    });

    req.on('error', function(e) {
      logger.emit('error',e)
      connected = false
    });

    if( null != req ) {
      connected = true
      process()
    }
  }


  self.queue = function( q ) {
    queue = q
  }

  self.consume = function() {
    if( connected ) {
      process()
    }
    else {
      connect()
    }
  }

  self.end = function() {
    if( connected && req ) {
      try {
        req.end()
      }
      catch( e ) {
        logger.emit('error',e)
      }
      logger.emit('end')
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
 */
function Logger( opts ) {
  var self = this
  events.EventEmitter.call(self);

  opts = opts || {}

  opts.printerror = 'undefined' == typeof(opts.printerror) ? true : opts.printerror

  // register at least one listener for 'error' as logging failure should not bring down server
  self.on('error',function(err) {
    if( opts.printerror ) {
      console.error(err)
    }
  })

  self.levels = opts.levels || {
    debug     :0,
    info      :1,
    notice    :2,
    warning   :3,
    err       :4,
    crit      :5,
    alert     :6,
    emerg     :7,
  }

  var transport = opts.transport || new LogEntriesTransport(opts,self)
  var loglevel = -1
  var levelname
  var queue = []

  transport.queue(queue)
  

  for( level in self.levels ) {
    if( !({log:1,end:1,level:1,levels:1,on:1,once:1}[level]) ) {
      self[level] = function(level) {
        return function() {
          var args = Array.prototype.slice.call(arguments)
          args.unshift(level)
          self.log.apply(self,args)
        }
      }(level)
    }
  }


  self.log = function() {
    var args = Array.prototype.slice.call(arguments)
    var arglevel = args[0]
    var levelval = self.levels[arglevel]
    var timestamp = 
      opts.timestamp === undefined || opts.timestamp === true ? true : false;
      
    if( undefined == levelval ) {
      self.emit('error','unknown log level: '+arglevel)
    }

    if( loglevel <= levelval  ) {

      var data = args[1]
      if( data && data.toISOString && data.getTimezoneOffset ) {
        args[1] = data.toISOString();
      }
            
      else if( 'object' == typeof( data ) || Array.isArray(data) ) {
        args[1] = JSON.stringify(data);
      }
      else {
        args[1] = ''+data;
      }
            
      if (timestamp) {
        t = new Date().toISOString();
        args.unshift(t);
      }
      
      //console.log('args: ', args);
      queue.push(args)
      transport.consume()
    }
  }

  
  self.end = function() {
    transport.end && transport.end()
  }

  
  self.level = function(level) {

    if( undefined != level ) {
      if( undefined != self.levels[level] ) {
        loglevel = self.levels[level]
        levelname = level

        if( self.winstonLogger ) {
          self.winstonLogger.level = levelname
        }
      }
      else {
        throw new Error('unknown log level: '+level)
      }
    }

    return levelname
  }

  
  self.winston = function(winston,opts) {
    for( var l in self.levels ) {
      delete self[l]
    }

    self.levels = winston.levels

    if( !winston.transports.LogentriesLogger )  {
      var LogentriesLogger = winston.transports.LogentriesLogger = function (options) {
        this.name = 'logentries';

        this.level = options.level || 'info'

        if( options.level ) {
          self.level(options.level)
        }

        self.winstonLogger = this
      }
      
      util.inherits(LogentriesLogger, winston.Transport)
      
      LogentriesLogger.prototype.log = function (level, msg, meta, callback) {
        var data = msg + (meta?' '+JSON.stringify(meta):'')
        self.log(level,data)
        callback(null, true); 
      }
    }

    winston.add(LogentriesLogger,opts)
  }


}
util.inherits(Logger, events.EventEmitter);



exports.logger = function(opts) {
  return new Logger(opts)
}

