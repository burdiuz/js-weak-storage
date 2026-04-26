import { ValuesIterator } from './ValuesIterator';
import { FakeWeakRef } from './test-helpers';

function makeRefIterator<V>(
  entries: Array<V | undefined>
): IterableIterator<FakeWeakRef<V>> {
  const refs = entries.map((v) => {
    const ref = new FakeWeakRef<V>(v as V);
    if (v === undefined) ref.simulateGC();
    return ref;
  });
  return refs[Symbol.iterator]() as unknown as IterableIterator<FakeWeakRef<V>>;
}

describe('ValuesIterator', () => {
  // ─── basic iteration ────────────────────────────────────────────────────

  it('should yield all values for fully-live refs', () => {
    const v1 = { a: 1 };
    const v2 = { b: 2 };
    const v3 = { c: 3 };
    const iter = new ValuesIterator(makeRefIterator([v1, v2, v3]));
    expect([...iter]).toEqual([v1, v2, v3]);
  });

  it('should return done=true immediately for an empty source', () => {
    const iter = new ValuesIterator(makeRefIterator([]));
    expect(iter.next().done).toBe(true);
  });

  it('should work with a single live entry', () => {
    const value = { only: true };
    const iter = new ValuesIterator(makeRefIterator([value]));
    expect(iter.next()).toEqual({ done: false, value });
    expect(iter.next().done).toBe(true);
  });

  // ─── GC simulation ─────────────────────────────────────────────────────

  it('should skip GC-collected (undefined deref) entries', () => {
    const alive = { keep: true };
    const iter = new ValuesIterator(
      makeRefIterator<object>([alive, undefined, undefined])
    );
    const values = [...iter];
    expect(values).toEqual([alive]);
  });

  it('should yield nothing when all refs are collected', () => {
    const iter = new ValuesIterator(
      makeRefIterator<object>([undefined, undefined])
    );
    expect([...iter]).toHaveLength(0);
  });

  it('should skip dead entries interspersed between live ones', () => {
    const v1 = { first: true };
    const v2 = { second: true };
    const iter = new ValuesIterator(
      makeRefIterator<object>([v1, undefined, v2])
    );
    expect([...iter]).toEqual([v1, v2]);
  });

  it('should skip leading dead entries', () => {
    const alive = { alive: true };
    const iter = new ValuesIterator(
      makeRefIterator<object>([undefined, undefined, alive])
    );
    expect([...iter]).toEqual([alive]);
  });

  it('should skip trailing dead entries', () => {
    const alive = { alive: true };
    const iter = new ValuesIterator(
      makeRefIterator<object>([alive, undefined])
    );
    expect([...iter]).toEqual([alive]);
  });

  // ─── BUG REGRESSION: `!value` skipped falsy values ─────────────────────

  it('[regression] should yield 0 (falsy) without skipping it', () => {
    // Original: `while (!done && !value)` would loop past 0.
    // Fix:      `while (!done && value === undefined)`.
    const iter = new ValuesIterator(makeRefIterator<any>([0]));
    const values = [...iter];
    expect(values).toEqual([0]);
  });

  it('[regression] should yield false (falsy) without skipping it', () => {
    const iter = new ValuesIterator(makeRefIterator<any>([false]));
    expect([...iter]).toEqual([false]);
  });

  it('[regression] should yield empty string (falsy) without skipping it', () => {
    const iter = new ValuesIterator(makeRefIterator<any>(['']));
    expect([...iter]).toEqual(['']);
  });

  it('[regression] should yield null (falsy) without skipping it', () => {
    // null is falsy but !== undefined so should NOT be treated as GC'd
    const iter = new ValuesIterator(makeRefIterator<any>([null]));
    expect([...iter]).toEqual([null]);
  });

  // ─── Symbol.iterator / re-iteration ────────────────────────────────────

  it('should be iterable via for..of', () => {
    const v1 = { x: 1 };
    const v2 = { y: 2 };
    const iter = new ValuesIterator(makeRefIterator([v1, v2]));
    const collected: object[] = [];
    for (const v of iter) collected.push(v);
    expect(collected).toEqual([v1, v2]);
  });

  it('Symbol.iterator should return a fresh independent iterator over the same refs', () => {
    const v1 = { x: 1 };
    const iter = new ValuesIterator(makeRefIterator([v1]));
    const iter2 = iter[Symbol.iterator]();
    expect(iter2).not.toBe(iter);
    expect([...iter2]).toEqual([v1]);
  });
});
