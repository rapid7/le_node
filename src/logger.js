import _ from 'lodash';
import semver from 'semver';
import net from 'net';
import tls from 'tls';
import urlUtil from 'url';
import { Writable } from 'stream';
import codependency from 'codependency';
import reconnectCore from 'reconnect-core';
import * as defaults from './defaults';
import * as levelUtil from './levels';
import text from './text';
import build from './serialize';
import {
    BadOptionsError,
    LogentriesError
} from './error';
import RingBuffer from './ringbuffer';
import BunyanStream from './bunyanstream';

// patterns
const newline = /\n/g;
const tokenPattern = /[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}/;

/**
 * Append log string to provided token.
 *
 * @param log
 * @param token
 */
const finalizeLogString = (log, token) =>
    `${token} ${log.toString().replace(newline, '\u2028')}\n`;

/**
 * Get console method corresponds to lvl
 *
 * @param lvl
 * @returns {*}
 */
const getConsoleMethod = lvl => {
  if (lvl > 3) {
    return 'error';
  } else if (lvl === 3) {
    return 'warn';
  }
  return 'log';
};

/**
 * Get a new prop name that does not exist in the log.
 *
 * @param log
 * @param prop
 * @returns safeProp
 */
const getSafeProp = (log, prop) => {
  let safeProp = prop;
  while (safeProp in log) {
    safeProp = `_${prop}`;
  }
  return safeProp;
};

const requirePeer = codependency.register(module);


/**
 * Logger class that handles parsing of logs and sending logs to Logentries.
 */
class Logger extends Writable {
  constructor(opts) {
    super({
      objectMode: true
    });

    // Sanity checks
    if (_.isUndefined(opts)) {
      throw new BadOptionsError(opts, text.noOptions());
    }

    if (!_.isObject(opts)) {
      throw new BadOptionsError(opts, text.optionsNotObj(typeof opts));
    }

    if (_.isUndefined(opts.token)) {
      throw new BadOptionsError(opts, text.noToken());
    }

    if (!_.isString(opts.token) || !tokenPattern.test(opts.token)) {
      throw new BadOptionsError(opts, text.invalidToken(opts.token));
    }

    // Log method aliases
    this.levels = levelUtil.normalize(opts);

    for (const lvlName of this.levels) {
      if (lvlName in this) {
        throw new BadOptionsError(opts, text.levelConflict(lvlName));
      }

      Object.defineProperty(this, lvlName, {
        enumerable: true,
        writable: false,
        value() {
          this.log.apply(this, [lvlName, ...arguments]);
        }
      });
    }

    // boolean options
    this.secure = opts.secure === undefined ? defaults.secure : opts.secure;
    this.debugEnabled = opts.debug === undefined ? defaults.debug : opts.debug;
    this.json = opts.json;
    this.flatten = opts.flatten;
    this.flattenArrays = 'flattenArrays' in opts ? opts.flattenArrays : opts.flatten;
    this.console = opts.console;
    this.withLevel = 'withLevel' in opts ? opts.withLevel : true;
    this.withStack = opts.withStack;
    this.timestamp = opts.timestamp || false;

    // string or numeric options
    this.bufferSize = opts.bufferSize || defaults.bufferSize;
    this.port = opts.port || (this.secure ? defaults.portSecure : defaults.port);
    this.host = opts.host;
    this.minLevel = opts.minLevel;
    this.replacer = opts.replacer;
    this.inactivityTimeout = opts.inactivityTimeout || defaults.inactivityTimeout;
    this.token = opts.token;
    this.reconnectInitialDelay = opts.reconnectInitialDelay || defaults.reconnectInitialDelay;
    this.reconnectMaxDelay = opts.reconnectMaxDelay || defaults.reconnectMaxDelay;
    this.reconnectBackoffStrategy =
        opts.reconnectBackoffStrategy || defaults.reconnectBackoffStrategy;

    if (!this.debugEnabled) {
      // if there is no debug set, empty logger should be used
      this.debugLogger = {
        log: () => {
        }
      };
    } else {
      this.debugLogger =
          (opts.debugLogger && opts.debugLogger.log) ? opts.debugLogger : defaults.debugLogger;
    }

    const isSecure = this.secure;
    this.ringBuffer = new RingBuffer(this.bufferSize);
    this.reconnect = reconnectCore(function initialize() {
      let connection;
      const args = [].slice.call(arguments);
      if (isSecure) {
        connection = tls.connect.apply(tls, args, () => {
          if (!connection.authorized) {
            const errMsg = connection.authorizationError;
            this.emit(new LogentriesError(text.authError(errMsg)));
          } else if (tls && tls.CleartextStream && connection instanceof tls.CleartextStream) {
            this.emit('connect');
          }
        });
      } else {
        connection = net.connect.apply(null, args);
      }
      connection.setTimeout(opts.inactivityTimeout || defaults.inactivityTimeout);
      return connection;
    });

    // RingBuffer emits buffer shift event, meaning we are discarding some data!
    this.ringBuffer.on('buffer shift', () => {
      this.debugLogger.log('Buffer is full, will be shifting records until buffer is drained.');
    });
  }

