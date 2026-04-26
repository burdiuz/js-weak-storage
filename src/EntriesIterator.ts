import { IWeakRef } from './IWeakRef';

export class EntriesIterator<K, V> implements IterableIterator<[K, V]> {
  constructor(private mapIterator: IterableIterator<[K, IWeakRef<V>]>) {}

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return new EntriesIterator(this.mapIterator[Symbol.iterator]());
  }

  next(): IteratorResult<[K, V]> {
    while (true) {
      const result = this.mapIterator.next();
      if (result.done) {
        return { done: true as const, value: undefined };
      }
      const [key, ref] = result.value;
      const value = ref.deref();
      if (value !== undefined) {
        return { done: false as const, value: [key, value] };
      }
    }
  }
}
