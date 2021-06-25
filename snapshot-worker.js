import {HeapSnapshot, SplitSnapshotProvider, TimeLine} from './index.js';
import {PassThrough} from 'stream';
import CDP from 'chrome-remote-interface';
import {
  workerData,
  receiveMessageOnPort
} from 'worker_threads';

const inspectorUrl = new URL(workerData.inspectorUrl);
const client = await CDP({
  host: inspectorUrl.hostname,
  port: inspectorUrl.port
});
await client.Runtime.runIfWaitingForDebugger();
const lock = workerData.lock;
const workerPort = workerData.workerPort;
const post = (method, params) => {
  return client.send(method, params);
}
async function waitForAction() {
  // wait until messageLock[0] is notified or != 0
  let action = receiveMessageOnPort(workerPort);
  while (!action) {
    Atomics.wait(lock, 0, 0);
    action = receiveMessageOnPort(workerPort);
  }
  let msg = {result: null, exception: null};
  try {
    msg.result = await act(action.message);
  } catch (e) {
    msg.exception = e;
  }
  workerPort.postMessage(msg);
  lock[0] = 0;
  Atomics.notify(lock, 0, 1);
  waitForAction();
}
waitForAction();

/**
 * Can synchronously interrupt an action to perform a console.log
 * @param  {...any} parts to log
 */
function log(...parts) {
  workerPort.postMessage({log: parts});
  lock[0] = 0;
  Atomics.notify(lock, 0, 1);
  Atomics.wait(lock, 0, 0);
}

let snapshotN = 1;
/**
 * @type {Map<number, HeapSnapshot>}
 */
const snapshots = new Map();
async function act({method, params}) {
  // log('act', {method, params}, lock);
  if (method === 'snapshot') {
    await post('HeapProfiler.enable');
    const stream = new PassThrough();
    const id = snapshotN++;
    function accumulate(m) {
      stream.write(m.chunk);
    }
    client.addListener('HeapProfiler.addHeapSnapshotChunk', accumulate);
    post('HeapProfiler.collectGarbage');
    await post('HeapProfiler.takeHeapSnapshot');
    stream.end();
    const provider = await SplitSnapshotProvider.fromStream(stream);
    const snapshot = new HeapSnapshot(provider);
    client.removeListener('HeapProfiler.addHeapSnapshotChunk', accumulate);
    snapshots.set(id, snapshot);
    return id;
  } else if (method === 'newNodes') {
    const [before, after] = params;
    const snapshotBefore = snapshots.get(before);
    const snapshotAfter = snapshots.get(after);
    if (!snapshotBefore || !snapshotAfter) {
      throw new Error(`unable to find snapshot ${before} or ${after}, have ${Array.from(snapshots.keys())}`);
    }
    const masks = [];
    const iter = new TimeLine([snapshotBefore, snapshotAfter]).masks({
      onMask(mask) {
        if (mask.sizes[0] === null) {
          masks.push(mask.nodeId);
        }
      }
    });
    for (let _ of iter) {}
    return masks;
  } else if (method === 'inspectById') {
    const {snapshotId, nodeId} = params;
    const snapshot = snapshots.get(snapshotId);
    const node = snapshot.getNodeById(nodeId);
    return {
      node: node.fields.toJSON(),
      // edges: [...node.edges].map(edge => edge.fields.toJSON())
    };
  }
}