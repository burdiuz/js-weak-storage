# @actualwave/weak-storage

A `Map`-like collection that holds its **values as weak references**, letting the garbage collector reclaim them when nothing else holds a reference. Built on the [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef) and [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry) APIs.

Two classes are provided:

| Class | Description |
|---|---|
| `WeakValueMap<K, V>` | Map with weak values. Any key type; iteration skips collected entries. |
| `WeakStorage<K, V>` | Extends `WeakValueMap` with a reverse index — look up the key given a value. |

## Requirements

| Environment | Minimum version |
|---|---|
| Node.js | 14.6+ |
| Chrome / Edge | 84+ |
| Firefox | 79+ |
| Safari | 14.1+ |

Both `WeakRef` and `FinalizationRegistry` must be available. Check [MDN compatibility](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef#browser_compatibility) for the latest data.

## Installation

```sh
npm install @actualwave/weak-storage
```

## Quick Start

```js
import { WeakStorage } from '@actualwave/weak-storage';

const store = new WeakStorage();

const user = { id: 1, name: 'Alice' };
store.set('user:1', user);

store.get('user:1');    // { id: 1, name: 'Alice' }
store.getKey(user);     // 'user:1'
store.has('user:1');    // true

// After the variable goes out of scope and GC runs,
// get() returns undefined and iteration skips the entry.
```

---

## `WeakValueMap<K, V>`

A drop-in replacement for `Map` where **values** are weakly referenced. Keys can be anything — strings, numbers, symbols, or objects.

### Constructor

```ts
new WeakValueMap(FinalizationRegistryClass?: IFinalizationRegistryConstructor | null)
```

| Option | Default | Description |
|---|---|---|
| `FinalizationRegistryClass` | `globalThis.FinalizationRegistry` | Constructor used to create the internal `FinalizationRegistry` that removes stale entries when a value is collected. Pass `null` to disable auto-cleanup and manage it manually via `verify()`. If the global `FinalizationRegistry` is not available (e.g. Hermes / React Native), a console warning is emitted and auto-cleanup is skipped. |

```js
import { WeakValueMap } from '@actualwave/weak-storage';

// With auto-cleanup (default) — uses globalThis.FinalizationRegistry
const map = new WeakValueMap();

// Without auto-cleanup — use verify() to prune manually
const manual = new WeakValueMap(null);

// Custom FinalizationRegistry implementation
const custom = new WeakValueMap(MyFinalizationRegistry);
```

### `set(key, value): this`

Stores a value under `key` as a weak reference. Returns `this` for chaining.

```js
map.set('a', { x: 1 })
   .set('b', { x: 2 })
   .set('c', { x: 3 });
```

### `get(key): V | undefined`

Returns the value, or `undefined` if the key is missing or the value was collected.

```js
const value = map.get('a'); // { x: 1 } or undefined
```

### `has(key): boolean`

Returns `true` only if the key exists **and** its value is still alive.

```js
map.has('a'); // true
map.has('missing'); // false
```

### `delete(key): boolean`

Removes the entry. Returns `true` if the key existed.

```js
map.delete('a'); // true
map.delete('a'); // false — already gone
```

### `clear(): void`

Removes all entries.

```js
map.clear();
map.approximateSize; // 0
```

### `forEach(callback): void`

Iterates over **live entries only** — collected values are silently skipped.

```js
map.forEach((value, key, map) => {
  console.log(key, value);
});
```

### `keys()`, `values()`, `entries()`

Return `IterableIterator` instances that skip any entries whose values have been collected.

```js
for (const key of map.keys()) { /* ... */ }
for (const value of map.values()) { /* ... */ }
for (const [key, value] of map.entries()) { /* ... */ }

// Spread also works
const liveKeys = [...map.keys()];
```

### `approximateSize: number`

Returns the number of internal map entries. This **may include stale entries** that have been collected but whose `FinalizationRegistry` callback has not yet fired.

```js
map.set('x', { n: 1 });
// After GC but before the finalizer runs:
map.approximateSize; // still 1
map.has('x');        // false — correctly reports the value is gone
```

If you need an accurate count, call `verify()` first:

```js
map.verify();
map.approximateSize; // reflects only live entries
```

### `verify(): void`

Rebuilds the internal map, discarding any entries whose values have been collected. Useful when:
- Auto-cleanup is disabled (`null` passed to the constructor) and you want to reclaim memory explicitly.
- You need `approximateSize` to reflect the true live count.

```js
const map = new WeakValueMap(null); // no auto-cleanup

// ... time passes, some values get collected ...

map.verify();                 // prune dead entries
console.log(map.approximateSize); // accurate live count
```

---

## `WeakStorage<K, V>`

Extends `WeakValueMap` with a **reverse index** backed by a `WeakMap`, giving O(1) key lookup from a value. Values must be objects (required by `WeakMap`).

Inherits all `WeakValueMap` methods. Additionally:

### `getKey(value): K | undefined`

Returns the key associated with a value, or `undefined` if the value was never stored or the entry was deleted.

```js
import { WeakStorage } from '@actualwave/weak-storage';

const store = new WeakStorage();

const request = { url: '/api/users' };
store.set('req-1', request);

store.getKey(request); // 'req-1'
```

`delete()` and `clear()` both clean up the reverse index:

```js
store.delete('req-1');
store.getKey(request); // undefined

store.clear();
store.getKey(request); // undefined
```

---

## TypeScript

Both classes are fully generic. The value type `V` is constrained to `object` because `WeakRef` cannot hold primitives.

```ts
import { WeakValueMap, WeakStorage } from '@actualwave/weak-storage';

interface Session {
  userId: string;
  token: string;
}

// Explicit generics
const sessions = new WeakValueMap<string, Session>();
sessions.set('sess-abc', { userId: '1', token: 'xyz' });

const session = sessions.get('sess-abc'); // Session | undefined

// WeakStorage with bidirectional lookup
const store = new WeakStorage<string, Session>();
store.set('sess-abc', { userId: '1', token: 'xyz' });

store.getKey({ userId: '1', token: 'xyz' }); // string | undefined
```

The exported interfaces let you substitute custom `WeakRef` / `FinalizationRegistry` implementations — useful for testing or non-standard environments:

```ts
import type {
  IWeakRef,
  IWeakRefConstructor,
  IFinalizationRegistry,
  IFinalizationRegistryConstructor,
} from '@actualwave/weak-storage';
```

---

## How weak references work

A `WeakRef` wraps an object without keeping it alive. When the JavaScript engine determines that no strong references remain, it may collect the object. Calling `ref.deref()` afterwards returns `undefined`.

```
set('k', obj)
  └─ map.set('k', new WeakRef(obj))
  └─ finalizer.register(obj, 'k')

get('k')
  └─ map.get('k').deref()   → obj if alive, undefined if collected

[GC runs, obj is collected]
  └─ FinalizationRegistry fires → map.delete('k')  (when FinalizationRegistryClass is set)
```

### Key reuse guard

If a key is reused before the finalizer fires for the old value, the cleanup callback checks that the current ref is also dead before deleting. A live replacement value is never evicted:

```js
map.set('k', oldValue);
// oldValue gets collected, but before the finalizer fires:
map.set('k', freshValue);
// finalizer fires for 'k' — but freshValue is alive, so the entry is kept
map.get('k'); // freshValue ✓
```

---

## Caveats

- **GC timing is non-deterministic.** A collected value may not disappear from `get()` immediately after all strong references are dropped — the engine decides when to collect. Never rely on finalizers for correctness-critical logic.
- **`approximateSize` can lag.** It reflects the raw internal map size, which can include stale entries between GC and finalizer execution. Use `verify()` + `approximateSize` when an exact count matters.
- **`WeakStorage.getKey()` does not survive GC.** The reverse index is a `WeakMap`, so when the value is collected, its reverse entry is also automatically removed.
- **Primitives as values are not supported.** `WeakRef` can only wrap objects. Passing a primitive to `set()` will throw at runtime.
