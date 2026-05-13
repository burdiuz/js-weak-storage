import { WeakValueMap } from './WeakValueMap';
import { IFinalizationRegistryConstructor } from './IFinalizationRegistry';

export class WeakStorage<K = any, V extends object = object> extends WeakValueMap<K, V> {
  // Reverse index: value → key, for O(1) key lookup given a value
  private byValues: WeakMap<V, K>;

  constructor(FinalizationRegistryClass?: IFinalizationRegistryConstructor | null) {
    super(FinalizationRegistryClass as IFinalizationRegistryConstructor | null);
    this.byValues = new WeakMap();
  }

  set(key: K, value: V): this {
    super.set(key, value);
    // Fix: store value→key (not key→value) so that getKey(value) works correctly
    this.byValues.set(value, key);
    return this;
  }

  /**
   * Returns the key associated with a given value, or `undefined` if not found.
   */
  getKey(value: V): K | undefined {
    return this.byValues.get(value);
  }

  delete(key: K): boolean {
    const value = this.get(key);

    if (value !== undefined) {
      this.byValues.delete(value);
    }

    return super.delete(key);
  }

  clear(): void {
    super.clear();
    this.byValues = new WeakMap();
  }
}
