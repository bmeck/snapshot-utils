#!/usr/bin/env node --track-heap-objects
var heapdump = require('heapdump');
// setInterval(require('heapdump-sample').sample, 50);

heapdump.writeSnapshot('1.heapsnapshot');

global.leak = [];

heapdump.writeSnapshot('2.heapsnapshot');
