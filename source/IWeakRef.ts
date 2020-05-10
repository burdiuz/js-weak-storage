export interface IWeakRef<T = any> {
  new (value: T): IWeakRef<T>;
  deref(): T;
}
