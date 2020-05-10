import { IWeakRef } from './IWeakRef';
import { KeysIterator } from './KeysIterator';
import { ValuesIterator } from './ValuesIterator';
import { EntriesIterator } from './EntitiesIterator';
import { IFinalizationRegistry } from './IFinalizationRegistry';

declare const WeakRef: IWeakRef<any>;
declare const FinalizationRegistry: IFinalizationRegistry<any>;

export class WeakValueMap {
  private map: Map<any, IWeakRef<any>>;
  private finalizer: IFinalizationRegistry;

  constructor(autoVerify = true) {
    this.map = new Map();

    if (autoVerify) {
      this.finalizer = new FinalizationRegistry((key) => {
        const ref = this.map.get(key);

        if (!ref || !ref.deref()) {
          this.map.delete(key);
        }
      });
    }
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
