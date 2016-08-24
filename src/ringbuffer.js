import { EventEmitter } from 'events';

class RingBuffer extends EventEmitter {
  constructor(limit) {
    super();
    this.records = [];
    this.limit = limit;
    this.bufferWasFull = false;
  }

  write(log) {
    this.records.push(log);
    if (this.records.length > this.limit) {
      this.records.shift();

      if (!this.bufferWasFull) {
        this.emit('buffer shift');
        this.bufferWasFull = true;
      }
      return false;
    }
    return true;
  }

  read() {
    this.bufferWasFull = false;
    return this.records.shift();
  }

  isEmpty() {
    return this.records.length === 0;
  }
}

const bufferShiftEvent = 'buffer shift';

export {
    RingBuffer as default,
    bufferShiftEvent
};
