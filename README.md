# le_node

A ([winston](https://github.com/indexzero/winston) compatible) Node.js module for logging directly to your [logentries.com](http://logentries.com) account.

 *( Note: this new le_node module is a significanat rewrite, and may not be 100% compatible with the older node-logentries module. Let me know if you have any issues or suggestions. Thanks... )*

```javascript
    var logentries = require('le_node')

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

Core Methods:

* __{debug,info,...}__(log_entry) : log entry at _debug,info,..._ level (configurable)   
* __log__(level_name, log_entry) : log entry at _level_name_
* __on__(event_name, callback) : listen for logger events
* __level__(level_name) : discard entries below this level
* __winston__(winston, options) : register as a transport with winston
* __end__() : close connection to logentries.com (unsent logs remain queued)


## Installation

    npm install le_node

And in your code:

```javascript
    var logentries = require('le_node')
```
Or clone the git repository:
git clone git://github.com/rjrodger/le_node.git

The le_node module does not depend on any non-core modules.

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

```javascript
    var le = require('le_node');
    le.logger({ levels: { chill:0, meh:1, hmm:2, notgood:3, ohnoes:4, omgwtfbbq:5 } })
```
Each logger object is an instance of [EventEmitter](http://nodejs.org/docs/v0.4.10/api/events.html#events.EventEmitter). You can listen for the following events:

* __connect :__ notification of sucessful connection to Logentries service
* __error :__ notification of any errors in the logging system itself
* __log :__ capture each log event (maybe for your own archive)
* __close :__ notification of socket Close event (disconnection from Logentries service, automatic reconnect will be attempted)
* __end :__ notification of socket End event (usually after you invoke logger.end())


## Conventions

The standard syslog log levels are used by default: debug, info, notice, warning, err, crit , alert, emerg.    
However, if installed as a winston transport (using the _winston_ method), then the winston levels are used: silly, verbose, info, warn, debug, error.


## API

For the API examples, assume the following lines of code at the top of your source code file:

```javascript
    var logentries = require('le_node')
    var log = logentries.logger({ token:'YOUR_TOKEN' })
```
This gives you a standard _log_ object.

You should really also read the logentries.com documentation so that you understand how logentries.com works: 
[logentries.com User Guide](https://logentries.com/docs/userguide)

### Configuration Options

When you create a _log_ object with the _logger_ function on the module, you can supply the following options:

* __token :__    required; logentries destination token uuid
* __secure :__     optional; default is false; use tls for communication
* __levels :__     optional; default is syslog-style; custom log levels
* __timestamp :__ optional; default is true; autogenerate a timestamp

The _token_  entry relates to your logentries.com configuration. The _transport_ option allows you to 
provide an alternative transport implementation (see below). 

The levels option lets you specify custom log levels. You provide these as a object, the property names of which are the
log levels. The value of each log level should be an integer specifying its order. For example:

```javascript
    { lowest:0, lower:1, middle:2, higher:3, highest:4 }
```

### `<loglevel>`: `log.<logelevel>( entry )`

* __entry :__ (required) log entry, can be string or JSON object

Submit a log entry. The entry data will be submitted to logentries.com. If a logging connection to logentries.com is not open, a connection will be opened, and any pending entries will be processed in order.

```javascript
    log.info('buttered scones for tea')
```
The log level and an optional timestamp are prefixed to the log entry, and will be present in the logentries.com console.

The <loglevel> convenience methods are dynamically constructed from the configured list of logging levels, a method being constructed for each level, having the name of the level. If you use invalid log levels like 'log', 'level', 'on' or 'end', they will be ignored.

### `log.log(level,entry)`

* __level :__ (required) the name of the log level (must match one of the configured levels)
* __entry :__ (required) log entry, can be string or JSON object

Submit a log entry, passing the name of the level programmatically. The dynamically constructed convenience methods, 
such as _debug_, delegate to this method internally.

```javascript
    log.log('debug','press wild flowers')
```
A log entry will only be submitted if the log level is greater than or equal to the current log level setting of the logger. This allows you to drop noisy debugging logs from production environments.

If the only element passed to logger is a pure Javascript object, eg.

```javascript
        log.info({ a:1, b:2, c:3 })
```
then the level name (and optional timestamp) will be added to the object rather than prepended as strings.
This enables leWeb interface to present structured JSON, in place of simple text.

### `log.on(event,callback)`

* _event_: (required) one of _error_ or _log_
* _callback_: (required) callback function

This method is provided by the standard Node _EventEmitter_. Register callback functions to get notified of errors.
The module cannot log errors itself, as it has nowhere to log them! Hosted environments may not provide writable disk access.
Therefore, the module simply emits an error event that you can listen for. The module does also print errors to STDOUT by default, to help with debugging. 
Use the _printerror_ configuration setting to control this (see above).

```javascript
    log.on('error',function(err){
      console.log('hangs around.... In bars!? '+err )
    }
```
You may also need to gain access to the verbatim log lines. You can listen to the _log_ event to do this:

```javascript
    log.on('log',function(logline){
      console.log( logline )
    }
```
### `log.level(name)`

* __name :__ (required) the name of the level

Set the current log level. All log entries below this level will be ignored. All log levels are given an integer rank when they
are specified. The default rankings are:


```javascript
    {
      debug     :0,
      info      :1,
      notice    :2,
      warning   :3,
      err       :4,
      crit      :5,
      alert     :6,
      emerg     :7
    }
```
For example, if you specify a level of _warning_, then log entries at levels _debug_, _info_, and _notice_ will be dropped.

```javascript
    log.level('warning')
```

### winston: `log.winston( winston, options )`

* __winston :__ (required) winston module
* __options :__ (optional) set the winston level _{level:'silly'}_

The le_node module is fully compatible with the
[winston](https://github.com/indexzero/winston) logging module.  To
log to logentries.com using winston, use the _winston_ method. This
takes care of all the transport object registration and set up for
you. The winston log levels are automatically configured as the
current log levels.

There is an optional second argument to specify some integration options. At present this only lets you set the winston log level,
(which is _info_ by default).

```javascript
    var winston = require('winston')
    log.winston( winston, {level:'silly'} )

    // then use winston as normal
    winston.info('And I thought you were so rugged!')
```
With the winston API, you can specify a _meta_ parameter to a log
entry. The le_node module converts this to a JSON string and
appends it to the log entry string.


### `log.end()`

This module maintains an open HTTP connection to _api.logentries.com_, so that logging will be fast and efficient.

If you need to close the connection, call the end method. This primarily useful for unit testing to exit the test process.

## Testing

The unit tests use [mocha](http://visionmedia.github.com/mocha/), and are in the _test_ folder.

```javascript
    mocha test/le_node.test.js
```
