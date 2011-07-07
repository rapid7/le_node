/* Copyright (c) 2011 Richard Rodger */

var util = require('util')


var MARK = 'logentries: '


function LogEntriesTransport( opts ) {
  var self = this

  self.queue = function() {
  }

  self.consume = function() {
  }
}


function Logger( opts ) {
  var self = this

  opts = opts || {}

  var levels = opts.levels || {
    emerg     :0,
    alert     :1,
    crit      :2,
    err       :3,
    warning   :4,
    notice    :5,
    info      :6,
    debug     :7
  }

  var transport = opts.transport || new LogEntriesTransport(opts)
  var loglevel = 99
  var queue = []

  transport.queue(queue)
  

  function makelevels() {
    for( level in levels ) {
      self[level] = function(level) {
        return function() {
          var args = Array.prototype.slice.call(arguments)
          args.unshift(level)
          self.log.apply(self,args)
        }
      }(level)
    }
  }

  makelevels()

  self.log = function() {
    var args = Array.prototype.slice.call(arguments)
    var arglevel = args[0]
    var levelval = levels[arglevel]

    if( levelval <= loglevel ) {
      queue.push(args)
      transport.consume()
    }
  }

  
  self.level = function(l) {
    if( 'number' == typeof( l ) ) {
      loglevel = l
    }
    else if( levels[l] ) {
      loglevel = levels[l]
    }
  }
}


exports.logger = function(opts) {
  return new Logger(opts)
}

