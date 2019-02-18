'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.normalize = exports.isNumberValid = undefined;

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _isInteger = require('babel-runtime/core-js/number/is-integer');

var _isInteger2 = _interopRequireDefault(_isInteger);

var _lodash = require('lodash.reduce');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.inrange');

var _lodash4 = _interopRequireDefault(_lodash3);

var _lodash5 = require('lodash.isobject');

var _lodash6 = _interopRequireDefault(_lodash5);

var _lodash7 = require('lodash.isstring');

var _lodash8 = _interopRequireDefault(_lodash7);

var _lodash9 = require('lodash.isnumber');

var _lodash10 = _interopRequireDefault(_lodash9);

var _lodash11 = require('lodash.isnull');

var _lodash12 = _interopRequireDefault(_lodash11);

var _lodash13 = require('lodash.isundefined');

var _lodash14 = _interopRequireDefault(_lodash13);

var _lodash15 = require('lodash.values');

var _lodash16 = _interopRequireDefault(_lodash15);

var _lodash17 = require('lodash.filter');

var _lodash18 = _interopRequireDefault(_lodash17);

var _lodash19 = require('lodash.includes');

var _lodash20 = _interopRequireDefault(_lodash19);

var _defaults = require('./defaults');

var defaults = _interopRequireWildcard(_defaults);

var _text = require('./text');

var _text2 = _interopRequireDefault(_text);

var _error = require('./error');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isNumberValid = exports.isNumberValid = function isNumberValid(n) {
  return (0, _isInteger2.default)(parseFloat(n)) && (0, _lodash4.default)(n, 8);
};

var normArr = function normArr(arr, opts) {
  if (arr.length > 8) {
    throw new _error.BadOptionsError(opts, _text2.default.tooManyLevels(arr.length));
  }

  return arr.map(function (val) {
    if (val && (0, _lodash8.default)(val)) return val;
    if ((0, _lodash10.default)(val) && isFinite(val)) return val.toString();
    if ((0, _lodash12.default)(val) || (0, _lodash14.default)(val)) return undefined;

    throw new _error.BadOptionsError(opts, _text2.default.levelNotString(val));
  });
};

var normObj = function normObj(obj, opts) {
  var lvlNums = (0, _lodash16.default)(obj);

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(lvlNums), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var num = _step.value;

      if (!isNumberValid(num)) {
        throw new _error.BadOptionsError(opts, _text2.default.invalidLevelNum(num));
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  var duplicates = (0, _lodash18.default)((0, _lodash16.default)(obj), function (val, i, iteratee) {
    return (0, _lodash20.default)(iteratee, val, i + 1);
  });
  if (duplicates.length) {
    throw new _error.BadOptionsError(opts, _text2.default.duplicateLevelNums(duplicates));
  }

  return (0, _lodash2.default)(obj, function (arr, i, name) {
    var reducedArr = arr;
    reducedArr[i] = name;
    return reducedArr;
  }, []);
};

var normalize = exports.normalize = function normalize(opts) {
  var custom = opts.levels;

  if (!(0, _lodash14.default)(custom) && !(0, _lodash12.default)(custom) && !(0, _lodash6.default)(custom)) {
    throw new _error.BadOptionsError(opts, _text2.default.levelsNotObj(typeof custom === 'undefined' ? 'undefined' : (0, _typeof3.default)(custom)));
  }

  if (!custom) {
    return defaults.levels.slice();
  }

  custom = Array.isArray(custom) ? normArr(custom, opts) : normObj(custom, opts);

  var levels = defaults.levels.map(function (lvl, i) {
    return custom[i] || lvl;
  });

  var duplicates = (0, _lodash18.default)((0, _lodash16.default)(levels), function (val, i, iteratee) {
    return (0, _lodash20.default)(iteratee, val, i + 1);
  });

  if (duplicates.length) {
    throw new _error.BadOptionsError(opts, _text2.default.duplicateLevels(duplicates));
  }

  return levels;
};
//# sourceMappingURL=levels.js.map
