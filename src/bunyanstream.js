import { Writable } from 'stream';
import _ from 'lodash';
import * as defaults from './defaults';
import Logger from './logger';

/**
 * BunyanStream class.
 */
class BunyanStream extends Writable {
  constructor(opts) {
    super({
      objectMode: true
    });

    const loggerOpts = _.clone(opts || {});

    loggerOpts.timestamp = false;
    loggerOpts.levels = opts.levels || defaults.bunyanLevels;

    this.logger = new Logger(loggerOpts);

    this.logger.on('error', err => this.emit(err));
  }

  _write(log, enc, cb) {
    const lvl = (log.level / 10) - 1;

    this.logger.log(lvl, log);

    setImmediate(cb);
  }

  get logger() {
    return this._logger;
  }

  set logger(obj) {
    this._logger = obj;
  }
}

export { BunyanStream as default };
