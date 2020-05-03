import { IWeakRef } from './IWeakRef';

export class KeysIterator {
  private mapIterator: IterableIterator<any>;
  constructor(private map: Map<any, IWeakRef<any>>) {
    this.mapIterator = this.map.keys();
  }

  [Symbol.iterator]() {
    return new KeysIterator(this.map);
  }

  next() {
    let key: any;
    let value: any;
    let done: boolean;

    do {
      ({ done, value: key } = this.mapIterator.next());

      if (!done) {
        value = this.map.get(key).deref();
      }
    } while (!done && !value);

    return {
      done,
      value: key,
    };
  }
}
