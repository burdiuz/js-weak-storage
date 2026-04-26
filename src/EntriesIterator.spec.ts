import { EntriesIterator } from './EntriesIterator';
import { FakeWeakRef } from './test-helpers';

function makeEntryIterator<K, V>(
  entries: Array<[K, V | undefined]>
): IterableIterator<[K, FakeWeakRef<V>]> {
  const pairs: Array<[K, FakeWeakRef<V>]> = entries.map(([k, v]) => {
    const ref = new FakeWeakRef<V>(v as V);
    if (v === undefined) ref.simulateGC();
    return [k, ref];
  });
  return pairs[Symbol.iterator]() as unknown as IterableIterator<[K, FakeWeakRef<V>]>;
}

describe('EntriesIterator', () => {
  // ─── basic iteration ────────────────────────────────────────────────────

  it('should yield [key, value] tuples for all live entries', () => {
    const v1 = { a: 1 };
    const v2 = { b: 2 };
    const iter = new EntriesIterator(
      makeEntryIterator<string, object>([['keyA', v1], ['keyB', v2]])
    );
    expect([...iter]).toEqual([['keyA', v1], ['keyB', v2]]);
  });

  it('should return done=true immediately for an empty source', () => {
    const iter = new EntriesIterator(makeEntryIterator([]));
    expect(iter.next().done).toBe(true);
  });

  it('should work with a single live entry', () => {
    const value = { only: true };
    const iter = new EntriesIterator(makeEntryIterator([['k', value]]));
    const result = iter.next();
    expect(result).toEqual({ done: false, value: ['k', value] });
    expect(iter.next().done).toBe(true);
  });

  // ─── GC simulation ─────────────────────────────────────────────────────

  it('should skip entries whose refs have been collected', () => {
    const alive = { keep: true };
    const iter = new EntriesIterator(
      makeEntryIterator<string, object>([['alive', alive], ['dead', undefined]])
    );
    const entries = [...iter];
    expect(entries).toEqual([['alive', alive]]);
  });

  it('should yield nothing when all refs are collected', () => {
    const iter = new EntriesIterator(
      makeEntryIterator<string, object>([['x', undefined], ['y', undefined]])
    );
    expect([...iter]).toHaveLength(0);
  });

  it('should skip dead entries in the middle and yield surrounding live ones', () => {
    const v1 = { first: true };
    const v2 = { third: true };
    const iter = new EntriesIterator(
      makeEntryIterator<string, object>([
        ['first', v1],
        ['second', undefined],
        ['third', v2],
      ])
    );
    expect([...iter]).toEqual([['first', v1], ['third', v2]]);
  });

  // ─── BUG REGRESSION #1: returned `entries` instead of `value` ──────────

  it('[regression] next() should return { done, value } not { done, entries }', () => {
    // Original bug: `return { done, entries }` — the iterator protocol requires
    // `{ done, value }`. Anything consuming this via for..of or destructuring
    // would receive `undefined` for the value slot.
    const v = { data: 42 };
    const iter = new EntriesIterator(makeEntryIterator([['k', v]]));
    const result = iter.next();

    expect(result).toHaveProperty('done');
    expect(result).toHaveProperty('value');       // must be `value`, not `entries`
    expect((result as any).entries).toBeUndefined(); // `entries` key must NOT exist
    expect(result.value).toEqual(['k', v]);
  });

  it('[regression] for..of should destructure [key, value] correctly', () => {
    // This would silently yield undefined for each iteration in the broken version
    const v1 = { x: 1 };
    const v2 = { y: 2 };
    const iter = new EntriesIterator(
      makeEntryIterator<string, object>([['a', v1], ['b', v2]])
    );
    const collected: Array<[string, object]> = [];
    for (const entry of iter) {
      collected.push(entry);
    }
    expect(collected).toEqual([['a', v1], ['b', v2]]);
  });

  // ─── BUG REGRESSION #2: `!value` skipped falsy values ──────────────────

  it('[regression] should yield entry when value deref returns 0 (falsy)', () => {
    // Original: `while (!done && !value)` — 0 is falsy so it was skipped.
    // Fix:      `while (!done && value === undefined)`.
    const iter = new EntriesIterator(makeEntryIterator<string, any>([['k', 0]]));
    const entries = [...iter];
    expect(entries).toEqual([['k', 0]]);
  });

  it('[regression] should yield entry when value deref returns false', () => {
    const iter = new EntriesIterator(makeEntryIterator<string, any>([['k', false]]));
    expect([...iter]).toEqual([['k', false]]);
  });

  it('[regression] should yield entry when value deref returns empty string', () => {
    const iter = new EntriesIterator(makeEntryIterator<string, any>([['k', '']]));
    expect([...iter]).toEqual([['k', '']]);
  });

  it('[regression] should yield entry when value deref returns null', () => {
    // null !== undefined, so it should NOT be treated as GC'd
    const iter = new EntriesIterator(makeEntryIterator<string, any>([['k', null]]));
    expect([...iter]).toEqual([['k', null]]);
  });

  // ─── Symbol.iterator / re-iteration ────────────────────────────────────

  it('should be iterable via for..of', () => {
    const v = { x: 1 };
    const iter = new EntriesIterator(makeEntryIterator([['k', v]]));
    const entries: Array<[string, object]> = [];
    for (const e of iter) entries.push(e);
    expect(entries).toEqual([['k', v]]);
  });

  it('Symbol.iterator should return a fresh independent iterator', () => {
    const v = { x: 1 };
    const iter = new EntriesIterator(makeEntryIterator([['k', v]]));
    const iter2 = iter[Symbol.iterator]();
    expect(iter2).not.toBe(iter);
    expect([...iter2]).toEqual([['k', v]]);
  });

  it('should support numeric keys', () => {
    const v = { n: 1 };
    const iter = new EntriesIterator(makeEntryIterator([[42, v]]));
    expect([...iter]).toEqual([[42, v]]);
  });

  it('should support symbol keys', () => {
    const sym = Symbol('sym');
    const v = { s: true };
    const iter = new EntriesIterator(makeEntryIterator([[sym, v]]));
    expect([...iter]).toEqual([[sym, v]]);
  });
});
