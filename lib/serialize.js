'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _weakSet = require('babel-runtime/core-js/weak-set');

var _weakSet2 = _interopRequireDefault(_weakSet);

var _weakMap = require('babel-runtime/core-js/weak-map');

var _weakMap2 = _interopRequireDefault(_weakMap);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _lodash = require('lodash.reduce');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.isobject');

var _lodash4 = _interopRequireDefault(_lodash3);

var _lodash5 = require('lodash.flow');

var _lodash6 = _interopRequireDefault(_lodash5);

var _lodash7 = require('lodash.isnan');

var _lodash8 = _interopRequireDefault(_lodash7);

var _lodash9 = require('lodash.iserror');

var _lodash10 = _interopRequireDefault(_lodash9);

var _lodash11 = require('lodash.isarguments');

var _lodash12 = _interopRequireDefault(_lodash11);

var _lodash13 = require('lodash.isregexp');

var _lodash14 = _interopRequireDefault(_lodash13);

var _lodash15 = require('lodash.toarray');

var _lodash16 = _interopRequireDefault(_lodash15);

var _jsonStringifySafe = require('json-stringify-safe');

var _jsonStringifySafe2 = _interopRequireDefault(_jsonStringifySafe);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var stackDelim = /\n\s*/g;

var pass = function pass(key, val) {
  return val;
};

var isNewIterable = function isNewIterable(val) {
  var isMap = _map2.default && val instanceof _map2.default;
  var isSet = _set2.default && val instanceof _set2.default;
  var isWeakMap = _weakMap2.default && val instanceof _weakMap2.default;
  var isWeakSet = _weakSet2.default && val instanceof _weakSet2.default;

  return isMap || isSet || isWeakMap || isWeakSet;
};

var errReplacer = function errReplacer(val, withStack) {

  var err = { name: val.name || 'Error', message: val.message };

  (0, _assign2.default)(err, val);

  if (withStack) err.stack = val.stack && val.stack.split(stackDelim);

  return err;
};

var flat = function flat(serialize, arraysToo) {
  return function (obj) {
    var serializedObj = JSON.parse(serialize(obj));
    if (!(0, _lodash4.default)(serializedObj)) return serializedObj;

    var flatObj = (0, _lodash2.default)(serializedObj, function _flat(target, val, key) {
      var keyContext = this.slice();
      keyContext.push(key);

      var joinedKey = keyContext.join('.');
      var newTarget = target;
      if (!(0, _lodash4.default)(val)) {
        newTarget[joinedKey] = val;
      } else if (!arraysToo && Array.isArray(val)) {
        newTarget[joinedKey] = val.map(function (newVal) {
          if (!(0, _lodash4.default)(newVal)) return newVal;

          return (0, _lodash2.default)(newVal, _flat, {}, []);
        });
      } else {
        (0, _lodash2.default)(val, _flat, newTarget, keyContext);
      }

      return newTarget;
    }, {}, []);

    return (0, _jsonStringifySafe2.default)(flatObj);
  };
};

var build = function build(_ref) {
  var flatten = _ref.flatten,
      flattenArrays = _ref.flattenArrays,
      _ref$replacer = _ref.replacer,
      replacer = _ref$replacer === undefined ? pass : _ref$replacer,
      withStack = _ref.withStack;

  var replace = (0, _lodash6.default)(replacer, function (val) {
    if ((0, _lodash4.default)(val) && !(0, _getPrototypeOf2.default)(val)) {
      return val;
    }

    if ((0, _lodash4.default)(val) && !(val instanceof Object)) {
      return val;
    }

    if ((0, _lodash8.default)(val)) return 'NaN';
    if (val === Infinity) return 'Infinity';
    if (val === -Infinity) return '-Infinity';
    if (1 / val === -Infinity) return '-0';
    if ((typeof val === 'undefined' ? 'undefined' : (0, _typeof3.default)(val)) === 'symbol') return val.toString();

    if ((0, _lodash10.default)(val)) return errReplacer(val, withStack);
    if ((0, _lodash12.default)(val)) return (0, _lodash16.default)(val);
    if ((0, _lodash14.default)(val)) return val.toString();
    if (isNewIterable(val)) return [].concat((0, _toConsumableArray3.default)(val));

    return val;
  });

  var serialize = function serialize() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _jsonStringifySafe2.default.apply(undefined, args.concat([replace]));
  };

  return flatten ? flat(serialize, flattenArrays) : serialize;
};

exports.default = build;
module.exports = exports['default'];
//# sourceMappingURL=serialize.js.map
