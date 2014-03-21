/* Copyright (c) 2011-2013 Richard Rodger, BSD License */
"use strict";


var util   = require('util')
var net   = require('net')
var tls   = require('tls')
var events = require('events')


function LogEntriesTransport( opts, logger ) {
  var self = this

  var queue = null
  var connected = false
  var connecting = false
  var socket = null
  var usequotes = !!opts.usequotes

  function process() {
    while( 0 < queue.length ) {
      var entry = queue[0]

      var logline = opts.token
      if (usequotes) {
        logline += '"' + entry.join('" "') + '"\n'
      } else {
        logline += ' ' + entry.join(' ') + '\n'
      }
      
      try {
        queue.shift()
        logger.emit('log',logline)
        socket.write(logline)
      }
      catch(e) {
        logger.emit('error',e)
        queue.unshift(entry)
        connected = false
        connecting = false
        break
      }
    }
  }


  function connect() {
    if( socket ) {
      try {
        socket.end()
      }
      catch( e ) {
        logger.emit('error',e)
      }
    }

    var options = {
      host: opts.host || 'api.logentries.com',
      port: opts.secure ? 20000 : 10000,
      token: opts.token
    }

    logger.emit('connect',options)

    if (opts.secure) {
      socket = tls.connect(options.port, options.host, secureConnection)
    } 
    else {
      socket = net.createConnection(options.port, options.host)
    }

    connecting = true

    function handleConnection() {
      connecting = false
      connected = true
      process()
    }

    function handleError(e) {
      logger.emit('error',e)
      connected = false
      connecting = false
    }

    function secureConnection() {
      if (!socket.authorized) {
        /*
         * We need to check this as the tls module will accept all
         * certs by default. Nobody likes a man in the middle attack.
         */
        handleError(new Error(socket.authorizationError))
      } else {
        handleConnection()
      }
    }

    socket.on('connect', handleConnection);

    socket.on('error', handleError)

    socket.on('close', function() {
      connected = false
      connecting = false
    });
  }


  self.queue = function( q ) {
    queue = q
  }

  self.consume = function() {
    if( connected ) {
      process()
    }
    else if (!connecting) {
      connect()
    }
  }

  self.end = function() {
    if( socket ) {
      try {
        socket.end()
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
 *    secure: false; Use tls for communication 
 *    flatten: true; JSON entries will be flattened.
 */
function Logger( opts ) {
  var self = this
  events.EventEmitter.call(self);

  opts = opts || {}

  opts.printerror = 'undefined' == typeof(opts.printerror) ? true : opts.printerror
  opts.flatten = 'undefined' == typeof(opts.flatten) ? true : opts.flatten

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
  

  for( var level in self.levels ) {
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

  function flatten(json, prefix) {
    var result = ""
    Object.keys(json).forEach(function(key) {
      var value = json[key]
      if(value && 'object' == typeof( value ) || Array.isArray(value) ) {
        result += flatten(value, prefix + key + ".")
      } else {
        result += prefix + key + "=" + value + " "
      }
    })
    return result
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
      else if( data && 'object' == typeof( data ) || Array.isArray(data) ) {
        args[1] = opts.flatten ? flatten(data, '') : JSON.stringify(data)
      }
      else {
        args[1] = ''+data
      }
          
	    //Replace newlines with unicode line separator
      args[1] = args[1].replace(/\n/g, "\u2028")
  
      if (timestamp) {
        var t = new Date().toISOString()
        args.unshift(t)
      }
      
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

    self.levels = (opts && opts.levels) || winston.levels

    if( !winston.transports.LogentriesLogger )  {
      var LogentriesLogger = winston.transports.LogentriesLogger = function (options) {
        options = options || {}

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

