var os = {} as any;

os.clock = function() { 
  return Date.now();
};

// Program

function MakePoint(x, y) {
  var point = {} as any;
  point.x = x;
  point.y = y;
  return point;
}

function MakeArrayOfPoints(N) {
  var array = {} as any;
  var m = -1;
  for (var i = 0; i <= N; i++) {
    m = m * -1;
    array[i] = MakePoint(m * i, m * -i);
  }
  array.n = N;
  return array;
}

function SumArrayOfPoints(array) {
  var sum = MakePoint(0, 0);
  for (var i = 0; i <= array.n; i++) {
    sum.x = sum.x + array[i].x;
    sum.y = sum.y + array[i].y;
  }
  return sum;
}

function CheckResult(sum) {
  var x = sum.x;
  var y = sum.y;
  if (x !== 50000 || y !== -50000) {
    throw new Error("failed: x = " + x + ", y = " + y);
  }
}

var N = 100000;
var array = MakeArrayOfPoints(N);
var start = os.clock();
for (var i = 0; i <= 5; i++) {
  var sum = SumArrayOfPoints(array);
  CheckResult(sum);
}
var end = os.clock(); 
console.log(end - start);

export = void 0;