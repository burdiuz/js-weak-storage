# Weak Storage
 Map implementation for key-value pairs with weak referenced values. It is based on [WeakRef](https://github.com/tc39/proposal-weakrefs) spec and you can try it in [Chrome Canary](https://www.google.com/chrome/canary/).

```javascript
let key = {type: 'key1'};
let value = {type: 'value1'};
const storage = new WeakStorage();
storage.set(key, value);
storage.get(key); // {type: "value1"}
storage.getKey(value); // {type: "key1"}
storage.forEach(console.log) // {type: "value1"} {type: "key1"} WeakStorage{}

const keys = storage.keys();
keys.next(); // { done: false, value: {type: "key1"} }
keys.next(); // {done: true, value: undefined}
keys[Symbol.iterator]().next(); // { done: false, value: {type: "key1"} }

const values = storage.values();
values.next(); // { done: false, value: {type: "value1"} }
values.next(); // {done: true, value: undefined}

const entries = storage.entries();
entries.next(); // { done: false, value: [ {type: "key1"}, {type: "value1"} ] }
entries.next(); // {done: true, value: undefined}
```
