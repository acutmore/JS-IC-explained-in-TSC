// Optimised runtime libarary

type Key = string | number;
type Value = any;

const enum KlassKind {
  FAST, SLOW
}

class Transition {
  constructor(public readonly klass: Klass) { }
}

class Property {
  constructor(public readonly index: number) { }
}

class Klass {
  private descriptors = new Map<Key, Transition | Property>();
  private __numberOfProperties = 0;

  get numberOfProperties() {
    return this.__numberOfProperties;
  }

  addProperty(key: Key): Klass {
    const klass = this.cloneProperties();
    klass.append(key);
    // Connect hidden classes with transition to enable sharing:
    //           this == add property key ==> klass
    this.descriptors.set(key, new Transition(klass));
    return klass;
  }

  hasProperty(key: Key): boolean {
    return this.descriptors.has(key);
  }

  getDescriptor(key: Key): Transition | Property {
    return this.descriptors.get(key);
  }

  getIndex(key: Key): number {
    return (this.getDescriptor(key) as Property).index;
  }

  getProperties(): Key[] {
    const arr: Key[] = [];
    this.descriptors.forEach((value, key) => {
      if (value instanceof Property) {
        arr[value.index] = key;
      }
    });
    return arr;
  }

  // Create clone of this hidden class that has same properties
  // at same offsets (but does not have any transitions).
  private cloneProperties(): Klass {
    const klass = new Klass();
    klass.__numberOfProperties = this.__numberOfProperties;
    this.descriptors.forEach((value, key) => {
      if (value instanceof Property) {
        klass.descriptors.set(key, value);
      }
    });
    return klass;
  }

  // Add real property to descriptors.
  private append(key: Key): void {
    const index = this.__numberOfProperties++;
    this.descriptors.set(key, new Property(index));
  }
}

const ROOT_KLASS = new Klass();

class Table {
  public  klass = ROOT_KLASS;
  private type: KlassKind = KlassKind.FAST;
  private stringKeyValues: Value[] = [];
  private numberKeyValues: Value[] = [];
  private slow: Map<Key, Value> = undefined;

  get isFast() {
    return this.type === KlassKind.FAST;
  }

  fastStringKeyLoad(idx: number): Value {
    return this.stringKeyValues[idx];
  }

  fastNumberKeyLoad(idx: number): Value {
    return this.numberKeyValues[idx];
  }

  fastStringKeyStore(idx: number, v: Value): void {
    this.stringKeyValues[idx] = v;
  }

  fastNumberKeyStore(idx: number, v: Value): void {
    this.numberKeyValues[idx] = v;
  }

  load(key: Key): Value {
    if (this.type === KlassKind.SLOW) {
      return this.slow.get(key);
    }

    if (typeof key === "number") { // Indexed property.
      return this.numberKeyValues[key | 0];
    } else if (typeof key === "string") {  // Named property.
      const idx = this.findIndexForStringKeyLoad(key);
      return (idx >= 0) ? this.stringKeyValues[idx] : void 0;
    }
  }

  store(key: Key, value: Value): void {
    if (this.type === KlassKind.SLOW) {
      this.slow.set(key, value);
      return;
    }

    // This is fast table with indexed and named properties only.
    if (typeof key === "number") {  // Indexed property.
      this.numberKeyValues[key | 0] = value;
      return;
    } else if (typeof key === "string") {  // Named property.
      const index = this.getOrCreateIndexForStringKeyStore(key);
      if (index >= 0) {
        this.stringKeyValues[index] = value;
        return;
      } else {
        this.convertToSlow();
        this.store(key, value);
        return;
      }
    }
  }

  // Find property or add one if possible, returns property index
  // or -1 if we have too many properties and should switch to slow.
  private getOrCreateIndexForStringKeyStore(key: Key): number {
    if (this.klass.hasProperty(key)) { 
      const desc = this.klass.getDescriptor(key);
      if (desc instanceof Transition) {
        // Property does not exist yet but we have a transition to the class that has it.
        this.klass = desc.klass;
        return this.klass.getIndex(key);
      }
      // Get index of existing property.
      return desc.index;
    } else {
      if (this.klass.numberOfProperties > 20) {
        // Too many properties! Achtung! Fast case kaput.
        return -1;
      }
      // Switch class to the one that has this property.
      this.klass = this.klass.addProperty(key);
      return this.klass.getIndex(key);
    }
  }

  // Find property index if property exists, return -1 otherwise.
  private findIndexForStringKeyLoad(key: Key): number {
    if (!this.klass.hasProperty(key)) return -1;
    const desc = this.klass.getDescriptor(key);
    if (!(desc instanceof Property)) return -1;  // Here we are not interested in transitions.
    return desc.index;
  }

  // Copy all properties into the Map and switch to slow class.
  private convertToSlow(): void {
    const map = new Map<Key, Value>();
    const props = this.klass.getProperties();
    for (let i = 0; i < props.length; i++) {
      const key = props[i];
      const val = this.stringKeyValues[i];
      map.set(key, val);
    }

    Object.keys(this.numberKeyValues).forEach(function (key) {
      const val = this.numberKeyValues[key];
      map.set(key as any | 0, val);  // Funky JS, force string key back to int32.
    }, this);

    this.slow = map;
    this.type = KlassKind.SLOW;
    this.stringKeyValues = null;
    this.numberKeyValues = null;
    this.klass = null;
  }
}

