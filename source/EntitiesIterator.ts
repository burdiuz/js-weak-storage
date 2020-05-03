import { IWeakRef } from './IWeakRef';

export class EntriesIterator {
  constructor(private mapIterator: IterableIterator<[any, IWeakRef<any>]>) {}

  [Symbol.iterator]() {
    return new EntriesIterator(this.mapIterator[Symbol.iterator]());
  }

  next() {
    let entries: [any, IWeakRef<any>];
    let value: any;
    let done: boolean;

    do {
      ({ done, value: entries } = this.mapIterator.next());

      if (done) {
        entries = undefined;
      } else {
        value = entries[1].deref();
        entries = [entries[0], value];
      }
    } while (!done && !value);

    return {
      done,
      entries,
    };
  }
}