  /**
   * Override Writable _write method.
   * Get the connection promise .then write the next log on the ringBuffer
   * to Logentries connection when its available
   */
  _write(ch, enc, cb) {
    this.connection.then(conn => {
      const record = this.ringBuffer.read();
      if (record) {
        conn.write(record);
        // we are checking the buffer state here just after conn.write()
        // to make sure the last event is sent to socket.
        if (this.ringBuffer.isEmpty()) {
          this.emit('buffer drain');
          // this event is DEPRECATED - will be removed in next major release.
          // new users should use 'buffer drain' event instead.
          this.emit('connection drain');
        }
      } else {
        this.debugLogger.log('This should not happen. Read from ringBuffer returned null.');
      }
      cb();
    }).catch(err => {
      this.emit('error', err);
      this.debugLogger.log(`Error: ${err}`);
      cb();
    });
  }

  /**
   * Stop reconnection along with its running connection(if any) and end the writable stream.
   */
  end() {
    // invoke disconnect of reconnection so any running connection
    // will be destroyed and we will stop reconnecting.
    this.reconnection.disconnect();
    super.end(...arguments);
  }

  setDefaultEncoding() { /* no. */
  }

  /**
   * Finalize the log and write() to Logger stream
   * @param lvl
   * @param log
   */
  log(lvl, log) {
    let modifiedLevel = lvl;
    let modifiedLog = log;
    // lvl is optional
    if (modifiedLog === undefined) {
      modifiedLog = modifiedLevel;
      modifiedLevel = null;
    }

    let lvlName;

    if (modifiedLevel || modifiedLevel === 0) {
      [modifiedLevel, lvlName] = this.toLevel(modifiedLevel);

      // If lvl is present, it must be recognized
      if (!modifiedLevel && modifiedLevel !== 0) {
        this.emit('error', new LogentriesError(text.unknownLevel(modifiedLevel)));
        return;
      }

      // If lvl is below minLevel, it is dismissed
      if (modifiedLevel < this.minLevel) {
        return;
      }
    }

    // If log is an array, it is treated as a collection of log events
    if (_.isArray(modifiedLog)) {
      if (modifiedLog.length) {
        for (const $modifiedLog of modifiedLog) this.log(modifiedLevel, $modifiedLog);
      } else {
        this.emit('error', new LogentriesError(text.noLogMessage()));
      }
      return;
    }

    // If log is an object, it is serialized to string and may be augmented
    // with timestamp and level. For strings, these may be prepended.
    if (_.isObject(modifiedLog)) {
      let safeTime;
      let safeLevel;

      if (this.timestamp) {
        safeTime = getSafeProp(modifiedLog, 'time');
        modifiedLog[safeTime] = new Date();
      }

      if (this.withLevel && lvlName) {
        safeLevel = getSafeProp(modifiedLog, 'level');
        modifiedLog[safeLevel] = lvlName;
      }

      modifiedLog = this._serialize(modifiedLog);

      if (!modifiedLog) {
        this.emit('error', new LogentriesError(text.serializedEmpty()));
        return;
      }

      if (this.console) {
        console[getConsoleMethod(modifiedLevel)](JSON.parse(modifiedLog));
      }

      if (safeTime) delete modifiedLog[safeTime];
      if (safeLevel) delete modifiedLog[safeLevel];
    } else {
      if (_.isEmpty(modifiedLog)) {
        this.emit('error', new LogentriesError(text.noLogMessage()));
        return;
      }

      modifiedLog = [modifiedLog.toString()];

      if (this.withLevel && lvlName) {
        modifiedLog.unshift(lvlName);
      }

      if (this.timestamp) {
        modifiedLog.unshift((new Date()).toISOString());
      }

      modifiedLog = modifiedLog.join(' ');

      if (this.console) {
        console[getConsoleMethod(modifiedLevel)](modifiedLog);
      }
    }

    this.emit('log', modifiedLog);

    // if RingBuffer.write returns false, don't create any other write request for
    // the writable stream to avoid memory leak this means there are already 'bufferSize'
    // of write events in the writable stream and that's what we want.
    if (this.ringBuffer.write(finalizeLogString(modifiedLog, this.token))) {
      this.write();
    }
  }

