/* eslint-disable */

'use strict';

const _ = require('lodash');
const EventEmitter = require('events');
const bunyan = require('bunyan');
const defaults = require('../lib/defaults.js');
const levels = require('../lib/levels.js');
const Logger = require('../lib/logger.js');
const mitm = require('mitm');
const tape = require('tape');
const winston = require('winston');
const winston1 = require('winston1');
const winston2 = require('winston2x');
const RingBuffer = require('../lib/ringbuffer.js');

// FAKE TOKEN

const x = '00000000-0000-0000-0000-000000000000';

// CUSTOM LEVEL NAMES

tape('Levels are default if custom levels are not supplied.', function (t) {
  t.deepEqual(levels.normalize({}), defaults.levels, 'undefined');
  t.deepEqual(levels.normalize({ levels: null }), defaults.levels, 'null');
  t.deepEqual(levels.normalize({ levels: {} }), defaults.levels, 'empty obj');
  t.deepEqual(levels.normalize({ levels: [] }), defaults.levels, 'empty arr');
  t.deepEqual(
      levels.normalize({ levels: _.noop }),
      defaults.levels,
      'function'
  );

  t.end();
});

tape('Weird value for custom levels object throws.', function (t) {
  t.throws(levels.normalize.bind(null, { levels: 4 }), 'number');
  t.throws(levels.normalize.bind(null, { levels: 'cheese' }), 'string');
  t.throws(levels.normalize.bind(null, { levels: NaN }), 'number (NaN)');
  t.throws(levels.normalize.bind(null, { levels: true }), 'boolean');

  t.end();
});

tape('Custom levels without valid indices throw.', function (t) {
  t.throws(levels.normalize.bind(
      null, { levels: { a: -1 } }), 'negative index');
  t.throws(levels.normalize.bind(
      null, { levels: { a: 3.14 } }), 'decimals');
  t.throws(levels.normalize.bind(
      null, { levels: { a: '$$$' } }), 'non-numeric');
  t.throws(levels.normalize.bind(
      null, { levels: { a: null } }), 'null');
  t.doesNotThrow(
      levels.normalize.bind(null, { levels: { a: 1 } }),
      'valid index does not throw'
  );

  t.end();
});

tape('Custom levels with invalid names throw.', function (t) {
  t.throws(levels.normalize.bind(null, { levels: [[]] }), 'object');
  t.throws(levels.normalize.bind(null, { levels: [true] }), 'boolean');
  t.throws(levels.normalize.bind(null, { levels: [NaN] }), 'NaN');

  t.end();
});

tape('Custom levels with duplicate names throw.', function (t) {
  t.throws(levels.normalize.bind(null, { levels: ['a', 'b', 'a'] }),
      'duplicate strings');

  t.throws(levels.normalize.bind(null, { levels: ['230', 230] }),
      'coercively duplicative strings');

  t.doesNotThrow(levels.normalize.bind(null, { levels: ['A', 'a'] }),
      'case sensitive');

  t.end();
});

tape('Custom levels with conflicting names throw.', function (t) {

  function makeLogger(levels) {
    new Logger({ token: x, levels: levels });
  }

  t.throws(makeLogger.bind(null, ['log']), 'own property');

  t.throws(makeLogger.bind(null, ['write']), 'inherited property');

  t.doesNotThrow(makeLogger.bind(null, ['propX']), 'valid property');

  t.end();
});

// LOGGER CONSTRUCTION

tape('Logger throws with bad options.', function (t) {

  function withOpts(opts) {
    return function () {
      new Logger(opts);
    };
  }

  t.throws(withOpts(), 'missing options');
  t.throws(withOpts('cats'), 'primitive');
  t.throws(withOpts({}), 'missing token');
  t.throws(withOpts({ token: [] }), 'nonsense token type');
  t.throws(withOpts({ token: 'abcdef' }), 'nonsense token string');

  t.end();
});

