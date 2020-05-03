import { IWeakRef } from './IWeakRef';
import { KeysIterator } from './KeysIterator';
import { ValuesIterator } from './ValuesIterator';
import { EntriesIterator } from './EntitiesIterator';

declare const WeakRef: IWeakRef<any>;

export class WeakValueMap {
  private map: Map<any, IWeakRef<any>>;

  constructor() {
    this.map = new Map();
  }

  get size(): number {
    return this.map.size;
  }

  keys() {
    return new KeysIterator(this.map);
  }

  values() {
    return new ValuesIterator(this.map.values());
  }

  entries() {
    return new EntriesIterator(this.map.entries());
  }

  set(key: any, value: any) {
    this.map.set(key, new WeakRef(value));
  }

  get(key: any): any {
    const ref: IWeakRef<any> = this.map.get(key);

    return ref && ref.deref();
  }

  has(key: any) {
    return !!this.get(key);
  }

  delete(key: any) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  forEach(callback: (value: any, key: any, map: WeakValueMap) => void) {
    this.map.forEach((ref, key) => {
      const value = ref.deref();

      if (value) {
        callback(value, key, this);
      }
    });
  }

  verify() {
    const map = new Map();

    this.map.forEach((ref, key) => {
      const value = ref.deref();

      if (value) {
        map.set(key, ref);
      }
    });

    this.map.clear();
    this.map = map;
  }
}
