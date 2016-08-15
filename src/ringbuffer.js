import { EventEmitter } from 'events';

class RingBuffer extends EventEmitter {
  constructor(limit) {
    super();
    this.records = [];
    this.limit = limit;
  }

  write(log) {
    this.records.push(log);
    if (this.records.length > this.limit) {
      this.records.shift();

      this.emit('buffer shift');
      return false;
    }
    return true;
  }

  read() {
    return this.records.shift();
  }
}

const bufferShiftEvent = 'buffer shift';

export {
    RingBuffer as default,
    bufferShiftEvent
};