  /**
   * Close connection via reconnection
   */
  closeConnection() {
    this.debugLogger.log('Closing retry mechanism along with its connection.');
    if (!this.reconnection) {
      return;
    }
    // this makes sure retry mechanism and connection will be closed.
    this.reconnection.disconnect();
  }

  // Private methods
  toLevel(val) {
    let num;

    if (levelUtil.isNumberValid(val)) {
      num = parseInt(val, 10); // -0
    } else {
      num = this.levels.indexOf(val);
    }

    const name = this.levels[num];

    return name ? [num, name] : [];
  }

  get reconnect() {
    return this._reconnect;
  }

  set reconnect(func) {
    this._reconnect = func;
  }

  get connection() {
    // The $connection property is a promise. On error, manual close, or
    // inactivityTimeout, it deletes itself.
    if (this._connection) {
      return this._connection;
    }

    this.debugLogger.log('No connection exists. Creating a new one.');
    // clear the state of previous reconnection and create a new one with a new connection promise.
    if (this.reconnection) {
      // destroy previous reconnection instance if it exists.
      this.reconnection.disconnect();
      this.reconnection = null;
    }

    this.reconnection = this.reconnect({
      // all options are optional
      initialDelay: this.reconnectInitialDelay,
      maxDelay: this.reconnectMaxDelay,
      strategy: this.reconnectBackoffStrategy,
      failAfter: Infinity,
      randomisationFactor: 0,
      immediate: false
    });

    this.connection = new Promise((resolve) => {
      const connOpts = {
        host: this.host,
        port: this.port
      };

      // reconnection listeners
      this.reconnection.on('connect', (connection) => {
        this.debugLogger.log('Connected');
        this.emit('connected');
        resolve(connection);

        // connection listeners
        connection.on('timeout', () => {
          // we owe a lot to inactivity timeout handling with regards to clearing
          // unwanted opened connections hanging around.
          this.debugLogger.log(
              `Socket was inactive for ${this.inactivityTimeout / 1000} seconds. Destroying.`);
          this.closeConnection();
          this.connection = null;
          this.emit('timed out');
        });
      });

      this.reconnection.on('reconnect', (n, delay) => {
        if (n > 0) {
          this.debugLogger.log(`Trying to reconnect. Times: ${n} , previous delay: ${delay}`);
        }
      });

      this.reconnection.once('disconnect', () => {
        this.debugLogger.log('Socket was disconnected');
        this.connection = null;
        this.emit('disconnected');
      });

      this.reconnection.on('error', (err) => {
        this.debugLogger.log(`Error occurred during connection: ${err}`);
      });

      // now try to connect
      this.reconnection.connect(connOpts);
    });
    return this.connection;
  }

  set connection(obj) {
    this._connection = obj;
  }

  get reconnection() {
    return this._reconnection;
  }

  set reconnection(func) {
    this._reconnection = func;
  }

  get debugEnabled() {
    return this._debugEnabled;
  }

