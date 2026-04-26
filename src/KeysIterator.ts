import { IWeakRef } from './IWeakRef';

export class KeysIterator<K, V> implements IterableIterator<K> {
  private mapIterator: IterableIterator<K>;

  constructor(private map: Map<K, IWeakRef<V>>) {
    this.mapIterator = this.map.keys();
  }

  [Symbol.iterator](): IterableIterator<K> {
    return new KeysIterator(this.map);
  }

  next(): IteratorResult<K> {
    while (true) {
      const result = this.mapIterator.next();
      if (result.done) {
        return { done: true as const, value: undefined };
      }
      const key = result.value;
      if (this.map.get(key)!.deref() !== undefined) {
        return { done: false as const, value: key };
      }
    }
  }
}
