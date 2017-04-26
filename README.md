typescript version of:

http://mrale.ph/blog/2012/06/03/explaining-js-vms-in-js-inline-caches.html

    >> find . -d 1 -name '*.js' | xargs -I % bash -c 'echo $0; echo -n `node $0`; echo "ms"' %
    ./0_native.js
    4ms
    ./1_simple.js
    226ms
    ./2_indexedTables.js
    262ms
    ./3_cachedIndex.js
    89ms