  set debugEnabled(val) {
    this._debugEnabled = !!val;
  }

  get debugLogger() {
    return this._debugLogger;
  }

  set debugLogger(func) {
    this._debugLogger = func;
  }

  get ringBuffer() {
    return this._ringBuffer;
  }

  set ringBuffer(obj) {
    this._ringBuffer = obj;
  }

  get secure() {
    return this._secure;
  }

  set secure(val) {
    this._secure = !!val;
  }

  get token() {
    return this._token;
  }

  set token(val) {
    this._token = val;
  }

  get bufferSize() {
    return this._bufferSize;
  }

  set bufferSize(val) {
    this._bufferSize = val;
  }

  get console() {
    return this._console;
  }

  set console(val) {
    this._console = !!val;
  }

  get serialize() {
    return this._serialize;
  }

  set serialize(func) {
    this._serialize = func;
  }

  get flatten() {
    return this._flatten;
  }

  set flatten(val) {
    this._flatten = !!val;
    this.serialize = build(this);
  }

  get flattenArrays() {
    return this._flattenArrays;
  }

  set flattenArrays(val) {
    this._flattenArrays = !!val;
    this.serialize = build(this);
  }

  get host() {
    return this._host;
  }

  set host(val) {
    if (!_.isString(val) || !val.length) {
      this._host = defaults.host;
      return;
    }

    const host = val.replace(/^https?:\/\//, '');

    const url = urlUtil.parse(`http://${host}`);

    this._host = url.hostname || defaults.host;

    if (url.port) this.port = url.port;
  }

  get json() {
    return this._json;
  }

  set json(val) {
    this._json = val;
  }

  get reconnectMaxDelay() {
    return this._reconnectMaxDelay;
  }

  set reconnectMaxDelay(val) {
    this._reconnectMaxDelay = val;
  }

  get reconnectInitialDelay() {
    return this._reconnectInitialDelay;
  }

  set reconnectInitialDelay(val) {
    this._reconnectInitialDelay = val;
  }

  get reconnectBackoffStrategy() {
    return this._reconnectBackoffStrategy;
  }

  set reconnectBackoffStrategy(val) {
    this._reconnectBackoffStrategy = val;
  }

  get minLevel() {
    return this._minLevel;
  }

  set minLevel(val) {
    const [num] = this.toLevel(val);

    this._minLevel = _.isNumber(num) ? num : 0;
  }

  get port() {
    return this._port;
  }

  set port(val) {
    const port = parseFloat(val);
    if (Number.isInteger(port) && _.inRange(port, 65536)) this._port = port;
  }

  get replacer() {
    return this._replacer;
  }

  set replacer(val) {
    this._replacer = _.isFunction(val) ? val : undefined;
    this.serialize = build(this);
  }

  get inactivityTimeout() {
    return this._inactivityTimeout;
  }

  set inactivityTimeout(val) {
    if (Number.isInteger(val) && val >= 0) {
      this._inactivityTimeout = parseInt(val, 10);
    }

    if (!_.isNumber(this._inactivityTimeout)) {
      this._inactivityTimeout = defaults.inactivityTimeout;
    }
  }

  get timestamp() {
    return this._timestamp;
  }

  set timestamp(val) {
    this._timestamp = !!val;
  }

  get withLevel() {
    return this._withLevel;
  }

  set withLevel(val) {
    this._withLevel = !!val;
  }

  get withStack() {
    return this._withStack;
  }

  set withStack(val) {
    this._withStack = !!val;
    this.serialize = build(this);
  }

  get levels() {
    return this._levels && this._levels.slice();
  }

  set levels(val) {
    this._levels = val;
  }

  // Deprecated (to support migrants from le_node)
  level(name) {
    console.warn(text.deprecatedLevelMethod());
    if (~this.levels.indexOf(name)) this.minLevel = name;
  }

  // static methods
  static winston() {
    console.warn(text.deprecatedWinstonMethod());
  }

  /**
   * Prepare the winston transport
   * @param winston
   */
  static provisionWinston(winston) {
    if (winston.transports.Logentries) return;

    const Transport = winston.Transport;

    class LogentriesTransport extends Transport {
      constructor(opts) {
        super(opts);
        this.json = opts.json;

        const transportOpts = _.clone(opts || {});

        transportOpts.minLevel =
            transportOpts.minLevel || transportOpts.level || this.tempLevel || 0;

        transportOpts.levels = transportOpts.levels || winston.levels;
        if (semver.satisfies(winston.version, '>=2.0.0')) {
          // Winston and Logengries levels are reversed
          // ('error' level is 0 for Winston and 5 for Logentries)
          // If the user provides custom levels we assue they are
          // using winston standard
          const levels = transportOpts.levels;
          const values = _.values(levels).reverse();
          transportOpts.levels = {};
          _.keys(levels).forEach((k, i) => {
            transportOpts.levels[k] = values[i];
          });
        }

        this.tempLevel = null;
        this.logger = new Logger(transportOpts);
        this.logger.on('error', err => this.emit(err));
      }

      log(lvl, msg, meta, cb) {
        if (this.json) {
          const message = {
            message: msg
          };
          if (!_.isEmpty(meta)) {
            if (_.isObject(meta)) {
              _.defaults(message, meta);
            } else {
              message.meta = meta;
            }
          }

          this.logger.log(lvl, message);
        } else {
          let message = msg;
          if (!_.isEmpty(meta)) {
            if (_.isString(message)) {
              message += ` ${this.logger.serialize(meta)}`;
            } else if (_.isObject(message)) {
              message[getSafeProp(message, 'meta')] = meta;
            }
          }

          this.logger.log(lvl, message);
        }

        setImmediate(cb.bind(null, null, true));
      }

      static get name() {
        return 'logentries';
      }

      get tempLevel() {
        return this._tempLevel;
      }

      set tempLevel(val) {
        this._tempLevel = val;
      }

      get logger() {
        return this._logger;
      }

      set logger(obj) {
        this._logger = obj;
      }

      get level() {
        const [, lvlName] =
            this.logger.toLevel(this.logger.minLevel);
        return lvlName;
      }

      set level(val) {
        if (!this.logger) {
          this.tempLevel = val;
        } else {
          this.logger.minLevel = val;
        }
      }

      get levels() {
        return this.logger.levels.reduce((acc, lvlName, lvlNum) => {
          const newAcc = acc;
          newAcc[lvlName] = lvlNum;
          return newAcc;
        }, {});
      }
    }

    /* eslint no-param-reassign: ["error", { "props": false }] */
    winston.transports.Logentries = LogentriesTransport;
  }

  /**
   * Prepare a BunyanStream.
   * @param opts
   * @returns {{level: *, name: string, stream: BunyanStream, type: string}}
   */
  static bunyanStream(opts) {
    const stream = new BunyanStream(opts);
    const [, level] = stream.logger.toLevel(stream.logger.minLevel);
    const type = 'raw';
    const name = 'logentries';

    // Defer to Bunyan’s handling of minLevel
    stream.logger.minLevel = 0;

    return { level, name, stream, type };
  }
}

// provision winston
const winston = requirePeer('winston', { optional: true });

if (winston) Logger.provisionWinston(winston);

// Provision too the winston static versions for testing/development purposes
const winston1 = requirePeer('winston1', { optional: true });
const winston2 = requirePeer('winston2x', { optional: true });

if (winston1) Logger.provisionWinston(winston1);
if (winston2) Logger.provisionWinston(winston2);

// exposed Logger events
const errorEvent = 'error';
const logEvent = 'log';
const connectedEvent = 'connected';
const disconnectedEvent = 'disconnected';
const timeoutEvent = 'timed out';
const drainWritableEvent = 'drain';
const finishWritableEvent = 'finish';
const pipeWritableEvent = 'pipe';
const unpipeWritableEvent = 'unpipe';
const bufferDrainEvent = 'buffer drain';

export {
    Logger as default,
    errorEvent,
    logEvent,
    connectedEvent,
    disconnectedEvent,
    timeoutEvent,
    drainWritableEvent,
    finishWritableEvent,
    pipeWritableEvent,
    unpipeWritableEvent,
    bufferDrainEvent
};