tape('Logger does not forgive or forget.', function (t) {
  /* jshint newcap: false */

  t.throws(function () {
    Logger({ token: x });
  }, 'missing new throws');

  t.end();
});

tape('Logger allows custom log level methods at construction.', function (t) {
  const logger = new Logger({
    token: x,
    levels: ['tiny', 'small']
  });

  t.equal(_.isFunction(logger.tiny), true,
      'custom method present');

  t.equal(_.isFunction(logger[defaults.levels[1]]), false,
      'replaced default absent');

  t.equal(_.isFunction(logger[defaults.levels[2]]), true,
      'other default present');

  t.end();
});

tape('Logger allows specification of minLevel at construction', function (t) {

  const name = defaults.levels[3];

  const logger1 = new Logger({ token: x, minLevel: name });

  t.equal(logger1.minLevel, 3, 'by name.');

  const logger2 = new Logger({ token: x, minLevel: 3 });

  t.equal(logger2.minLevel, 3, 'by index (num)');

  const logger3 = new Logger({ token: x, minLevel: '3' });

  t.equal(logger3.minLevel, 3, 'by index (str)');

  t.end();

});


tape('Logger allows specification of withHostname at construction', function (t) {

  const logger1 = new Logger({ token: x, withHostname: true });

  t.equal(logger1.withHostname, true, 'withHostname');

  const logger2 = new Logger({ token: x });

  t.equal(logger2.withHostname, false, 'withHostname');

  t.end();

});




// CUSTOM JSON SERIALIZATION

tape('Error objects are serialized nicely.', function (t) {
  const msg = 'no kittens found';
  const err = new Error(msg);
  const log = { errs: [err] };

  const logger1 = new Logger({ token: x });

  t.equal(JSON.parse(logger1.serialize(err)).message, msg,
      'error object is serialized.');

  t.equal(JSON.parse(logger1.serialize(log)).errs[0].message, msg,
      'including when nested.');

  t.equal(JSON.parse(logger1.serialize(err)).stack, undefined,
      'by default, stack is not included.');

  const logger2 = new Logger({ token: x, withStack: true });

  t.true(JSON.parse(logger2.serialize(err)).stack,
      'withStack option causes its inclusion.');

  t.end();
});

tape('Arguments and regex patterns are serialized.', function (t) {
  const argObj = (function () {
    return arguments;
  })(1, 2, 3);
  const regObj = /abc/;

  const logger = new Logger({ token: x });

  t.true(logger.serialize(argObj) === '[1,2,3]', 'arguments become arrays.');

  t.true(logger.serialize(regObj) === '"/abc/"', 'patterns become strings');

  t.end();
});

tape('Custom value transformer is respected.', function (t) {
  function alwaysKittens(key, val) {
    return _.isObject(val) ? val : 'kittens';
  }

  const log = {
    status: 'green',
    friends: ['dogs', 'gerbils', 'horses'],
    err: new Error('not kittens :(')
  };

  const logger = new Logger({ token: x, replacer: alwaysKittens });

  const res = JSON.parse(logger.serialize(log));

  t.equal(res.status, 'kittens', 'single property.');

  t.true(res.friends.every(function (v) {
        return v == 'kittens';
      }),
      'array elements');

  t.equal(res.err.message, 'kittens',
      'custom replacer cooperates with automatic error transormation');

  t.end();
});

tape('Circular references don’t make the sad times.', function (t) {
  const consciousness = {};
  consciousness.iAm = consciousness;

  const logger = new Logger({ token: x });

  const res = JSON.parse(logger.serialize(consciousness));

  t.true(res, 'circular reference allowed');

  t.equal(res.iAm, '[Circular ~]', 'circular reference indicated');

  t.end();
});

