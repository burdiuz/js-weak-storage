import { WeakValueMap } from './WeakValueMap';

export class WeakStorage extends WeakValueMap {
  private byValues: WeakMap<any, any>;

  constructor() {
    super();
    this.byValues = new WeakMap();
  }

  set(key: any, value: any) {
    super.set(key, value);
    this.byValues.set(key, value);
  }

  getKey(value: any) {
    return this.byValues.get(value);
  }

  delete(key: any) {
    const value = this.get(key);

    if (value) {
      this.byValues.delete(value);
    }

    return super.delete(key);
  }

  clear() {
    super.clear();
    this.byValues = new WeakMap();
  }
}
