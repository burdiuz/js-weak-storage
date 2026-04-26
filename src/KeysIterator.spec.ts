import { KeysIterator } from './KeysIterator';
import { FakeWeakRef } from './test-helpers';

/**
 * Build a raw Map<K, FakeWeakRef<V>> so we can control deref() precisely.
 * KeysIterator only reads the map — it never writes — so a plain Map works fine.
 */
function makeMap<K, V>(entries: Array<[K, V | undefined]>): Map<K, FakeWeakRef<V>> {
  const map = new Map<K, FakeWeakRef<V>>();
  for (const [key, value] of entries) {
    const ref = new FakeWeakRef<V>(value as V);
    if (value === undefined) ref.simulateGC();
    map.set(key, ref);
  }
  return map;
}

describe('KeysIterator', () => {
  // ─── basic iteration ────────────────────────────────────────────────────

  it('should yield all keys for fully-live entries', () => {
    const map = makeMap([['a', { x: 1 }], ['b', { y: 2 }], ['c', { z: 3 }]]);
    const iter = new KeysIterator(map);
    const keys = [...iter];
    expect(keys).toEqual(['a', 'b', 'c']);
  });

  it('should return done=true immediately for an empty map', () => {
    const map = new Map<string, FakeWeakRef<object>>();
    const iter = new KeysIterator(map);
    const result = iter.next();
    expect(result.done).toBe(true);
  });

  it('should work with a single entry', () => {
    const map = makeMap([['only', { v: 1 }]]);
    const iter = new KeysIterator(map);
    expect(iter.next()).toEqual({ done: false, value: 'only' });
    expect(iter.next().done).toBe(true);
  });

  // ─── GC simulation ─────────────────────────────────────────────────────

  it('should skip keys whose refs have been GC-collected', () => {
    const map = makeMap<string, object>([
      ['alive', { keep: true }],
      ['dead', undefined],        // simulated GC
      ['also-alive', { keep: true }],
    ]);
    const keys = [...new KeysIterator(map)];
    expect(keys).toContain('alive');
    expect(keys).toContain('also-alive');
    expect(keys).not.toContain('dead');
  });

  it('should yield nothing when all entries are GC-collected', () => {
    const map = makeMap<string, object>([
      ['x', undefined],
      ['y', undefined],
    ]);
    const keys = [...new KeysIterator(map)];
    expect(keys).toHaveLength(0);
  });

  it('should handle leading dead entries and yield the remaining live ones', () => {
    const map = makeMap<string, object>([
      ['dead1', undefined],
      ['dead2', undefined],
      ['live', { ok: true }],
    ]);
    const keys = [...new KeysIterator(map)];
    expect(keys).toEqual(['live']);
  });

  it('should handle trailing dead entries after live ones', () => {
    const map = makeMap<string, object>([
      ['live', { ok: true }],
      ['dead', undefined],
    ]);
    const keys = [...new KeysIterator(map)];
    expect(keys).toEqual(['live']);
  });

  // ─── BUG REGRESSION: `!value` skipped falsy values ─────────────────────

  it('[regression] should NOT skip a key when its value deref is falsy but not undefined', () => {
    // Original: `while (!done && !value)` — any falsy deref was skipped.
    // Fix:      `while (!done && value === undefined)` — only undefined is skipped.
    const map = new Map<string, FakeWeakRef<any>>();
    // We store an object wrapper (all stored values are objects), so the ref
    // itself is always truthy — the object containing a falsy property is fine.
    // To simulate the bug directly we need a ref that deref()s to a falsy primitive.
    const ref = new FakeWeakRef<any>(0);
    map.set('zero', ref);
    const keys = [...new KeysIterator(map)];
    // 0 is falsy but not undefined — key must NOT be skipped
    expect(keys).toContain('zero');
  });

  it('[regression] should NOT skip a key when deref returns false', () => {
    const map = new Map<string, FakeWeakRef<any>>();
    map.set('flag', new FakeWeakRef<any>(false));
    const keys = [...new KeysIterator(map)];
    expect(keys).toContain('flag');
  });

  it('[regression] should NOT skip a key when deref returns empty string', () => {
    const map = new Map<string, FakeWeakRef<any>>();
    map.set('str', new FakeWeakRef<any>(''));
    const keys = [...new KeysIterator(map)];
    expect(keys).toContain('str');
  });

  // ─── Symbol.iterator / re-iteration ────────────────────────────────────

  it('should be iterable via for..of', () => {
    const map = makeMap([['a', { x: 1 }], ['b', { y: 2 }]]);
    const iter = new KeysIterator(map);
    const keys: string[] = [];
    for (const k of iter) keys.push(k);
    expect(keys).toEqual(['a', 'b']);
  });

  it('Symbol.iterator should return a fresh independent iterator', () => {
    const map = makeMap([['a', { x: 1 }], ['b', { y: 2 }]]);
    const iter = new KeysIterator(map);
    const iter2 = iter[Symbol.iterator]();
    expect(iter2).not.toBe(iter);
    expect([...iter2]).toEqual(['a', 'b']);
  });

  it('should support numeric keys', () => {
    const map = makeMap([[1, { x: 1 }], [2, { y: 2 }]]);
    const keys = [...new KeysIterator(map)];
    expect(keys).toEqual([1, 2]);
  });
});