tape('Serialize objects that inherit from non-Object objects fine', function (t) {
  function NullObj() {
  }

  NullObj.prototype = Object.create(null);
  const newObj = new NullObj();

  newObj.prop = 1;

  const logger = new Logger({ token: x });

  const res = JSON.parse(logger.serialize(newObj));

  t.true(res, 'object from non object doesn’t throw');

  t.equal(res.prop, 1, 'properties are still seen');

  t.end();
});

tape('Object.create(null) objects don’t destroy everything.', function (t) {
  const nullObj = Object.create(null);

  nullObj.prop = 1;

  const logger = new Logger({ token: x });

  const res = JSON.parse(logger.serialize(nullObj));

  t.true(res, 'null-prototype object doesn’t throw');

  t.equal(res.prop, 1, 'properties are still seen');

  t.end();
});

// FLATTENED DATA

tape('Flattening options work.', function (t) {
  const log = {
    lilBub: {
      occupation: 'prophet',
      paws: [
        { excellence: { value: 10, max: 5 } },
        { excellence: { value: 10, max: 5 } },
        { excellence: { value: 10, max: 5 } },
        { excellence: { value: 10, max: 5 } }
      ]
    }
  };

  function replacer(key, val) {
    return key == 'value' ? val * 2 : val;
  }

  const logger1 = new Logger({
    token: x,
    flatten: true,
    flattenArrays: false
  });

  const logger2 = new Logger({
    token: x,
    flatten: true,
    replacer: replacer
  });

  const res = JSON.parse(logger1.serialize(log));

  t.true('lilBub.occupation' in res, 'keys use dot notation');

  t.equal(res['lilBub.occupation'], 'prophet', 'non-objects are values');

  t.true(
      'lilBub.paws' in res,
      'flattenArrays:false treats arrays as non-objects'
  );

  t.true(
      'excellence.value' in res['lilBub.paws'][0],
      'flattenArrays:false still lets object members transform'
  );

  const res2 = JSON.parse(logger2.serialize(log));

  t.true(
      'lilBub.paws.0.excellence.max' in res2,
      'flattenArrays:true treats arrays as objects'
  );

  t.equals(
      res2['lilBub.paws.0.excellence.value'], 20,
      'custom replacers are still respected and applied first'
  );

  t.end();
});

// SENDING DATA

function mockTest(cb) {
  const mock = mitm();

  mock.on('connection', function (socket) {
    socket.on('data', function (buffer) {
      mock.disable();
      cb(buffer.toString());
    });
  });
}

tape('Data is sent over standard connection.', function (t) {
  t.plan(4);
  t.timeoutAfter(2000);

  const lvl = defaults.levels[3];
  const msg = 'test';
  const tkn = x;

  const mock = mitm();

  mock.on('connection', function (socket, opts) {

    t.pass('connection made');

    socket.on('data', function (buffer) {
      t.pass('data received');
      t.equal(socket.encrypted, undefined, 'socket is not secure');

      const log = buffer.toString();
      const expected = [tkn, lvl, msg + '\n'].join(' ');

      t.equal(log, expected, 'message matched');

      mock.disable();
    });
  });

  const logger = new Logger({ token: tkn, secure: false });

  logger[lvl](msg);
});

tape('Data is sent over secure connection.', function (t) {
  t.plan(5);
  t.timeoutAfter(2000);

  const lvl = defaults.levels[3];
  const msg = 'test';
  const tkn = x;

  const mock = mitm();

  mock.on('connection', function (socket, opts) {

    t.pass('connection made');

    t.equal(opts.port, defaults.portSecure, 'correct port');
    t.equal(socket.encrypted, true, 'socket is secure');

    socket.on('data', function (buffer) {
      t.pass('data received');

      const log = buffer.toString();
      const expected = [tkn, lvl, msg + '\n'].join(' ');

      t.equal(log, expected, 'message matched');

      mock.disable();
    });
  });

  const logger = new Logger({ token: tkn, secure: true });

  logger[lvl](msg);
});

