export interface IWeakRef<T> {
  new (value: T): IWeakRef<T>;
  deref(): T;
}
