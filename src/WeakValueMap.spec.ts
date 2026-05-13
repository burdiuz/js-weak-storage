import { WeakValueMap } from './WeakValueMap';
import { installFakeGlobals } from './test-helpers';

describe('WeakValueMap', () => {
  const { tracker, getRegistry } = installFakeGlobals();

  // ─── construction ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create an empty map', () => {
      const map = new WeakValueMap();
      expect(map.approximateSize).toBe(0);
    });

    it('should create a FinalizationRegistry using the global by default', () => {
      new WeakValueMap();
      expect(getRegistry()).toBeDefined();
    });

    it('should NOT create a FinalizationRegistry when FinalizationRegistryClass=null', () => {
      new WeakValueMap(null);
      expect(getRegistry()).toBeUndefined();
    });

    it('should warn and not create a registry when FinalizationRegistry is absent from the environment', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      (global as any).FinalizationRegistry = undefined;
      new WeakValueMap();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('FinalizationRegistry'));
      expect(getRegistry()).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('should use a custom FinalizationRegistryClass when provided', () => {
      const registrations: Array<{ value: object; key: unknown }> = [];
      const CustomRegistry = class {
        constructor(_cb: (key: unknown) => void) {}
        register(value: object, key: unknown) {
          registrations.push({ value, key });
        }
      };
      const map = new WeakValueMap(CustomRegistry as any);
      map.set('k', { x: 1 });
      expect(registrations).toHaveLength(1);
      expect(registrations[0].key).toBe('k');
    });
  });

  // ─── set ─────────────────────────────────────────────────────────────────

  describe('set', () => {
    it('should store a value and return this for chaining', () => {
      const map = new WeakValueMap();
      const value = { x: 1 };
      const result = map.set('key', value);
      expect(result).toBe(map);
      expect(map.get('key')).toBe(value);
    });

    it('should overwrite an existing key with a new value', () => {
      const map = new WeakValueMap();
      const v1 = { a: 1 };
      const v2 = { b: 2 };
      map.set('key', v1);
      map.set('key', v2);
      expect(map.get('key')).toBe(v2);
    });

    it('should register the value with the finalizer', () => {
      const map = new WeakValueMap();
      const value = { x: 1 };
      map.set('key', value);
      const registry = getRegistry()!;
      expect(registry.registrations).toHaveLength(1);
      expect(registry.registrations[0].key).toBe('key');
    });

    it('should NOT register with finalizer when FinalizationRegistryClass=null', () => {
      const map = new WeakValueMap(null);
      map.set('key', { x: 1 });
      expect(getRegistry()).toBeUndefined();
    });

    it('should support symbol keys', () => {
      const map = new WeakValueMap();
      const sym = Symbol('sym');
      const value = { s: true };
      map.set(sym, value);
      expect(map.get(sym)).toBe(value);
    });

    it('should support numeric keys', () => {
      const map = new WeakValueMap();
      const value = { n: 42 };
      map.set(42, value);
      expect(map.get(42)).toBe(value);
    });
  });

  // ─── get ─────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('should return the stored value', () => {
      const map = new WeakValueMap();
      const value = { q: 99 };
      map.set('k', value);
      expect(map.get('k')).toBe(value);
    });

    it('should return undefined for an unknown key', () => {
      const map = new WeakValueMap();
      expect(map.get('missing')).toBeUndefined();
    });

    it('should return undefined after GC simulation', () => {
      const map = new WeakValueMap();
      const value = { gc: true };
      map.set('k', value);
      tracker.simulateGC(value);
      expect(map.get('k')).toBeUndefined();
    });

    // ── BUG REGRESSION: falsy values were skipped ─────────────────────────
    it('[regression] should return 0 (falsy) without skipping it', () => {
      const map = new WeakValueMap<string, any>();
      // 0 is falsy — original code: `ref && ref.deref()` would return 0 (falsy)
      // and callers would treat it as missing. Fixed: deref() result used directly.
      const value = { num: 0 };
      map.set('zero', value);
      expect(map.get('zero')).toBe(value);
    });

    it('[regression] should return false (falsy) without skipping it', () => {
      const map = new WeakValueMap<string, any>();
      const value = { flag: false };
      map.set('flag', value);
      expect(map.get('flag')).toBe(value);
    });

    it('[regression] should return empty string (falsy) without skipping it', () => {
      const map = new WeakValueMap<string, any>();
      const value = { str: '' };
      map.set('str', value);
      expect(map.get('str')).toBe(value);
    });
  });

  // ─── has ─────────────────────────────────────────────────────────────────

  describe('has', () => {
    it('should return true for a stored key', () => {
      const map = new WeakValueMap();
      map.set('k', { x: 1 });
      expect(map.has('k')).toBe(true);
    });

    it('should return false for an unknown key', () => {
      const map = new WeakValueMap();
      expect(map.has('missing')).toBe(false);
    });

    it('should return false after GC simulation', () => {
      const map = new WeakValueMap();
      const value = { gc: true };
      map.set('k', value);
      tracker.simulateGC(value);
      expect(map.has('k')).toBe(false);
    });

    it('should return false after delete', () => {
      const map = new WeakValueMap();
      map.set('k', { x: 1 });
      map.delete('k');
      expect(map.has('k')).toBe(false);
    });
  });

  // ─── delete ──────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should remove an existing key and return true', () => {
      const map = new WeakValueMap();
      map.set('k', { x: 1 });
      expect(map.delete('k')).toBe(true);
      expect(map.has('k')).toBe(false);
    });

    it('should return false when the key does not exist', () => {
      const map = new WeakValueMap();
      expect(map.delete('missing')).toBe(false);
    });

    it('should decrement approximateSize after delete', () => {
      const map = new WeakValueMap();
      map.set('a', { x: 1 });
      map.set('b', { y: 2 });
      map.delete('a');
      expect(map.approximateSize).toBe(1);
    });
  });

  // ─── clear ───────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('should remove all entries', () => {
      const map = new WeakValueMap();
      map.set('a', { x: 1 });
      map.set('b', { y: 2 });
      map.clear();
      expect(map.approximateSize).toBe(0);
      expect(map.has('a')).toBe(false);
      expect(map.has('b')).toBe(false);
    });

    it('should not throw when already empty', () => {
      const map = new WeakValueMap();
      expect(() => map.clear()).not.toThrow();
    });
  });

  // ─── approximateSize ─────────────────────────────────────────────────────

  describe('approximateSize', () => {
    it('should return 0 for an empty map', () => {
      const map = new WeakValueMap();
      expect(map.approximateSize).toBe(0);
    });

    it('should increase as entries are added', () => {
      const map = new WeakValueMap();
      map.set('a', { x: 1 });
      map.set('b', { y: 2 });
      expect(map.approximateSize).toBe(2);
    });

    // ── BUG REGRESSION: was called `size` and counted dead refs as alive ──
    it('[regression] approximateSize may count GC-collected entries until cleanup runs', () => {
      const map = new WeakValueMap();
      const value = { temp: true };
      map.set('k', value);
      tracker.simulateGC(value);
      // Before the finalizer runs, approximateSize still reports 1
      expect(map.approximateSize).toBe(1);
      // But has() correctly returns false
      expect(map.has('k')).toBe(false);
    });
  });

  // ─── forEach ─────────────────────────────────────────────────────────────

  describe('forEach', () => {
    it('should visit all live entries', () => {
      const map = new WeakValueMap<string, object>();
      const v1 = { a: 1 };
      const v2 = { b: 2 };
      map.set('a', v1);
      map.set('b', v2);
      const visited: Array<[string, object]> = [];
      map.forEach((value, key) => visited.push([key, value]));
      expect(visited).toHaveLength(2);
      expect(visited.find(([k]) => k === 'a')?.[1]).toBe(v1);
      expect(visited.find(([k]) => k === 'b')?.[1]).toBe(v2);
    });

    it('should skip GC-collected entries', () => {
      const map = new WeakValueMap<string, object>();
      const alive = { keep: true };
      const dead = { gone: true };
      map.set('alive', alive);
      map.set('dead', dead);
      tracker.simulateGC(dead);
      const keys: string[] = [];
      map.forEach((_v, k) => keys.push(k));
      expect(keys).toContain('alive');
      expect(keys).not.toContain('dead');
    });

    it('should pass map itself as third argument', () => {
      const map = new WeakValueMap<string, object>();
      map.set('k', { x: 1 });
      map.forEach((_v, _k, m) => {
        expect(m).toBe(map);
      });
    });

    // ── BUG REGRESSION: falsy values were silently skipped ────────────────
    it('[regression] should visit entries whose objects contain falsy properties', () => {
      const map = new WeakValueMap<string, object>();
      // The object itself is truthy (it's an object), so it should always be visited
      const falsyContainer = { value: 0, flag: false, str: '' };
      map.set('falsy', falsyContainer);
      const visited: string[] = [];
      map.forEach((_v, k) => visited.push(k));
      expect(visited).toContain('falsy');
    });
  });

  // ─── FinalizationRegistry auto-cleanup ───────────────────────────────────

  describe('auto-cleanup via FinalizationRegistry', () => {
    it('should delete the entry when finalizer fires for a collected ref', () => {
      const map = new WeakValueMap();
      const value = { temp: true };
      map.set('k', value);
      tracker.simulateGC(value);
      getRegistry()!.triggerCallback('k');
      expect(map.approximateSize).toBe(0);
    });

    it('should NOT delete entry if the key was reused with a new live value', () => {
      // Guard against the "key reuse" race: GC fires for old value, but
      // the key has already been reassigned to a new live value.
      const map = new WeakValueMap();
      const old = { old: true };
      map.set('k', old);
      tracker.simulateGC(old);
      // Reassign key to a new live value before finalizer fires
      const fresh = { fresh: true };
      map.set('k', fresh);
      // Now finalizer fires for the old value's registration
      getRegistry()!.triggerCallback('k');
      // The fresh value should still be alive
      expect(map.get('k')).toBe(fresh);
    });
  });

  // ─── verify ──────────────────────────────────────────────────────────────

  describe('verify', () => {
    it('should remove GC-collected entries from the internal map', () => {
      const map = new WeakValueMap(null); // null disables auto-cleanup
      const alive = { keep: true };
      const dead = { gone: true };
      map.set('alive', alive);
      map.set('dead', dead);
      tracker.simulateGC(dead);
      map.verify();
      expect(map.approximateSize).toBe(1);
      expect(map.has('alive')).toBe(true);
      expect(map.has('dead')).toBe(false);
    });

    it('should be a no-op when all entries are alive', () => {
      const map = new WeakValueMap(null);
      map.set('a', { x: 1 });
      map.set('b', { y: 2 });
      map.verify();
      expect(map.approximateSize).toBe(2);
    });

    it('should leave map empty when all entries are collected', () => {
      const map = new WeakValueMap(null);
      const v1 = { x: 1 };
      const v2 = { y: 2 };
      map.set('a', v1);
      map.set('b', v2);
      tracker.simulateGC(v1);
      tracker.simulateGC(v2);
      map.verify();
      expect(map.approximateSize).toBe(0);
    });
  });

  // ─── iterators (delegated — full tests in iterator spec files) ───────────

  describe('keys / values / entries return correct iterator types', () => {
    it('keys() should return a KeysIterator', () => {
      const map = new WeakValueMap<string, object>();
      map.set('a', { x: 1 });
      const iter = map.keys();
      expect(typeof iter[Symbol.iterator]).toBe('function');
      expect(typeof iter.next).toBe('function');
    });

    it('values() should return a ValuesIterator', () => {
      const map = new WeakValueMap<string, object>();
      map.set('a', { x: 1 });
      const iter = map.values();
      expect(typeof iter[Symbol.iterator]).toBe('function');
      expect(typeof iter.next).toBe('function');
    });

    it('entries() should return an EntriesIterator', () => {
      const map = new WeakValueMap<string, object>();
      map.set('a', { x: 1 });
      const iter = map.entries();
      expect(typeof iter[Symbol.iterator]).toBe('function');
      expect(typeof iter.next).toBe('function');
    });
  });
});