tape('Log methods can send multiple entries.', function (t) {
  t.plan(2);
  t.timeoutAfter(4000);

  const lvl = defaults.levels[3];
  const tkn = x;
  const logger = new Logger({ token: tkn });
  let count = 0;

  mockTest(function (data) {
    count++;
    if (count == 1) return t.pass('as array');
    t.equal(tkn + ' ' + lvl + ' test2\n', data, 'message matched');
  });

  logger[lvl](['test1', 'test2']);

});

tape('Non-JSON logs may carry timestamp.', function (t) {
  t.plan(1);
  t.timeoutAfter(2000);

  mockTest(function (data) {

    t.true(pattern.test(data), 'matched');

  });

  const lvl = defaults.levels[3];
  const tkn = x;
  const pattern = new RegExp(
      '^' + x +
      ' \\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d.\\d{3}Z \\w+ test\\n$'
  );

  const logger = new Logger({ token: tkn, timestamp: true });

  logger[lvl]('test');
});


tape('Non-JSON logs may carry Hostname.', function (t) {
  t.plan(1);
  t.timeoutAfter(2000);

  mockTest(function (data) {
    t.true(pattern.test(data), 'matched');

  });
  const os = require('os');
  const lvl = defaults.levels[3];
  const tkn = x;
  const pattern = new RegExp('^' + x +' ' + os.hostname() + ' \\w+ test\\n$'
  );

  const logger = new Logger({ token: tkn, withHostname: true });

  logger[lvl]('test');
});


tape('JSON logs may carry Hostname.', function (t) {
  t.plan(1);
  t.timeoutAfter(2000);

  mockTest(function (data) {
    const log = JSON.parse(data.substr(37));
    t.true(log.host, 'has property');
  });
  const os = require('os');
  const lvl = defaults.levels[3];
  const tkn = x;

  const logger = new Logger({ token: tkn, withHostname: true });

  logger[lvl]({msg: "Testing!"});
});


tape('JSON logs match expected pattern.', function (t) {
  t.timeoutAfter(2000);

  mockTest(function (data) {
    try {

      const log = JSON.parse(data.substr(37));

      t.pass('valid JSON');

      t.true(_.isNull(log.msg), 'JSON datatypes survive');

      t.true(timestampPattern.test(log.time), 'carried timestamp');

      t.equal(log.level, 'o', 'original properties respected');

      t.equal(log._level, lvl, 'appended properties avoid collision');

      t.end();

    } catch (err) {

      t.fail('valid JSON');

      t.end();
    }
  });

  const lvl = defaults.levels[3];
  const tkn = x;
  const timestampPattern = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d.\d{3}Z$/;

  const logger = new Logger({ token: tkn, timestamp: true });

  logger[lvl]({ msg: null, level: 'o' });

});

tape('Directly logged error objects survive.', function (t) {
  t.plan(1);
  t.timeoutAfter(500);

  const message = 'warp breach imminent';
  const error = new Error(message);
  const logger = new Logger({ token: x });

  logger.on('error', function (err) {
    t.comment(err.stack);
    t.fail('error logged');
  });

  mockTest(function (data) {
    const log = JSON.parse(data.substr(37));
    t.equal(log.message, message, 'error logged');
  });

  logger.log(error);
});

tape('Invalid calls to log methods emit error.', function (t) {
  t.plan(2);
  t.timeoutAfter(500);

  const logger1 = new Logger({ token: x });

  logger1.on('error', function () {
    t.pass('no arguments');
  });

  logger1.log(3);

  const logger2 = new Logger({ token: x });

  logger2.on('error', function () {
    t.pass('empty array');
  });

  logger2.log(3, []);
});

