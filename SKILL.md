---
name: weak-storage
description: >
  A Map-like collection with weakly-referenced values built on WeakRef and
  FinalizationRegistry. Two classes: WeakValueMap<K, V> for key→value lookup
  with any key type, and WeakStorage<K, V> which adds a WeakMap-backed reverse
  index for O(1) value→key lookup. Use when building caches that should not
  prevent garbage collection, tracking object associations, or attaching
  metadata to objects without extending their lifetime. Values must be objects
  (WeakRef requirement — primitives throw at runtime). Iteration and get()
  silently skip collected entries. approximateSize may lag GC; call verify()
  for an accurate count or use has() which always checks liveness.
license: MIT
compatibility: >
  Requires WeakRef and FinalizationRegistry (Node.js 14.6+, Chrome 84+,
  Firefox 79+, Safari 14.1+). Package name: @actualwave/weak-storage.
  TypeScript 4.0+ supported; strict mode compatible.
metadata:
  author: Oleg Galaburda
  package: "@actualwave/weak-storage"
  version: "0.1.1"
  repository: https://github.com/burdiuz/js-weak-storage
---

# weak-storage

## When to use this skill

Use this skill when working with `@actualwave/weak-storage` — specifically when:

- Implementing or debugging a `WeakValueMap` or `WeakStorage` instance.
- Choosing between `WeakValueMap` and `WeakStorage`.
- Handling `get()` / `has()` / `approximateSize` discrepancies caused by GC timing.
- Writing tests for code that depends on these classes.
- Configuring TypeScript generics for the library's types.

Do **not** use this skill for standard `Map` or `WeakMap` operations unrelated to this package.

## Choosing the right class

| Need | Use |
|---|---|
| Cache with any key type, forward lookup only | `WeakValueMap` |
| Bidirectional lookup (key→value **and** value→key) | `WeakStorage` |

`WeakStorage` extends `WeakValueMap` — everything below applies to both.

## Core API

### Import

```ts
import { WeakValueMap, WeakStorage } from '@actualwave/weak-storage';

// Type-only imports for custom implementations / testing
import type {
  IWeakRef, IWeakRefConstructor,
  IFinalizationRegistry, IFinalizationRegistryConstructor,
} from '@actualwave/weak-storage';
```

### Constructor

```ts
new WeakValueMap(autoCleanup?: boolean)  // default: true
new WeakStorage(autoCleanup?: boolean)   // default: true
```

`autoCleanup: true` (default) registers a `FinalizationRegistry` that removes map entries automatically when their values are collected. Set to `false` to manage cleanup manually via `verify()`.

### Method signatures

```ts
// Both classes
set(key: K, value: V): this           // returns this — chainable
get(key: K): V | undefined            // undefined if missing or collected
has(key: K): boolean                  // true only if value is alive
delete(key: K): boolean               // true if key existed
clear(): void
forEach(cb: (value: V, key: K, map: this) => void): void  // skips dead entries
keys(): IterableIterator<K>           // live keys only
values(): IterableIterator<V>         // live values only
entries(): IterableIterator<[K, V]>   // live [key, value] pairs only
verify(): void                        // prune dead entries, accurate approximateSize after
readonly approximateSize: number      // may include stale entries, see below

// WeakStorage only
getKey(value: V): K | undefined       // reverse lookup; undefined if not stored or deleted
```

## Key behaviors and gotchas

### `approximateSize` lags behind GC

`approximateSize` is the raw internal `Map` size. After a value is collected, its entry is only removed when the `FinalizationRegistry` callback fires — which is asynchronous. In the window between collection and cleanup:

```
map.approximateSize  →  1     // stale entry still present
map.has(key)         →  false // deref() returned undefined
map.get(key)         →  undefined
```

**Rule:** use `has()` or `get()` to check liveness. Call `verify()` before reading `approximateSize` if an exact count is needed.

### Iteration always reflects live state

`keys()`, `values()`, `entries()`, and `forEach()` all call `deref()` on each entry and skip collected values. Spreading them is safe:

```ts
const liveKeys = [...map.keys()]; // no dead entries
```

### Key-reuse race condition is handled

If a key is reassigned before its old finalizer fires, the cleanup callback checks liveness before deleting — a fresh live entry is never evicted:

```ts
map.set('k', oldObj);
// oldObj collected, finalizer queued but not yet fired
map.set('k', newObj);        // key reused with live value
// finalizer fires → newObj.deref() !== undefined → entry kept
map.get('k');                // newObj ✓
```

### `WeakStorage` reverse index is a `WeakMap`

The reverse index holding value→key associations is itself weak. Once the value object is collected, `getKey(value)` returns `undefined` automatically — no explicit cleanup needed for that direction.

### Primitives as values are not supported

`WeakRef` only wraps objects. Passing a primitive throws a `TypeError` at runtime. The TypeScript constraint `V extends object` catches this at compile time when generics are explicit.

## Common patterns

### Evictable cache

```ts
const cache = new WeakValueMap<string, ComputedResult>();

function getOrCompute(id: string): ComputedResult {
  let result = cache.get(id);
  if (!result) {
    result = expensiveComputation(id);
    cache.set(id, result);
  }
  return result;
}
```

### Bidirectional object association

```ts
const store = new WeakStorage<string, Request>();

store.set('req-1', requestObj);
store.get('req-1');        // requestObj
store.getKey(requestObj);  // 'req-1'

// Both directions are cleaned up on delete:
store.delete('req-1');
store.getKey(requestObj);  // undefined
```

### Manual cleanup with verify()

```ts
const map = new WeakValueMap(false); // no auto-cleanup

// Prune on demand (e.g., before a size-gated operation):
map.verify();
console.log('Live entries:', map.approximateSize); // accurate after verify()
```

### Chained set

```ts
const store = new WeakStorage<string, object>()
  .set('a', objA)
  .set('b', objB)
  .set('c', objC);
```

## TypeScript

`V` is constrained to `extends object`. Specify generics explicitly to get full type safety:

```ts
const map = new WeakValueMap<string, MyClass>();

const val = map.get('key'); // MyClass | undefined
if (val !== undefined) {
  val.myMethod(); // narrowed to MyClass
}

const store = new WeakStorage<number, ResponseObject>();
store.getKey(responseObj); // number | undefined
```

## Testing code that uses this library

GC timing is non-deterministic — do not use real `WeakRef` in unit tests. Replace the globals before each test:

```ts
beforeEach(() => {
  const liveRefs = new Map<object, object>();

  (global as any).WeakRef = class<T extends object> {
    #target: T;
    constructor(value: T) { liveRefs.set(value, value); this.#target = value; }
    deref(): T | undefined { return liveRefs.has(this.#target) ? this.#target : undefined; }
  };

  (global as any).FinalizationRegistry = class {
    #cb: (key: unknown) => void;
    constructor(cb: (key: unknown) => void) { this.#cb = cb; }
    register() {}  // no-op — trigger manually in tests
  };

  // Expose helpers on test context as needed:
  // simulateGC = (obj) => liveRefs.delete(obj);
});

afterEach(() => {
  delete (global as any).WeakRef;
  delete (global as any).FinalizationRegistry;
});
```

## Mistakes to avoid

```ts
// ❌ approximateSize is not a reliable liveness check
if (map.approximateSize === 0) return; // may have dead entries counted

// ✅ use has() or iterate
if (!map.has(key)) return;
for (const val of map.values()) { /* only live */ }
```

```ts
// ❌ getKey requires the exact same object reference
store.set('k', { id: 1 });
store.getKey({ id: 1 }); // undefined — different instance

// ✅ keep a reference
const obj = { id: 1 };
store.set('k', obj);
store.getKey(obj); // 'k'
```

```ts
// ❌ primitives as values
new WeakValueMap<string, string>(); // TS error: string not assignable to object

// ✅ values must be objects
new WeakValueMap<string, { label: string }>();
```
