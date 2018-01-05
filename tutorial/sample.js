#!/usr/bin/env node --track-heap-objects
var heapdump = require('heapdump');

const ref1 = {};
const ref2 = {};

heapdump.writeSnapshot(__dirname + '/start.heapsnapshot');

global.leak1 = {};
heapdump.writeSnapshot(__dirname + '/1.global1.heapsnapshot');

global.leak2 = [];
heapdump.writeSnapshot(__dirname + '/2.global2.heapsnapshot');

global.leak1.a = 0;
heapdump.writeSnapshot(__dirname + '/3.primitiveEdge1.heapsnapshot');

global.leak1.b = 1;
heapdump.writeSnapshot(__dirname + '/4.primitiveEdge2.heapsnapshot');

global.leak2[global.leak2.length] = ref1;
heapdump.writeSnapshot(__dirname + '/5.existingEdge1.heapsnapshot');

global.leak2[global.leak2.length] = ref2;
heapdump.writeSnapshot(__dirname + '/6.existingEdge2.heapsnapshot');

heapdump.writeSnapshot(__dirname + '/done.heapsnapshot');