tape('Socket gets re-opened as needed.', function (t) {
  t.plan(1);
  t.timeoutAfter(3000);

  const logger = new Logger({ token: x });

  mockTest(function (data) {

    mockTest(function (data) {
      t.pass('successful');
    });
  });

  logger.log(3, 'qwerty');

  setTimeout(function () {
    logger.closeConnection();

    setTimeout(function () {
      logger.log(3, 'qwerty');
    }, 500);
  }, 500);

});

tape('Socket is not closed after inactivity timeout when buffer is not empty.', function (t) {
  t.plan(3);
  t.timeoutAfter(1000);
  const lvl = defaults.levels[3];
  const tkn = x;
  const logger = new Logger({ token: x , inactivityTimeout: 300});

  const mock = mitm();

  mock.on('connection', function (socket, opts) {
    socket.once('data', function (buffer) {
      const log1 = buffer.toString();
      const expected1 = [tkn, lvl, 'first log' + '\n'].join(' ');
      t.equals(log1, expected1, 'first log received.');
    });

    logger.once('timed out', function () {
      t.true(logger.drained, 'timeout event triggered and logger was drained.');
    });

    setTimeout(function () {
      logger.log(lvl, 'second log');
      socket.once('data', function (buffer) {
        const log2 = buffer.toString();
        const expected2 = [tkn, lvl, 'second log' + '\n'].join(' ');
        t.equals(log2, expected2, 'log before inactivity timeout received.');
      });
    }, 299);
    mock.disable();
  });
  logger.log(lvl, 'first log');
});

tape('Socket will not reconnect indefinitely when fail after is configured', function (t) {
  t.plan(5);
  t.timeoutAfter(1000);
  const lvl = defaults.levels[3];
  const tkn = x;
  const logger = new Logger({ token: x, reconnectFailAfter: 3, reconnectInitialDelay: 100, reconnectMaxDelay: 101 });

  const mock = new mitm();
  let retryCounter = 0;

  const origConnect = mock.connect;

  const sendMoreLogs = () => {
    mock.connect = origConnect;

    mock.on('connection', (socket) => {
      socket.once('data', (buffer) => {
        const log = buffer.toString();
        const expectedLog = [tkn, lvl, 'other log' + '\n'].join(' ');
        t.equals(log, expectedLog, 'log received.');
        mock.disable();
      });
    });

    logger.log(lvl, 'other log');
  };

  logger.once('buffer drain', sendMoreLogs);

  mock.connect = function() {
    const emitter = new EventEmitter();

    // mock properties
    emitter.end = _.noop;
    emitter.setTimeout = _.noop;
    emitter.server = new EventEmitter();

    t.true(retryCounter <= 3, `retry ${retryCounter}`);
    retryCounter += 1;

    setTimeout(() => {
      emitter.emit('error', new Error('connection failed'))
    }, 0);

    return emitter;
  };

  mock.enable();

  logger.log(lvl, 'test log 1');
  logger.log(lvl, 'test log 2');
});

tape('RingBuffer buffers and shifts when it is full', function (t) {
  t.plan(5);
  t.timeoutAfter(1000);

  const ringBuffer = new RingBuffer(1);
  ringBuffer.on('buffer shift', function () {
    t.pass('Buffer shift event emitted');
  });
  t.true(ringBuffer.write('Test log'), 'RingBuffer buffers');
  t.false(ringBuffer.write('Another test log'), 'RingBuffer shifts');
  t.equal(ringBuffer.read(), 'Another test log', 'got expected log event');
  t.true(ringBuffer.isEmpty(), 'No records left in the buffer');
});

// WINSTON TRANSPORT

tape('Winston integration is provided.', function (t) {
  t.plan(4);
  t.timeoutAfter(2000);

  t.true(winston.transports.Logentries,
      'provisioned constructor automatically');

  t.doesNotThrow(function () {
    winston.add(winston.transports.Logentries, { token: x });
  }, 'transport can be added');

  winston.remove(winston.transports.Console);

  mockTest(function (data) {
    t.pass('winston log transmits');
    t.equal(data, x + ' warn mysterious radiation\n', 'msg as expected');
  });

  winston.warn('mysterious radiation');
});

