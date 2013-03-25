
var logentries = require('../lib/logentries'),
	conf = require('./conf.mine.js'),
	log = logentries.logger(conf),
	NUM_LOGS_TO_SEND = 1000 * 1000,
	NUM_LOGS_PER_INTERVAL = 1000,
	INTERVAL = 1000,
	LOG_MESSAGE = "This is the log message that will be sent to Logentries. ";

console.log("Starting: " + new Date());

function sendLogs(startIndex) {
	if (startIndex >= NUM_LOGS_TO_SEND) {
		console.log("Finished: " + new Date());
		log.end();
	} else {
		var endIndex = startIndex + NUM_LOGS_PER_INTERVAL;
		console.log("Sending: " + startIndex + " to " + endIndex);
		for (var i = startIndex; i < endIndex; i++) {
			log.log("err", LOG_MESSAGE + i);
		}
		setTimeout(function() { sendLogs(endIndex); }, INTERVAL);
	}
}

sendLogs(0);
