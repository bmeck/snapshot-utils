#!/usr/bin/env node --track-heap-objects

//#region boilerplate
// @ts-ignore
import { writeHeapSnapshot as v8WriteHeapSnapshot } from 'v8';
// @ts-ignore
import { fileURLToPath } from 'url';
if (!process.execArgv.includes('--track-heap-objects')) {
  const {spawn} = await import('child_process');
  await new Promise((f, r) => {
    spawn(process.execPath, [
      ...process.execArgv,
      '--track-heap-objects',
      ...process.argv.slice(1)
    ], {
      stdio: 'inherit'
    }).on('error', (err) => {
      console.error(err);
      process.exit(1);
    }).on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        process.exit(1);
      }
      process.exit(code ?? 1);
    });
  });}
/**
 * @param {string} name 
 * @returns {void}
 */
function writeHeapSnapshot(name) {
  v8WriteHeapSnapshot(
    fileURLToPath(
      new URL(name, new URL('./', import.meta.url))
    )
  );
}
//#endregion boilerplate

//#region properties
// These classes are named so they show up in easy
// to find snapshot UI and walks via the type name
const ref1 = new class EasyToFind_Ref1 {};
const ref2 = new class EasyToFind_Ref2 {};

// This only has ref1 and ref2 in it
writeHeapSnapshot('./0.start.heapsnapshot');

// This adds a single 
globalThis.leak1 = {};
writeHeapSnapshot('./1.global1.heapsnapshot');

/** @type {Array<any>} */
globalThis.leak2 = [];
writeHeapSnapshot('./2.global2.heapsnapshot');

// This results in:
// leak1 = {a: 0}
globalThis.leak1.a = 0;
writeHeapSnapshot('./3.primitiveEdge1.heapsnapshot');

// This results in:
// leak1 = {a: 0, b: 1}
globalThis.leak1.b = 1;
writeHeapSnapshot('./4.primitiveEdge2.heapsnapshot');

// This results in:
// leak2 = [ref1]
globalThis.leak2[globalThis.leak2.length] = ref1;
writeHeapSnapshot('./5.existingEdge1.heapsnapshot');

// This results in:
// leak2 = [ref1, ref2]
globalThis.leak2[globalThis.leak2.length] = ref2;
writeHeapSnapshot('./6.existingEdge2.heapsnapshot');
//#endregion properties

//#region closures
/**
 * Creates a function that when given a parameter
 * always holds onto that parameter using a closed over array
 * so that it always grows the closure
 * @returns {(leakingValue: unknown) => void}
 */
const createClosureGrowFunction = () => {
  let a = [];
  return v => a.push(v);
};
let fn1 = null;
let fn2 = null;

fn1 = createClosureGrowFunction();
writeHeapSnapshot('./7.closureInstance1.heapsnapshot');

fn2 = createClosureGrowFunction();
writeHeapSnapshot('./8.closureInstance2.heapsnapshot');

const leaks = [
  { leak: '1' },
  { leak: '2' },
  { leak: '3' },
  { leak: '4' }
];
for (const value of leaks) {
  fn1(value);
}
// fn1 closure is the dominator of the leaks
writeHeapSnapshot('./9.closureGrowth.heapsnapshot');

for (const value of leaks) {
  fn2(value);
}
// neither fn1 nor fn2 are the dominator of the leaks since
// both hold onto the values, this causes the leak to propagate
// to a shared parent node
writeHeapSnapshot('./9.closureGrowth2.heapsnapshot');
//#endregion closures

writeHeapSnapshot('./10.done.heapsnapshot');
