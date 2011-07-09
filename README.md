
** under construction **

READ AS PLAINTEXT (not markdown formatted yet)

logentries.com

to install:
git clone git://github.com/rjrodger/node-logentries.git


example in examples folder bases on nodejs.org http server example on main page
  edit to add live logentries
  node http-server.js
  visit http://127.0.0.1:1337/foo in browser
  view log entries on logentries.com admin interfacxe

  try running without changing config first to see error msg

  NOTE: to run you will need to link module locally so that require('node-logentries') works:
  in node-logentries folder, run two commands:
    sudo npm link
    npm link logentries

unit tests in test folder
  use expresso to run: (npm install --global expresso)
    expresso logentries.test.js # wait 5-10 seconds

acceptance tests in accept folder:
  - copy conf.js to conf.mine.js and add settings for real logentries a/c - this is not a config file - just used for acceptance tests
  - to run:
      cd accept
      node live.accept.js    # logs test data directly via PUT to api.logentries.com
      node winston.accept.js # logs same test data, via winston
  
   check logentries.com web admin to see logs




to use:

var logentries = require('node-logentries')

var log = logentries.logger({
  userkey:'YOUR_USER_KEY',
  host:'YOUR_HOST',
  log:'YOUR_LOG_NAME'
})


log.info('log entry data string')

entries queue if connection not available
entries are logged as:
"ISO date" "level" "data string"


API

-- method: constructor( options )
    userkey:    required; logentries user key
    host:       required: logentries host
    log:        required; logentries log name
    transport:  optional; LogEntriesTransport; transport object
    levels:     optional; syslog-style; custom log levels
    printerror: optional; true; print errors to STDERR with console.error

-- method: <level>('log entry data string')
where <level> is string indicating level:     debug, info, etc see lib/logentries.js for defaults
not that levels can be changed - winston uses different ones

-- member: levels
log levels object in form { "level-name": level-rank-int, ... }


-- method: end
close PUT connection

-- method level
set logging level, all logs below this level will be ignored


-- method: on
from events.EventEmitter, events:
  'error': capture any errors
  'log': capture log entries

  see events unit test for example

-- method: winston(winston,opts)
setup winston integration and optionally set logging level

  see winston.accept.js acceptance test





