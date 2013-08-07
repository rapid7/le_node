
var logentries = require('../lib/logentries')

var conf = require('./conf.mine.js')
var log = logentries.logger(conf)

var generate = require('./generate.js')

var startTime = Date.now();
var endtime = startTime + 20000;

generate(log,'live with space')

function activeHandles() {
	var numActiveHandles = process._getActiveHandles().length;
	if (numActiveHandles === 1) {
		console.log("Only handle monitoring handles left. Everything is OK.")
		process.exit(0)
	} else if (Date.now() > endtime) {
		console.log("Looks like process is not going to end naturally. Something is keeping it alive.")
		process.exit(1)
	} else {
		// Check again in a second
		setTimeout(activeHandles, 1000)
	}
}

if (process._getActiveHandles) {
	setTimeout(activeHandles, 1000);
}