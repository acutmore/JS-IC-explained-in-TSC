Typescript version of:

http://mrale.ph/blog/2012/06/03/explaining-js-vms-in-js-inline-caches.html

Inline-Caches are a key design in how modern Javascript engines are able to make the dynamic aspects of the language run fast. To help me understand them I have rewritten Vyacheslav Egorov's toy implementation in Typescript.

Run benchmarks:

    >> tsc --project .
    >> find . -d 1 -name '*.js' | xargs -I % bash -c 'echo $0; echo -n `node $0`; echo "ms"' %
    ./0_native.js
    4ms
    ./1_simple.js
    226ms
    ./2_indexedTables.js
    262ms
    ./3_cachedIndex.js
    89ms
