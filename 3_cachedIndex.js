// Optimised runtime libarary
"use strict";
var Transition = (function () {
    function Transition(klass) {
        this.klass = klass;
    }
    return Transition;
}());
var Property = (function () {
    function Property(index) {
        this.index = index;
    }
    return Property;
}());
var Klass = (function () {
    function Klass() {
        this.descriptors = new Map();
        this.keysForProperties = [];
    }
    Klass.prototype.addProperty = function (key) {
        var klass = this.clone();
        klass.append(key);
        // Connect hidden classes with transition to enable sharing:
        //           this == add property key ==> klass
        this.descriptors.set(key, new Transition(klass));
        return klass;
    };
    Klass.prototype.hasProperty = function (key) {
        return this.descriptors.has(key);
    };
    Klass.prototype.getDescriptor = function (key) {
        return this.descriptors.get(key);
    };
    Klass.prototype.getIndex = function (key) {
        return this.getDescriptor(key).index;
    };
    // Create clone of this hidden class that has same properties
    // at same offsets (but does not have any transitions).
    Klass.prototype.clone = function () {
        var klass = new Klass();
        klass.keysForProperties = this.keysForProperties.slice(0);
        for (var i_1 = 0; i_1 < this.keysForProperties.length; i_1++) {
            var key = this.keysForProperties[i_1];
            klass.descriptors.set(key, this.descriptors.get(key));
        }
        return klass;
    };
    // Add real property to descriptors.
    Klass.prototype.append = function (key) {
        var index = this.keysForProperties.push(key) - 1;
        this.descriptors.set(key, new Property(index));
    };
    return Klass;
}());
var ROOT_KLASS = new Klass();
var Table = (function () {
    function Table() {
        this.klass = ROOT_KLASS;
        this.type = 0 /* FAST */;
        this.stringKeyValues = [];
        this.numberKeyValues = [];
        this.slow = undefined;
    }
    Object.defineProperty(Table.prototype, "isFast", {
        get: function () {
            return this.type === 0 /* FAST */;
        },
        enumerable: true,
        configurable: true
    });
    Table.prototype.fastStringKeyLoad = function (idx) {
        return this.stringKeyValues[idx];
    };
    Table.prototype.fastNumberKeyLoad = function (idx) {
        return this.numberKeyValues[idx];
    };
    Table.prototype.fastStringKeyStore = function (idx, v) {
        this.stringKeyValues[idx] = v;
    };
    Table.prototype.fastNumberKeyStore = function (idx, v) {
        this.numberKeyValues[idx] = v;
    };
    Table.prototype.load = function (key) {
        if (this.type === 1 /* SLOW */) {
            return this.slow.get(key);
        }
        if (typeof key === "number") {
            return this.numberKeyValues[key | 0];
        }
        else if (typeof key === "string") {
            var idx = this.findIndexForStringKeyLoad(key);
            return (idx >= 0) ? this.stringKeyValues[idx] : void 0;
        }
    };
    Table.prototype.store = function (key, value) {
        if (this.type === 1 /* SLOW */) {
            this.slow.set(key, value);
            return;
        }
        // This is fast table with indexed and named properties only.
        if (typeof key === "number") {
            this.numberKeyValues[key | 0] = value;
            return;
        }
        else if (typeof key === "string") {
            var index = this.getOrCreateIndexForStringKeyStore(key);
            if (index >= 0) {
                this.stringKeyValues[index] = value;
                return;
            }
            else {
                this.convertToSlow();
                this.store(key, value);
                return;
            }
        }
    };
    // Find property or add one if possible, returns property index
    // or -1 if we have too many properties and should switch to slow.
    Table.prototype.getOrCreateIndexForStringKeyStore = function (key) {
        if (this.klass.hasProperty(key)) {
            var desc = this.klass.getDescriptor(key);
            if (desc instanceof Transition) {
                // Property does not exist yet but we have a transition to the class that has it.
                this.klass = desc.klass;
                return this.klass.getIndex(key);
            }
            // Get index of existing property.
            return desc.index;
        }
        else {
            if (this.klass.keysForProperties.length > 20) {
                // Too many properties! Achtung! Fast case kaput.
                return -1;
            }
            // Switch class to the one that has this property.
            this.klass = this.klass.addProperty(key);
            return this.klass.getIndex(key);
        }
    };
    // Find property index if property exists, return -1 otherwise.
    Table.prototype.findIndexForStringKeyLoad = function (key) {
        if (!this.klass.hasProperty(key))
            return -1;
        var desc = this.klass.getDescriptor(key);
        if (!(desc instanceof Property))
            return -1; // Here we are not interested in transitions.
        return desc.index;
    };
    // Copy all properties into the Map and switch to slow class.
    Table.prototype.convertToSlow = function () {
        var map = new Map();
        for (var i_2 = 0; i_2 < this.klass.keysForProperties.length; i_2++) {
            var key = this.klass.keysForProperties[i_2];
            var val = this.stringKeyValues[i_2];
            map.set(key, val);
        }
        Object.keys(this.numberKeyValues).forEach(function (key) {
            var val = this.elements[key];
            map.set(key, val); // Funky JS, force string key back to int32.
        }, this);
        this.slow = map;
        this.type = 1 /* SLOW */;
        this.stringKeyValues = null;
        this.numberKeyValues = null;
        this.klass = null;
    };
    return Table;
}());
function LOAD(t, k) {
    return t.load(k);
}
function STORE(t, k, v) {
    t.store(k, v);
}
var os = new Table();
STORE(os, 'clock', function () {
    return Date.now();
});
// CACHING
var STORE_CACHE = {
    '$0': NAMED_STORE_MISS,
    '$1': NAMED_STORE_MISS,
    '$3': NAMED_STORE_MISS,
    '$5': NAMED_STORE_MISS,
    '$9': NAMED_STORE_MISS,
};
var LOAD_CACHE = {
    '$4': NAMED_LOAD_MISS,
    '$6': NAMED_LOAD_MISS,
    '$7': NAMED_LOAD_MISS,
    '$10': NAMED_LOAD_MISS,
    '$11': NAMED_LOAD_MISS,
    '$13': NAMED_LOAD_MISS,
    '$14': NAMED_LOAD_MISS,
};
var KEYED_STORE_CACHE = {
    '$2': KEYED_STORE_MISS,
};
var KEYED_LOAD_CACHE = {
    '$8': KEYED_LOAD_MISS,
    '$12': KEYED_LOAD_MISS,
};
function NAMED_LOAD_MISS(cacheId, table, key) {
    var v = LOAD(table, key);
    if (table.isFast) {
        // Create a load stub that is specialized for a fixed class and key k and
        // loads property from a fixed offset.
        var stub = CompileNamedLoadFastProperty(table.klass, key);
        LOAD_CACHE[cacheId] = stub;
    }
    return v;
}
function NAMED_STORE_MISS(cacheId, table, key, value) {
    var klass_before = table.klass;
    var fast_before = table.isFast;
    STORE(table, key, value);
    if (fast_before && table.isFast) {
        var klass_after = table.klass;
        // Create a store stub that is specialized for a fixed transition between classes
        // and a fixed key k that stores property into a fixed offset and replaces
        // object's hidden class if necessary.
        var stub = CompileNamedStoreFastProperty(klass_before, klass_after, key);
        STORE_CACHE[cacheId] = stub;
    }
}
function KEYED_LOAD_MISS(cacheId, table, key) {
    var v = LOAD(table, key);
    if (table.isFast && (typeof key === 'number')) {
        // Create a stub for the fast load from the elements array.
        // Does not actually depend on the class but could if we had more complicated
        // storage system.
        KEYED_LOAD_CACHE[cacheId] = CompileKeyedLoadFastElement;
    }
    return v;
}
function KEYED_STORE_MISS(cacheId, table, key, value) {
    STORE(table, key, value);
    if (table.isFast && (typeof key === 'number')) {
        // Create a stub for the fast store into the elements array.
        // Does not actually depend on the class but could if we had more complicated
        // storage system.
        KEYED_STORE_CACHE[cacheId] = CompileKeyedStoreFastElement;
    }
}
function CompileNamedLoadFastProperty(klass, key) {
    // Key is known to be constant (named load). Specialize index.
    var index = klass.getIndex(key);
    function KeyedLoadFastProperty(cacheId, table, key) {
        if (table.klass !== klass) {
            // Expected klass does not match. Can't use cached index.
            // Fall through to the runtime system.
            return NAMED_LOAD_MISS(cacheId, table, key);
        }
        return table.fastStringKeyLoad(index); // Veni. Vidi. Vici.
    }
    return KeyedLoadFastProperty;
}
function CompileNamedStoreFastProperty(klass_before, klass_after, key) {
    // Key is known to be constant (named load). Specialize index.
    var index = klass_after.getIndex(key);
    if (klass_before !== klass_after) {
        // Transition happens during the store.
        // Compile stub that updates hidden class.
        return function (cacheId, t, k, v) {
            if (t.klass !== klass_before) {
                // Expected klass does not match. Can't use cached index.
                // Fall through to the runtime system.
                return NAMED_STORE_MISS(cacheId, t, k, v);
            }
            t.fastStringKeyStore(index, v); // Fast store.
            t.klass = klass_after; // T-t-t-transition!
        };
    }
    else {
        // Write to an existing property. No transition.
        return function (cacheId, t, k, v) {
            if (t.klass !== klass_before) {
                // Expected klass does not match. Can't use cached index.
                // Fall through to the runtime system.
                return NAMED_STORE_MISS(cacheId, t, k, v);
            }
            t.fastStringKeyStore(index, v);
        };
    }
}
function CompileKeyedLoadFastElement(ic, t, k) {
    if (!t.isFast || !(typeof k === 'number' && (k | 0) === k)) {
        // If table is slow or key is not a number we can't use fast-path.
        // Fall through to the runtime system, it can handle everything.
        return KEYED_LOAD_MISS(ic, t, k);
    }
    return t.fastNumberKeyLoad(k);
}
function CompileKeyedStoreFastElement(ic, t, k, v) {
    if (!t.isFast || !(typeof k === 'number' && (k | 0) === k)) {
        // If table is slow or key is not a number we can't use fast-path.
        // Fall through to the runtime system, it can handle everything.
        return KEYED_STORE_MISS(ic, t, k, v);
    }
    t.fastNumberKeyStore(k, v);
}
// Program
function MakePoint(x, y) {
    var point = new Table();
    STORE_CACHE.$0('$0', point, 'x', x);
    STORE_CACHE.$1('$1', point, 'y', y);
    return point;
}
function MakeArrayOfPoints(N) {
    var array = new Table();
    var m = -1;
    for (var i = 0; i <= N; i++) {
        m = m * -1;
        KEYED_STORE_CACHE.$2('$2', array, i, MakePoint(m * i, m * -i));
    }
    STORE_CACHE.$3('$3', array, 'n', N);
    return array;
}
function SumArrayOfPoints(array) {
    var sum = MakePoint(0, 0);
    for (var i = 0; i <= LOAD_CACHE.$4('$4', array, 'n'); i++) {
        STORE_CACHE.$5('$5', sum, 'x', LOAD_CACHE.$6('$6', sum, 'x') + LOAD_CACHE.$7('$7', KEYED_LOAD_CACHE.$8('$8', array, i), 'x'));
        STORE_CACHE.$9('$9', sum, 'y', LOAD_CACHE.$10('$10', sum, 'y') + LOAD_CACHE.$11('$11', KEYED_LOAD_CACHE.$12('$12', array, i), 'y'));
    }
    return sum;
}
function CheckResult(sum) {
    var x = LOAD_CACHE.$13('$13', sum, 'x');
    var y = LOAD_CACHE.$14('$14', sum, 'y');
    if (x !== 50000 || y !== -50000) {
        throw new Error("failed: x = " + x + ", y = " + y);
    }
}
var N = 100000;
var array = MakeArrayOfPoints(N);
var start = LOAD(os, 'clock')();
for (var i = 0; i <= 5; i++) {
    var sum = SumArrayOfPoints(array);
    CheckResult(sum);
}
var end = LOAD(os, 'clock')();
console.log(end - start);
module.exports = void 0;
