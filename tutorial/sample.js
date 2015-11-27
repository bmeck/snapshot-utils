#!/usr/bin/env node --track-heap-objects
var heapdump = require('heapdump');
setInterval(require('heapdump-sample').sample, 50);

heapdump.writeSnapshot('1.heapsnapshot');

global.leak = [];

setInterval(function() {
  var o = {};
  o['leak_' + leak.length] = 'leaking';
  leak.push(o);
}, 10)

setTimeout(function() {
  heapdump.writeSnapshot('2.heapsnapshot');
  process.exit();
}, 1000);
