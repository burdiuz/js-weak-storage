export interface IFinalizationRegistry<T = any, K = any> {
  new (callback: (key: T) => void): IFinalizationRegistry<T, K>;
  register(value: K, key: T): void;
}
