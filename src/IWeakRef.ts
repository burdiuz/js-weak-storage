/**
 * Represents an instance of a WeakRef — holds a weak reference to a value
 * that does not prevent it from being garbage-collected.
 */
export interface IWeakRef<T = any> {
  /**
   * Returns the referenced value, or `undefined` if it has been garbage-collected.
   */
  deref(): T | undefined;
}

/**
 * Constructor interface for WeakRef — used to type the global `WeakRef` constructor.
 */
export interface IWeakRefConstructor {
  new <T extends object>(value: T): IWeakRef<T>;
}
