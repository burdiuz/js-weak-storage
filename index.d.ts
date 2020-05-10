export declare class WeakValueMap {
  constructor(autoVerify?: boolean);
  readonly size: number;

  keys(): IterableIterator<any>;
  values(): IterableIterator<any>;
  entries(): IterableIterator<[any, any]>;
  set(key: any, value: any): void;
  get(key: any): any;
  has(key: any): boolean;
  delete(key: any): boolean;
  clear(): boolean;
  forEach(callback: (value: any, key: any, map: WeakValueMap) => void): void;
  verify(): void;
}

export declare class WeakStorage extends WeakValueMap {
  constructor(autoVerify?: boolean);
  getKey(value: any): any;
}
