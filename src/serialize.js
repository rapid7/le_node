import _ from 'lodash';
import jsonSS from 'json-stringify-safe';

// patterns
const stackDelim = /\n\s*/g;

// util
const pass = (key, val) => val;

const isNewIterable = val => {
  const isMap = (Map && val instanceof Map);
  const isSet = (Set && val instanceof Set);
  const isWeakMap = (WeakMap && val instanceof WeakMap);
  const isWeakSet = (WeakSet && val instanceof WeakSet);

  return isMap || isSet || isWeakMap || isWeakSet;
};

// Though it might be a nice touch to spread generators too, it’d be way too
// presumptuous (could have side effects, could be infinite). As it is,
// functions and generators both just disappear into the night, though the
// user can change this with a custom replacer.
const errReplacer = (val, withStack) => {
  // Errors do not serialize nicely with JSON.stringify because none of the
  // properties of interest are ‘own’ properties.

  const err = { name: val.name || 'Error', message: val.message };

  // Though custom errors could have some own properties:
  Object.assign(err, val);

  // For the stack, we convert to an array for the sake of readability.

  if (withStack) err.stack = val.stack && val.stack.split(stackDelim);

  return err;
};

const flat = (serialize, arraysToo) =>
    (obj) => {
      const serializedObj = JSON.parse(serialize(obj));
      if (!_.isObject(serializedObj)) return serializedObj;

      const flatObj = _.reduce(serializedObj, _.bind(function _flat(target, val, key) {
        const keyContext = this.slice();
        keyContext.push(key);

        const joinedKey = keyContext.join('.');
        const newTarget = target;
        if (!_.isObject(val)) {
          newTarget[joinedKey] = val;
        } else if (!arraysToo && _.isArray(val)) {
          newTarget[joinedKey] = val.map(newVal => {
            if (!_.isObject(newVal)) return newVal;

            return _.reduce(newVal, _.bind(_flat, []), {});
          });
        } else {
          _.reduce(val, _.bind(_flat, keyContext), newTarget);
        }

        return newTarget;
      }, []), {});

      return jsonSS(flatObj);
    };

// build serializer
const build = ({
    flatten, flattenArrays, replacer = pass,
    withStack
}) => {
  // We augment the default JSON.stringify serialization behavior with
  // handling for a number of values that otherwise return nonsense values or
  // nothing at all. In addition to numeric outliers, a number of other basic
  // JS objects (post-ES6 especially) aren’t in the JSON spec, presumably
  // because it would have been too obvious that we were tricking everyone
  // else into making our lives easier. This augmented behavior is useful in a
  // JS environment since we’re not apt to think ‘I am going to log JSON!’; we
  // just want to dump objects in the log hole.

  // If the user supplied a custom replacer, it is applied first.
  const replace = _.flow(replacer, val => {
    // Prototypeless object
    if (_.isObject(val) && !Object.getPrototypeOf(val)) {
      return val;
    }

    if (_.isObject(val) && !(val instanceof Object)) {
      return val;
    }

    // Trouble primitives
    if (_.isNaN(val)) return 'NaN';
    if (val === Infinity) return 'Infinity';
    if (val === -Infinity) return '-Infinity';
    if (1 / val === -Infinity) return '-0';
    if (typeof val === 'symbol') return val.toString();

    // Trouble objects
    if (_.isError(val)) return errReplacer(val, withStack);
    if (_.isArguments(val)) return _.toArray(val);
    if (_.isRegExp(val)) return val.toString();
    if (isNewIterable(val)) return [...val];

    // - Error, regexp, maps and sets would have been `{}`
    // - Arguments would have been `{"0": "arg1", "1": "arg2" }`
    // - NaN and +/-Infinity would have been `null` (wtf?)
    // - -0 would have been 0 (yes I’m being overly thorough)
    // - Symbols would have been undefined

    // Note: numeric literals in base-whatever are just standard decimal
    // integers internally, so 0b1 will be "1" -- the original notation
    // can’t be preserved. JSON does preserve exponent suffixes though.
    return val;
  });

  // json-stringify-safe is a JSON.stringify wrapper that takes care of
  // circular references.
  const serialize = _.partial(jsonSS, _, replace);

  return flatten ? flat(serialize, flattenArrays) : serialize;
};

export { build as default };
