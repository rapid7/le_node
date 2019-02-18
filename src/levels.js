import reduce from 'lodash.reduce';
import inRange from 'lodash.inrange';
import isObject from 'lodash.isobject';
import isString from 'lodash.isstring';
import isNumber from 'lodash.isnumber';
import isNull from 'lodash.isnull';
import isUndefined from 'lodash.isundefined';
import values from 'lodash.values';
import filter from 'lodash.filter';
import includes from 'lodash.includes';
import * as defaults from './defaults';
import text from './text';
import { BadOptionsError } from './error';

// level numbers
export const isNumberValid = n =>
Number.isInteger(parseFloat(n)) && inRange(n, 8);

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
    if (val && isString(val)) return val;
    if (isNumber(val) && isFinite(val)) return val.toString();
    if (isNull(val) || isUndefined(val)) return undefined;

    throw new BadOptionsError(opts, text.levelNotString(val));
  });
};


/**
 * Normalize the object
 * @param obj
 * @param opts
 */
const normObj = (obj, opts) => {
  const lvlNums = values(obj);

  for (const num of lvlNums) {
    if (!isNumberValid(num)) {
      throw new BadOptionsError(opts, text.invalidLevelNum(num));
    }
  }

  const duplicates = filter(values(obj), (val, i, iteratee) => includes(iteratee, val, i + 1));
  if (duplicates.length) {
    throw new BadOptionsError(opts, text.duplicateLevelNums(duplicates));
  }

  return reduce(obj, (arr, i, name) => {
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

  if (!isUndefined(custom) && !isNull(custom) && !isObject(custom)) {
    throw new BadOptionsError(opts, text.levelsNotObj(typeof custom));
  }

  if (!custom) {
    return defaults.levels.slice();
  }

  custom = Array.isArray(custom) ? normArr(custom, opts) : normObj(custom, opts);

  const levels = defaults.levels.map((lvl, i) => custom[i] || lvl);

  const duplicates = filter(values(levels), (val, i, iteratee) => includes(iteratee, val, i + 1));

  if (duplicates.length) {
    throw new BadOptionsError(opts, text.duplicateLevels(duplicates));
  }

  return levels;
};
