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
        this.__numberOfProperties = 0;
    }
    Object.defineProperty(Klass.prototype, "numberOfProperties", {
        get: function () {
            return this.__numberOfProperties;
        },
        enumerable: true,
        configurable: true
    });
    Klass.prototype.addProperty = function (key) {
        var klass = this.cloneProperties();
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
    Klass.prototype.getProperties = function () {
        var arr = [];
        this.descriptors.forEach(function (value, key) {
            if (value instanceof Property) {
                arr[value.index] = key;
            }
        });
        return arr;
    };
    // Create clone of this hidden class that has same properties
    // at same offsets (but does not have any transitions).
    Klass.prototype.cloneProperties = function () {
        var klass = new Klass();
        klass.__numberOfProperties = this.__numberOfProperties;
        this.descriptors.forEach(function (value, key) {
            if (value instanceof Property) {
                klass.descriptors.set(key, value);
            }
        });
        return klass;
    };
    // Add real property to descriptors.
    Klass.prototype.append = function (key) {
        var index = this.__numberOfProperties++;
        this.descriptors.set(key, new Property(index));
    };
    return Klass;
}());
var ROOT_KLASS = new Klass();
var Table = (function () {
    function Table() {
        this.type = 0 /* FAST */;
        this.klass = ROOT_KLASS;
        this.stringKeyValues = [];
        this.numberKeyValues = [];
        this.slow = undefined;
    }
    Table.prototype.load = function (key) {
        if (this.type === 1 /* SLOW */) {
            return this.slow.get(key);
        }
        if (typeof key === "number") {
            return this.numberKeyValues[key | 0];
        }
        else {
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
        else {
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
            // Too many properties! Achtung! Fast case kaput.
            if (this.klass.numberOfProperties > 20)
                return -1;
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
        var props = this.klass.getProperties();
        for (var i_1 = 0; i_1 < props.length; i_1++) {
            var key = props[i_1];
            var val = this.stringKeyValues[i_1];
            map.set(key, val);
        }
        Object.keys(this.numberKeyValues).forEach(function (key) {
            var val = this.numberKeyValues[key];
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
// Program
function MakePoint(x, y) {
    var point = new Table();
    STORE(point, 'x', x);
    STORE(point, 'y', y);
    return point;
}
function MakeArrayOfPoints(N) {
    var array = new Table();
    var m = -1;
    for (var i = 0; i <= N; i++) {
        m = m * -1;
        STORE(array, i, MakePoint(m * i, m * -i));
    }
    STORE(array, 'n', N);
    return array;
}
function SumArrayOfPoints(array) {
    var sum = MakePoint(0, 0);
    for (var i = 0; i <= LOAD(array, 'n'); i++) {
        STORE(sum, 'x', LOAD(sum, 'x') + LOAD(LOAD(array, i), 'x'));
        STORE(sum, 'y', LOAD(sum, 'y') + LOAD(LOAD(array, i), 'y'));
    }
    return sum;
}
function CheckResult(sum) {
    var x = LOAD(sum, 'x');
    var y = LOAD(sum, 'y');
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
