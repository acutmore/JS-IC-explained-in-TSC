// Simple runtime libarary

type Key = string | number;
type Value = any;

class Table {
  private map = new Map<Key, Value>();

  load(key: Key): Value {
    return this.map.get(key);
  }

  store(key: Key, value: Value): void {
    this.map.set(key, value);
  }
}

function LOAD(t: Table, k: Key) {
  return t.load(k);
}

function STORE(t: Table, k: Key, v: Value) {
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

export = void 0;