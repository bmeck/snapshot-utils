#!/usr/bin/env node --track-heap-objects
const heapdump = require('heapdump');

const ref1 = {};
const ref2 = {};

heapdump.writeSnapshot(__dirname + '/0.start.heapsnapshot');

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

const closure1 = () => {
  let a = [];
  return v => a.push(v);
};
let fn1 = null;
let fn2 = null;

fn1 = closure1();
heapdump.writeSnapshot(__dirname + '/7.closureInstance1.heapsnapshot');

fn2 = closure1();
heapdump.writeSnapshot(__dirname + '/8.closureInstance2.heapsnapshot');

const leaks = [{ leak: '1' }, { leak: '2' }, { leak: '3' }, { leak: '4' }];
leaks.map(fn1);
heapdump.writeSnapshot(__dirname + '/9.closureGrowth.heapsnapshot');

leaks.map(fn2);
heapdump.writeSnapshot(__dirname + '/9.closureGrowth2.heapsnapshot');

heapdump.writeSnapshot(__dirname + '/10.done.heapsnapshot');
