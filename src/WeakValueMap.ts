import { IWeakRef, IWeakRefConstructor } from './IWeakRef';
import { IFinalizationRegistry, IFinalizationRegistryConstructor } from './IFinalizationRegistry';
import { KeysIterator } from './KeysIterator';
import { ValuesIterator } from './ValuesIterator';
import { EntriesIterator } from './EntriesIterator';

// Type the globals as constructor types, not instance types
declare const WeakRef: IWeakRefConstructor;
declare const FinalizationRegistry: IFinalizationRegistryConstructor;

export class WeakValueMap<K = any, V extends object = object> {
  private map: Map<K, IWeakRef<V>>;
  private finalizer: IFinalizationRegistry<K> | undefined;

  constructor(autoCleanup = true) {
    this.map = new Map();

    if (autoCleanup) {
      this.finalizer = new FinalizationRegistry((key: K) => {
        const ref = this.map.get(key);

        // Only delete if the ref is truly gone — guard against key reuse
        if (!ref || ref.deref() === undefined) {
          this.map.delete(key);
        }
      });
    }
  }

  /**
   * Returns the number of entries in the map, including entries whose values
   * may have already been garbage-collected but not yet cleaned up.
   * Use `verify()` first if you need an accurate count of live entries.
   */
  get approximateSize(): number {
    return this.map.size;
  }

  keys(): KeysIterator<K, V> {
    return new KeysIterator(this.map);
  }

  values(): ValuesIterator<V> {
    return new ValuesIterator(this.map.values());
  }

  entries(): EntriesIterator<K, V> {
    return new EntriesIterator(this.map.entries());
  }

  set(key: K, value: V): this {
    this.map.set(key, new WeakRef(value));

    if (this.finalizer) {
      this.finalizer.register(value, key);
    }

    return this;
  }

  get(key: K): V | undefined {
    const ref = this.map.get(key);
    return ref && ref.deref();
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  forEach(callback: (value: V, key: K, map: WeakValueMap<K, V>) => void): void {
    this.map.forEach((ref, key) => {
      const value = ref.deref();

      // Only skip truly collected entries (deref returns undefined), not falsy values
      if (value !== undefined) {
        callback(value, key, this);
      }
    });
  }

  /**
   * Rebuilds the internal map retaining only entries whose values are still alive.
   * Useful when `autoCleanup` is disabled or when you need an accurate `approximateSize`.
   */
  verify(): void {
    const map = new Map<K, IWeakRef<V>>();

    this.map.forEach((ref, key) => {
      if (ref.deref() !== undefined) {
        map.set(key, ref);
      }
    });

    this.map = map;
  }
}
