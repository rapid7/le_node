# node-logentries

** A Node.js wrapper for [logentries.com](http://logentries.com) **

If you're using this library, feel free to contact me on twitter if you have any questions! :) [@rjrodger](http://twitter.com/rjrodger)

Current Version: 0.1.3

Tested on: node 0.4.9


# What it is

An easy-to-use wrapper for the logentries.com service. The _node-logentries_ module makes it very easy to log directly to your logentries.com account direct from Node.js!
This module is also completely compatible with [winston](https://github.com/indexzero/winston).

```javascript
var logentries = require('node-logentries')

var log = logentries.logger({
  token:'YOUR_TOKEN'
})

// level specific methods like 'info', 'debug', etc.
log.info("I'm a Lumberjack and I'm OK")

// generic log method, also accepts JSON entries
log.log("debug", {sleep:"all night", work:"all day"})

// use as a winston transport
var winston = require('winston')
log.winston( winston )

// specify custom levels when using as winston transport
log.winston( winston, { level: 'silly', levels: { silly: 0, info: 1, error: 2} })

```

# Key Features:

   * simple API
   * fully configurable
   * also an EventEmitter
   * winston compatible
   * fully tested

Core Methods:

   * _{debug,info,...}( log_entry )_ : log entry at _debug,info,..._ level (configurable)   
   * _log( level_name, log_entry )_ : log entry at _level_name_
   * _on( event_name, callback )_ : listen for _error_ and _log_ events
   * _level( level_name )_ : discard entries below this level
   * _winston( winston, options )_ : register as a transport with winston
   * _end_ : close connection to logentries.com (unsent logs remain queued)


## Installation

    npm install node-logentries

And in your code:

    var logentries = require('node-logentries')

Or clone the git repository:
    git clone git://github.com/rjrodger/node-logentries.git

The node-logentries module does not depend on any non-core modules.

You also need a logentries.com account - [get started with logentries.com](https://logentries.com/docs/configure/#section9)


## Usage


This module sends your logging entries to the logentries.com service. You will need an account with this service for the module to work.

Once you have logentries.com account, you need just one configuration item to initialize a logging instance (you can create more than one):

  * TOKEN: As supplied by Logentries when you create a logfile of source type Token TCP.

The module provides you with a set of logging methods that correspond to the standard syslog log levels. These are, in order of increasing severity:

  * debug    
  * info     
  * notice   
  * warning  
  * err      
  * crit     
  * alert    
  * emerg    

You can change these levels using the _levels_ configuration option (see below).

Each level has a convenience method named after it, so you can say
_logger.debug(...)_ or _logger.info(...)_, for example. There is also
a general logging method, _log_, that takes the name of the log level as the first entry.

To create a logging instance, call the _logger_ function of the module, passing any options as the first argument:

```
var mylogger = require('node-logentries').logger({
  levels: {
    chill:0, meh:1, hmm:2, notgood:3, ohnoes:4, omgwtfbbq:5
  }
})
```

Each logger object is an instance of [EventEmitter](http://nodejs.org/docs/v0.4.10/api/events.html#events.EventEmitter). You can listen for the following events:

  * _log_: capture each log event (maybe for your own archive)
  * _error_: get notification of any errors in the logging system itself


## Conventions

The standard syslog log levels are used by default: debug, info, notice, warning, err, crit , alert, emerg.    

However, if installed as a winston transport (using the _winston_ method), then the winston levels are used: silly, verbose, info, warn, debug, error.


## API

For the API examples, assume the following lines of code at the top of your source code file:

    var logentries = require('node-logentries')

    var log = logentries.logger({
      token:'YOUR_TOKEN'
    })

This gives you a standard _log_ object.

You should really also read the logentries.com documentation so that you understand how logentries.com works: 
[logentries.com User Guide](https://logentries.com/docs/userguide)

### Configuration Options

When you create a _log_ object with the _logger_ function on the module, you can supply the following options:

   * _token_:    required; logentries destination token uuid
   * _secure_:     optional; default is false; use tls for communication
   * _transport_:  optional; default is LogEntriesTransport; transport object
   * _levels_:     optional; default is syslog-style; custom log levels
   * _printerror_: optional; default is true; print errors to STDERR with console.error
   * _timestamp_: optional; default is true; autogenerate a timestamp
   * _usequotes_: optional; default is false; add double quotes around every field

The _token_  entry relates to your logentries.com configuration. The _transport_ option allows you to 
provide an alternative transport implementation (see below). 

By default the module will print errors to STDOUT to aid with debugging in a development context. To run this off,
set the _printerror_ option to false.

The levels option lets you specify custom log levels. You provide these as a object, the property names of which are the
log levels. The value of each log level should be an integer specifying its order. For example:

    { lowest:0, lower:1, middle:2, higher:3, highest:4 }



### `<loglevel>`: `log.<logelevel>( entry )`

  * _entry_: (required) log entry, can be string or JSON object

Submit a log entry. The entry data will be submitted to logentries.com. If a logging connection to logentries.com is not open,
a connection will be opened, and any pending entries will be processed in order.

    log.info('buttered scones for tea')

The log level and an optional timestamp are prefixed (in that order) to the log entry, and will be present in the logentries.com console.

The <loglevel> convenience methods are dynamically constructed from the configured list of logging levels, a method being constructed for each level,
having the name of the level. If you're naughty and use log levels like 'log' and 'level', they will be ignored.


### log: `log.log(level,entry)`

  * _level_: (required) the name of the log level (must match one of the configured levels)
  * _entry_: (required) log entry, can be string or JSON object

Submit a log entry, passing the name of the level programmatically. The dynamically constructed convenience methods, 
such as _debug_, delegate to this method internally.

    log.log('debug','press wild flowers')

A log entry will only be submitted if the log level is greater than or equal to the current log level setting of the logger.
This allows you to drop noisy debugging logs from production environments.


### on: `log.on(event,callback)`

  * _event_: (required) one of _error_ or _log_
  * _callback_: (required) callback function

This method is provided by the standard Node _EventEmitter_. Register callback functions to get notified of errors.
The module cannot log errors itself, as it has nowhere to log them! Hosted environments may not provide writable disk access.
Therefore, the module simply emits an error event that you can listen for. The module does also print errors to STDOUT by default,
to help with debugging. Use the _printerror_ configuration setting to control this (see above).

    log.on('error',function(err){
       console.log('hangs around.... In bars!? '+err )
    }

You may also need to gain access to the verbatim log lines. You can listen to the _log_ event to do this:


    log.on('log',function(logline){
       console.log( logline )
    }

This gives you the logline, a single string in the format:

    "level" "ISODate" "entry"


### level: `log.level(name)`

  * _name_: (required) the name of the level

Set the current log level. All log entries below this level will be ignored. All log levels are given an integer rank when they
are specified. The default rankings are:


    {
      debug     :0,
      info      :1,
      notice    :2,
      warning   :3,
      err       :4,
      crit      :5,
      alert     :6,
      emerg     :7,
   }

For example, if you specify a level of _warning_, then log entries at levels _debug_, _info_, and _notice_ will be dropped.

    log.level('warning')


### winston: `log.winston( winston, options )`

  * _winston_: (required) winston module
  * _options_: (optional) set the winston level _{level:'silly'}_

The node-logentries module is fully compatible with the
[winston](https://github.com/indexzero/winston) logging module.  To
log to logentries.com using winston, use the _winston_ method. This
takes care of all the transport object registration and set up for
you. The winston log levels are automatically configured as the
current log levels.

There is an optional second argument to specify some integration options. At present this only lets you set the winston log level,
(which is _info_ by default).

    var winston = require('winston')
    log.winston( winston, {level:'silly'} )
   
    // then use winston as normal
    winston.info('And I thought you were so rugged!')

With the winston API, you can specify a _meta_ parameter to a log
entry. The node-logentries module converts this to a JSON string and
appends it to the log entry string.


### end: `log.end()`

This module maintains an open HTTP connection to _api.logentries.com_, so that logging will be fast and efficient.
If the connection breaks, it is automatically reestablished.

If you need to close the connection, call the end method. This primarily useful for unit testing to exit the test process.
NOTE: if you submit further log entries after calling end, the connection will be reopened.

If you need finer grained control, then you will need to write your own transport object, or extend the existing one. See the _lib/logentries.js_ file.



## Transports

This module uses a transport object to perform the actual transfer of
data to logentries.com. You provide your own customized transport
object by using the _transport_ configuration option.

If you are implementing your own transport object, you need to provide these interface methods:

   * _queue( queue )_ : gives you an array to use as a queue, _Array.shift_ items off
   * _consume()_ : process outstanding items in the queue by sending them to logentries.com
   * _end()_ : (optional) close connection to logentries.com

Take a look at the unit tests (in _test_ folder) to see some simple implementations.


## Testing

The unit tests use [mocha](http://visionmedia.github.com/mocha/), and are in the _test_ folder.

    mocha test/logentries.test.js

The acceptance tests (these push actual data to the live logentries.com service) are simple node scripts, and are in the _accept_ folder.
Copy the _accept/conf.js_ file to _accept/conf.mine.js_ and add the token for your log file. Run directly:

    node live.accept.js



## logentries.com service.

Company site: [logentries.com](http://logentries.com)


