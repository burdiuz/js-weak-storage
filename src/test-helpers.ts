/**
 * Shared test utilities for simulating WeakRef garbage collection and
 * FinalizationRegistry callbacks without actually triggering GC.
 *
 * The real WeakRef/FinalizationRegistry are non-deterministic — we mock them
 * so tests can simulate collection precisely and synchronously.
 */

export type FinalizationCallback<K> = (key: K) => void;

/**
 * A controllable fake WeakRef. Call `.simulateGC()` to make `deref()`
 * return `undefined` as if the value was garbage-collected.
 */
export class FakeWeakRef<T> {
  private _value: T | undefined;

  constructor(value: T) {
    this._value = value;
  }

  deref(): T | undefined {
    return this._value;
  }

  simulateGC(): void {
    this._value = undefined;
  }
}

/**
 * A controllable fake FinalizationRegistry. Call `.triggerCallback(key)` to
 * manually fire the cleanup callback as if the GC had collected a value.
 */
export class FakeFinalizationRegistry<K> {
  private callback: FinalizationCallback<K>;
  readonly registrations: Array<{ value: object; key: K }> = [];

  constructor(callback: FinalizationCallback<K>) {
    this.callback = callback;
  }

  register(value: object, key: K): void {
    this.registrations.push({ value, key });
  }

  triggerCallback(key: K): void {
    this.callback(key);
  }

  triggerAll(): void {
    this.registrations.forEach(({ key }) => this.callback(key));
  }
}

/**
 * Registry of all FakeWeakRef instances created during a test, keyed by the
 * value they wrap. Lets tests retrieve refs to simulate GC after the fact.
 */
export class WeakRefTracker {
  private refs = new Map<any, FakeWeakRef<any>>();

  createRef<T>(value: T): FakeWeakRef<T> {
    const ref = new FakeWeakRef(value);
    this.refs.set(value, ref);
    return ref;
  }

  getRef<T>(value: T): FakeWeakRef<T> | undefined {
    return this.refs.get(value);
  }

  simulateGC(value: any): void {
    const ref = this.refs.get(value);
    if (ref) ref.simulateGC();
  }

  clear(): void {
    this.refs.clear();
  }
}

/**
 * Installs fake WeakRef and FinalizationRegistry globals for the duration of
 * a describe block. Returns accessors for the tracker and last registry created.
 *
 * Usage:
 *   const { tracker, getRegistry } = installFakeGlobals();
 *   // inside a test:
 *   tracker.simulateGC(myValue);
 *   getRegistry().triggerCallback('myKey');
 */
export function installFakeGlobals<K = any>() {
  const tracker = new WeakRefTracker();
  let lastRegistry: FakeFinalizationRegistry<K> | undefined;

  beforeEach(() => {
    tracker.clear();
    lastRegistry = undefined;

    (global as any).WeakRef = class<T> {
      private ref: FakeWeakRef<T>;
      constructor(value: T) {
        this.ref = tracker.createRef(value);
      }
      deref(): T | undefined {
        return this.ref.deref();
      }
    };

    (global as any).FinalizationRegistry = class {
      private registry: FakeFinalizationRegistry<K>;
      constructor(callback: FinalizationCallback<K>) {
        lastRegistry = new FakeFinalizationRegistry(callback);
        this.registry = lastRegistry;
      }
      register(value: object, key: K): void {
        this.registry.register(value, key);
      }
    };
  });

  afterEach(() => {
    delete (global as any).WeakRef;
    delete (global as any).FinalizationRegistry;
  });

  return {
    tracker,
    getRegistry: () => lastRegistry,
  };
}
