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
  private type: KlassKind = KlassKind.FAST;
  private klass = ROOT_KLASS;
  private stringKeyValues: Value[] = [];
  private numberKeyValues: Value[] = [];
  private slow: Map<Key, Value> = undefined;

  load(key: Key): Value {
    if (this.type === KlassKind.SLOW) {
      return this.slow.get(key);
    }

    if (typeof key === "number") { // Indexed property.
      return this.numberKeyValues[key | 0];
    } else {
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
    } else {  // Named property.
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
    if (this.klass.hasProperty(key)) {  // Try adding property if it does not exist.
      const desc = this.klass.getDescriptor(key);
      if (desc instanceof Transition) {
        // Property does not exist yet but we have a transition to the class that has it.
        this.klass = desc.klass;
        return this.klass.getIndex(key);
      }
      // Get index of existing property.
      return desc.index;
    } else {
      // Too many properties! Achtung! Fast case kaput.
      if (this.klass.numberOfProperties > 20) return -1;
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

// console.dir(ROOT_KLASS,{depth:null}) // Uncomment to view class hierarchy

export = void 0;
