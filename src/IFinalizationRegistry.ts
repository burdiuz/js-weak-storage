/**
 * Represents an instance of a FinalizationRegistry — notifies when
 * registered objects are garbage-collected.
 */
export interface IFinalizationRegistry<T = any> {
  /**
   * Registers a value with the registry. When `value` is garbage-collected,
   * the cleanup callback will be called with `key` as its argument.
   */
  register(value: object, key: T): void;
}

/**
 * Constructor interface for FinalizationRegistry — used to type the global
 * `FinalizationRegistry` constructor.
 */
export interface IFinalizationRegistryConstructor<T = any> {
  new (callback: (key: T) => void): IFinalizationRegistry<T>;
}
