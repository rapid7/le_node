
var logentries = require('../lib/logentries')

var conf = require('./conf.mine.js')
var log = logentries.logger(conf)

var generate = require('./generate.js')

generate(log,'live')
