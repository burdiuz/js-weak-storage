(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.WeakStorage = {}));
})(this, (function (exports) { 'use strict';

    class KeysIterator {
        constructor(map) {
            this.map = map;
            this.mapIterator = this.map.keys();
        }
        [Symbol.iterator]() {
            return new KeysIterator(this.map);
        }
        next() {
            let key;
            let value;
            let done;
            do {
                ({ done, value: key } = this.mapIterator.next());
                if (!done) {
                    value = this.map.get(key).deref();
                }
            } while (!done && !value);
            return {
                done,
                value: key,
            };
        }
    }

    class ValuesIterator {
        constructor(mapIterator) {
            this.mapIterator = mapIterator;
        }
        [Symbol.iterator]() {
            return new ValuesIterator(this.mapIterator[Symbol.iterator]());
        }
        next() {
            let ref;
            let value;
            let done;
            do {
                ({ done, value: ref } = this.mapIterator.next());
                if (done) {
                    value = undefined;
                }
                else {
                    value = ref.deref();
                }
            } while (!done && !value);
            return {
                done,
                value,
            };
        }
    }

    class EntriesIterator {
        constructor(mapIterator) {
            this.mapIterator = mapIterator;
        }
        [Symbol.iterator]() {
            return new EntriesIterator(this.mapIterator[Symbol.iterator]());
        }
        next() {
            let entries;
            let value;
            let done;
            do {
                ({ done, value: entries } = this.mapIterator.next());
                if (done) {
                    entries = undefined;
                }
                else {
                    value = entries[1].deref();
                    entries = [entries[0], value];
                }
            } while (!done && !value);
            return {
                done,
                entries,
            };
        }
    }

    class WeakValueMap {
        constructor(autoVerify = true) {
            this.map = new Map();
            if (autoVerify) {
                this.finalizer = new FinalizationRegistry((key) => {
                    const ref = this.map.get(key);
                    if (!ref || !ref.deref()) {
                        this.map.delete(key);
                    }
                });
            }
        }
        get size() {
            return this.map.size;
        }
        keys() {
            return new KeysIterator(this.map);
        }
        values() {
            return new ValuesIterator(this.map.values());
        }
        entries() {
            return new EntriesIterator(this.map.entries());
        }
        set(key, value) {
            this.map.set(key, new WeakRef(value));
        }
        get(key) {
            const ref = this.map.get(key);
            return ref && ref.deref();
        }
        has(key) {
            return !!this.get(key);
        }
        delete(key) {
            return this.map.delete(key);
        }
        clear() {
            this.map.clear();
        }
        forEach(callback) {
            this.map.forEach((ref, key) => {
                const value = ref.deref();
                if (value) {
                    callback(value, key, this);
                }
            });
        }
        verify() {
            const map = new Map();
            this.map.forEach((ref, key) => {
                const value = ref.deref();
                if (value) {
                    map.set(key, ref);
                }
            });
            this.map.clear();
            this.map = map;
        }
    }

    class WeakStorage extends WeakValueMap {
        constructor(autoVerify) {
            super(autoVerify);
            this.byValues = new WeakMap();
        }
        set(key, value) {
            super.set(key, value);
            this.byValues.set(key, value);
        }
        getKey(value) {
            return this.byValues.get(value);
        }
        delete(key) {
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

    exports.WeakStorage = WeakStorage;
    exports.WeakValueMap = WeakValueMap;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
