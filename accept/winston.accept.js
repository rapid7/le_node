
var winston = require('winston');

var logentries = require('../lib/logentries')

var conf = require('./conf.mine.js')
var log = logentries.logger(conf)


log.winston(winston,{level:'silly'})


var generate = require('./generate.js')

winston.end = function() {
  log.end()
}

generate(winston,'winston')
