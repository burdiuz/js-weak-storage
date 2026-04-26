import { IWeakRef } from './IWeakRef';

export class ValuesIterator<V> implements IterableIterator<V> {
  constructor(private mapIterator: IterableIterator<IWeakRef<V>>) {}

  [Symbol.iterator](): IterableIterator<V> {
    return new ValuesIterator(this.mapIterator[Symbol.iterator]());
  }

  next(): IteratorResult<V> {
    while (true) {
      const result = this.mapIterator.next();
      if (result.done) {
        return { done: true as const, value: undefined };
      }
      const value = result.value.deref();
      if (value !== undefined) {
        return { done: false as const, value };
      }
    }
  }
}
