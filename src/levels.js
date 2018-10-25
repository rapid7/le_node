import _ from 'lodash';
import * as defaults from './defaults';
import text from './text';
import { BadOptionsError } from './error';

// level numbers
export const isNumberValid = n =>
Number.isInteger(parseFloat(n)) && _.inRange(n, 8);

/**
 * Normalize the array
 * @param arr
 * @param opts
 * @returns {*}
 */
const normArr = (arr, opts) => {
  if (arr.length > 8) {
    throw new BadOptionsError(opts, text.tooManyLevels(arr.length));
  }

  return arr.map(val => {
    if (val && _.isString(val)) return val;
    if (_.isNumber(val) && isFinite(val)) return val.toString();
    if (_.isNull(val) || _.isUndefined(val)) return undefined;

    throw new BadOptionsError(opts, text.levelNotString(val));
  });
};


/**
 * Normalize the object
 * @param obj
 * @param opts
 */
const normObj = (obj, opts) => {
  const lvlNums = _.values(obj);

  for (const num of lvlNums) {
    if (!isNumberValid(num)) {
      throw new BadOptionsError(opts, text.invalidLevelNum(num));
    }
  }

  const duplicates =
      _(obj).countBy().pick(lvl => lvl > 1)
          .keys()
          .value();

  if (duplicates.length) {
    throw new BadOptionsError(opts, text.duplicateLevelNums(duplicates));
  }

  return _.reduce(obj, (arr, i, name) => {
    const reducedArr = arr;
    reducedArr[i] = name;
    return reducedArr;
  }, []);
};

/**
 * Main normalize function to export.
 * @param opts
 * @returns {*}
 */
export const normalize = (opts) => {
  let custom = opts.levels;

  if (!_.isUndefined(custom) && !_.isNull(custom) && !_.isObject(custom)) {
    throw new BadOptionsError(opts, text.levelsNotObj(typeof custom));
  }

  if (!custom) {
    return defaults.levels.slice();
  }

  custom = _.isArray(custom) ? normArr(custom, opts) : normObj(custom, opts);

  const levels = defaults.levels.map((lvl, i) => custom[i] || lvl);

  const duplicates =
      _(levels).countBy().pickBy(count => count > 1)
          .keys()
          .value();

  if (duplicates.length) {
    throw new BadOptionsError(opts, text.duplicateLevels(duplicates));
  }

  return levels;
};