tape("Winston supports json logging.", function (t) {
  t.plan(2);
  t.timeoutAfter(2000);

  const logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Logentries)({ token: x, json: true })
    ]
  });

  mockTest(function (data) {
    t.pass("winston logs in json format");
    const expect = {
      message: "msg",
      foo: "bar",
      level: "warn"
    };
    t.equal(data, x + " " + JSON.stringify(expect) + '\n', 'json as expected');
  });

  logger.warn("msg", { foo: "bar" });
});

tape('Winston@1.1.2 integration is provided.', function (t) {
  t.plan(4);
  t.timeoutAfter(2000);

  t.true(winston1.transports.Logentries,
      'provisioned constructor automatically');

  t.doesNotThrow(function () {
    winston1.add(winston1.transports.Logentries, { token: x });
  }, 'transport can be added');

  winston1.remove(winston1.transports.Console);

  mockTest(function (data) {
    t.pass('winston log transmits');
    t.equal(data, x + ' warn mysterious radiation\n', 'msg as expected');
  });

  winston1.warn('mysterious radiation');
});

tape("Winston@1.1.2 supports json logging.", function (t) {
  t.plan(2);
  t.timeoutAfter(2000);

  const logger = new (winston1.Logger)({
    transports: [
      new (winston1.transports.Logentries)({ token: x, json: true })
    ]
  });

  mockTest(function (data) {
    t.pass("winston logs in json format");
    const expect = {
      message: "msg",
      foo: "bar",
      level: "warn"
    };
    t.equal(data, x + " " + JSON.stringify(expect) + '\n', 'json as expected');
  });

  logger.warn("msg", { foo: "bar" });
});

tape('Winston@2.1.1 integration is provided.', function (t) {
  t.plan(4);
  t.timeoutAfter(2000);

  t.true(winston2.transports.Logentries,
      'provisioned constructor automatically');

  t.doesNotThrow(function () {
    winston2.add(winston2.transports.Logentries, { token: x });
  }, 'transport can be added');

  winston2.remove(winston2.transports.Console);

  mockTest(function (data) {
    t.pass('winston log transmits');
    t.equal(data, x + ' warn mysterious radiation\n', 'msg as expected');
  });

  winston2.warn('mysterious radiation');
});

tape("Winston@2.1.1 supports json logging.", function (t) {
  t.plan(2);
  t.timeoutAfter(2000);

  const logger = new (winston2.Logger)({
    transports: [
      new (winston2.transports.Logentries)({ token: x, json: true })
    ]
  });

  mockTest(function (data) {
    t.pass("winston logs in json format");
    const expect = {
      message: "msg",
      foo: "bar",
      level: "warn"
    };
    t.equal(data, x + " " + JSON.stringify(expect) + '\n', 'json as expected');
  });

  logger.warn("msg", { foo: "bar" });
});

// BUNYAN STREAM

tape('Bunyan integration is provided.', function (t) {
  t.plan(8);

  const streamDef = Logger.bunyanStream({ token: x, minLevel: 3 });

  t.true(streamDef, 'bunyan stream definition created');

  t.equal(streamDef.level, defaults.bunyanLevels[3],
      'minLevel translated correctly');

  const logger = bunyan.createLogger({
    name: 'whatevs',
    streams: [streamDef]
  });

  t.true(logger, 'bunyan logger created');

  mockTest(function (data) {
    t.pass('bunyan stream transmits');

    const log = JSON.parse(data.substr(37));

    t.pass('valid json');

    t.equal(log.yes, 'okay', 'data as expected');

    t.equal(log.level, 40, 'bunyan level number as expected');

    t.equal(log._level, defaults.bunyanLevels[3], 'level name as expected');
  });

  logger[defaults.bunyanLevels[3]]({ yes: 'okay' });
});