function LOAD(t: Table, k: string | number) {
  return t.load(k);
}

function STORE(t: Table, k: string | number, v: any) {
  t.store(k, v);
}

var os = new Table();

STORE(os, 'clock', function () {
  return Date.now();
});

// CACHING

const STORE_CACHE = {
  '$0': NAMED_STORE_MISS,
  '$1': NAMED_STORE_MISS,
  '$3': NAMED_STORE_MISS,
  '$5': NAMED_STORE_MISS,
  '$9': NAMED_STORE_MISS,
};
type STORE_ID = keyof typeof STORE_CACHE;

const LOAD_CACHE = {
  '$4': NAMED_LOAD_MISS,
  '$6': NAMED_LOAD_MISS,
  '$7': NAMED_LOAD_MISS,
  '$10': NAMED_LOAD_MISS,
  '$11': NAMED_LOAD_MISS,
  '$13': NAMED_LOAD_MISS,
  '$14': NAMED_LOAD_MISS,
};
type LOAD_ID = keyof typeof LOAD_CACHE;

const KEYED_STORE_CACHE = {
  '$2': KEYED_STORE_MISS,
};
type KEYED_STORE_ID = keyof typeof KEYED_STORE_CACHE;

const KEYED_LOAD_CACHE = {
  '$8': KEYED_LOAD_MISS,
  '$12': KEYED_LOAD_MISS,
};
type KEYED_LOAD_ID = keyof typeof KEYED_LOAD_CACHE;

function NAMED_LOAD_MISS(cacheId: LOAD_ID, table: Table, key: Key): Value {
  var v = LOAD(table, key);
  if (table.isFast) {
    // Create a load stub that is specialized for a fixed class and key k and
    // loads property from a fixed offset.
    var stub = CompileNamedLoadFastProperty(table.klass, key);
    LOAD_CACHE[cacheId] = stub;
  }
  return v;
}

function NAMED_STORE_MISS(cacheId: STORE_ID, table: Table, key: Key, value: Value): void {
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

function KEYED_LOAD_MISS(cacheId: KEYED_LOAD_ID, table: Table, key: Key): Value {
  var v = LOAD(table, key);
  if (table.isFast && (typeof key === 'number')) {
    // Create a stub for the fast load from the elements array.
    // Does not actually depend on the class but could if we had more complicated
    // storage system.
    KEYED_LOAD_CACHE[cacheId] = CompileKeyedLoadFastElement;
  }
  return v;
}

function KEYED_STORE_MISS(cacheId: KEYED_STORE_ID, table: Table, key: Key, value: Value): void {
  STORE(table, key, value);
  if (table.isFast && (typeof key === 'number')) {
    // Create a stub for the fast store into the elements array.
    // Does not actually depend on the class but could if we had more complicated
    // storage system.
    KEYED_STORE_CACHE[cacheId] = CompileKeyedStoreFastElement;
  }
}

function CompileNamedLoadFastProperty(klass: Klass, key: Key) {
  // Key is known to be constant (named load). Specialize index.
  var index = klass.getIndex(key);

  function KeyedLoadFastProperty(cacheId: LOAD_ID, table: Table, key: Key): Value {
    if (table.klass !== klass) {
      // Expected klass does not match. Can't use cached index.
      // Fall through to the runtime system.
      return NAMED_LOAD_MISS(cacheId, table, key);
    }
    return table.fastStringKeyLoad(index);  // Veni. Vidi. Vici.
  }

  return KeyedLoadFastProperty;
}

function CompileNamedStoreFastProperty(klass_before: Klass, klass_after: Klass, key: Key) {
  // Key is known to be constant (named load). Specialize index.
  var index = klass_after.getIndex(key);

  if (klass_before !== klass_after) {
    // Transition happens during the store.
    // Compile stub that updates hidden class.
    return function (cacheId: STORE_ID, t: Table, k: Key, v: Value) {
      if (t.klass !== klass_before) {
        // Expected klass does not match. Can't use cached index.
        // Fall through to the runtime system.
        return NAMED_STORE_MISS(cacheId, t, k, v);
      }
      t.fastStringKeyStore(index, v); // Fast store.
      t.klass = klass_after;  // T-t-t-transition!
    }
  } else {
    // Write to an existing property. No transition.
    return function (cacheId: STORE_ID, t: Table, k: Key, v: Value) {
      if (t.klass !== klass_before) {
        // Expected klass does not match. Can't use cached index.
        // Fall through to the runtime system.
        return NAMED_STORE_MISS(cacheId, t, k, v);
      }
      t.fastStringKeyStore(index, v);
    }
  }
}

function CompileKeyedLoadFastElement(ic: KEYED_LOAD_ID, t: Table, k: Key) {
  if (!t.isFast || !(typeof k === 'number' && (k | 0) === k)) {
    // If table is slow or key is not a number we can't use fast-path.
    // Fall through to the runtime system, it can handle everything.
    return KEYED_LOAD_MISS(ic, t, k);
  }
  return t.fastNumberKeyLoad(k);
}


function CompileKeyedStoreFastElement(ic: KEYED_STORE_ID, t: Table, k: Key, v: Value) {
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

export = void 0;
