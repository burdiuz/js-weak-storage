import { IWeakRef } from './IWeakRef';

export class ValuesIterator {
  constructor(private mapIterator: IterableIterator<IWeakRef<any>>) {}

  [Symbol.iterator]() {
    return new ValuesIterator(this.mapIterator[Symbol.iterator]());
  }

  next() {
    let ref: IWeakRef<any>;
    let value: any;
    let done: boolean;

    do {
      ({ done, value: ref } = this.mapIterator.next());

      if (done) {
        value = undefined;
      } else {
        value = ref.deref();
      }
    } while (!done && !value);

    return {
      done,
      value,
    };
  }
}
