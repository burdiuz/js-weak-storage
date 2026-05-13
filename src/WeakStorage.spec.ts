import { WeakStorage } from './WeakStorage';
import { installFakeGlobals } from './test-helpers';

describe('WeakStorage', () => {
  const { tracker } = installFakeGlobals();

  // ─── construction ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create an empty storage', () => {
      const store = new WeakStorage();
      expect(store.approximateSize).toBe(0);
    });

    it('should accept FinalizationRegistryClass and pass it to parent', () => {
      expect(() => new WeakStorage()).not.toThrow();
      expect(() => new WeakStorage(null)).not.toThrow();
    });
  });

  // ─── set ─────────────────────────────────────────────────────────────────

  describe('set', () => {
    it('should store key→value in WeakValueMap (forward lookup)', () => {
      const store = new WeakStorage<string, object>();
      const value = { x: 1 };
      store.set('key', value);
      expect(store.get('key')).toBe(value);
    });

    it('should return this for chaining', () => {
      const store = new WeakStorage<string, object>();
      const result = store.set('a', { x: 1 });
      expect(result).toBe(store);
    });

    it('should support chained sets', () => {
      const store = new WeakStorage<string, object>();
      const v1 = { a: 1 };
      const v2 = { b: 2 };
      store.set('a', v1).set('b', v2);
      expect(store.get('a')).toBe(v1);
      expect(store.get('b')).toBe(v2);
    });

    it('should overwrite an existing key', () => {
      const store = new WeakStorage<string, object>();
      const old = { old: true };
      const fresh = { fresh: true };
      store.set('k', old);
      store.set('k', fresh);
      expect(store.get('k')).toBe(fresh);
    });
  });

  // ─── getKey (reverse lookup) ─────────────────────────────────────────────

  describe('getKey', () => {
    it('should return the key for a stored value', () => {
      const store = new WeakStorage<string, object>();
      const value = { id: 'abc' };
      store.set('myKey', value);
      expect(store.getKey(value)).toBe('myKey');
    });

    it('should return undefined for a value that was never stored', () => {
      const store = new WeakStorage<string, object>();
      expect(store.getKey({ unknown: true })).toBeUndefined();
    });

    it('should return undefined after the key has been deleted', () => {
      const store = new WeakStorage<string, object>();
      const value = { id: 'del' };
      store.set('k', value);
      store.delete('k');
      expect(store.getKey(value)).toBeUndefined();
    });

    it('should work with numeric keys', () => {
      const store = new WeakStorage<number, object>();
      const value = { n: true };
      store.set(42, value);
      expect(store.getKey(value)).toBe(42);
    });

    it('should work with symbol keys', () => {
      const store = new WeakStorage<symbol, object>();
      const sym = Symbol('k');
      const value = { s: true };
      store.set(sym, value);
      expect(store.getKey(value)).toBe(sym);
    });

    // ── BUG REGRESSION: byValues was set(key, value) not set(value, key) ──

    it('[regression] getKey should return the correct key, not undefined', () => {
      // Original bug: `this.byValues.set(key, value)` — stored in the wrong
      // direction. getKey(value) did `byValues.get(value)` which returned
      // undefined because value was never used as a WeakMap key.
      // Fix: `this.byValues.set(value, key)`.
      const store = new WeakStorage<string, object>();
      const value = { important: true };
      store.set('correctKey', value);

      // This is the exact assertion that would FAIL on the unfixed version:
      expect(store.getKey(value)).toBe('correctKey');
    });

    it('[regression] getKey should not return the value itself', () => {
      // In the broken version, byValues.get(key) might have returned the
      // value (since it was stored as key→value) if key happened to equal value.
      // Here we use different types to make the confusion obvious.
      const store = new WeakStorage<string, object>();
      const value = { data: 'hello' };
      store.set('theKey', value);

      const result = store.getKey(value);
      expect(result).not.toBe(value); // must be the key string, not the value object
      expect(result).toBe('theKey');
    });

    it('[regression] two values with different keys return their respective keys', () => {
      const store = new WeakStorage<string, object>();
      const v1 = { id: 1 };
      const v2 = { id: 2 };
      store.set('key1', v1);
      store.set('key2', v2);

      expect(store.getKey(v1)).toBe('key1');
      expect(store.getKey(v2)).toBe('key2');
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should remove the forward entry (get returns undefined)', () => {
      const store = new WeakStorage<string, object>();
      const value = { x: 1 };
      store.set('k', value);
      store.delete('k');
      expect(store.get('k')).toBeUndefined();
    });

    it('should remove the reverse entry (getKey returns undefined)', () => {
      const store = new WeakStorage<string, object>();
      const value = { x: 1 };
      store.set('k', value);
      store.delete('k');
      expect(store.getKey(value)).toBeUndefined();
    });

    it('should return true when the key existed', () => {
      const store = new WeakStorage<string, object>();
      store.set('k', { x: 1 });
      expect(store.delete('k')).toBe(true);
    });

    it('should return false when the key did not exist', () => {
      const store = new WeakStorage<string, object>();
      expect(store.delete('missing')).toBe(false);
    });

    it('should not affect other entries', () => {
      const store = new WeakStorage<string, object>();
      const v1 = { a: 1 };
      const v2 = { b: 2 };
      store.set('a', v1);
      store.set('b', v2);
      store.delete('a');
      expect(store.get('b')).toBe(v2);
      expect(store.getKey(v2)).toBe('b');
    });

    it('should handle delete after GC simulation gracefully', () => {
      const store = new WeakStorage<string, object>();
      const value = { gc: true };
      store.set('k', value);
      tracker.simulateGC(value);
      // get() returns undefined → byValues.delete() is skipped → no throw
      expect(() => store.delete('k')).not.toThrow();
    });
  });

  // ─── clear ───────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('should remove all entries from forward map', () => {
      const store = new WeakStorage<string, object>();
      store.set('a', { x: 1 });
      store.set('b', { y: 2 });
      store.clear();
      expect(store.approximateSize).toBe(0);
      expect(store.get('a')).toBeUndefined();
      expect(store.get('b')).toBeUndefined();
    });

    it('should reset the reverse index (getKey returns undefined after clear)', () => {
      const store = new WeakStorage<string, object>();
      const v = { reset: true };
      store.set('k', v);
      store.clear();
      // The byValues WeakMap is replaced with a new one — old entries gone
      expect(store.getKey(v)).toBeUndefined();
    });

    it('should not throw when called on an empty store', () => {
      expect(() => new WeakStorage().clear()).not.toThrow();
    });

    it('should allow new entries after clear', () => {
      const store = new WeakStorage<string, object>();
      store.set('a', { x: 1 });
      store.clear();
      const fresh = { fresh: true };
      store.set('a', fresh);
      expect(store.get('a')).toBe(fresh);
      expect(store.getKey(fresh)).toBe('a');
    });
  });

  // ─── inherited WeakValueMap behaviour ────────────────────────────────────

  describe('inherited WeakValueMap behaviour', () => {
    it('has() should return true for stored entries', () => {
      const store = new WeakStorage<string, object>();
      store.set('k', { x: 1 });
      expect(store.has('k')).toBe(true);
    });

    it('has() should return false for GC-collected entries', () => {
      const store = new WeakStorage<string, object>();
      const value = { gc: true };
      store.set('k', value);
      tracker.simulateGC(value);
      expect(store.has('k')).toBe(false);
    });

    it('forEach() should visit all live entries', () => {
      const store = new WeakStorage<string, object>();
      const v1 = { a: 1 };
      const v2 = { b: 2 };
      store.set('a', v1);
      store.set('b', v2);
      const visited: string[] = [];
      store.forEach((_v, k) => visited.push(k));
      expect(visited).toContain('a');
      expect(visited).toContain('b');
    });

    it('keys() iterator should yield live keys', () => {
      const store = new WeakStorage<string, object>();
      store.set('x', { x: 1 });
      store.set('y', { y: 2 });
      const keys = [...store.keys()];
      expect(keys).toContain('x');
      expect(keys).toContain('y');
    });

    it('values() iterator should yield live values', () => {
      const store = new WeakStorage<string, object>();
      const v = { val: true };
      store.set('k', v);
      const values = [...store.values()];
      expect(values).toContain(v);
    });

    it('entries() iterator should yield live [key, value] pairs', () => {
      const store = new WeakStorage<string, object>();
      const v = { entry: true };
      store.set('k', v);
      const entries = [...store.entries()];
      expect(entries).toEqual([['k', v]]);
    });
  });
});
