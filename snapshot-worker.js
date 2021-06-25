import {HeapSnapshot, SplitSnapshotProvider, TimeLine} from './index.js';
import readString from './lib/scripts/read-string.js';
import {PassThrough} from 'stream';
import CDP from 'chrome-remote-interface';
import {
  workerData,
  receiveMessageOnPort
} from 'worker_threads';
import { writeFileSync } from 'fs';

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
  let msg = {log: null, pause: false, result: null, exception: null};
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
let pendingSnapshotId = -1;
let pendingSnapshot = null;
/**
 * @type {Map<number, HeapSnapshot>}
 */
const snapshots = new Map();
async function act({method, params}) {
  // log('act', {method, params}, lock);
  if (method === 'snapshot') {
    // we have to wait for other snapshot to finish due to DevTools protocol
    // being unable to distinguish snapshots while dumping it out
    if (pendingSnapshot) await pendingSnapshot;
    const id = pendingSnapshotId = snapshotN++;
    pendingSnapshot = (async () => {
      await post('HeapProfiler.enable');
      const stream = new PassThrough();
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
      pendingSnapshotId = -1;
      pendingSnapshot = null;
    })();
    await pendingSnapshot;
    return id;
  } else if (method === 'newNodes') {
    const [before, after] = params;
    await waitForSnapshotIds([before, after]);
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
    await waitForSnapshotIds([snapshotId]);
    const snapshot = snapshots.get(snapshotId);
    const node = snapshot.getNodeById(nodeId);
    return inspectResult(node);
  } else if (method === 'inspectByIndex') {
    const {snapshotId, nodeIndex} = params;
    await waitForSnapshotIds([snapshotId]);
    const snapshot = snapshots.get(snapshotId);
    const node = snapshot.getNode(nodeIndex);
    return inspectResult(node);
  } else if (method === 'readStringById') {
    const {snapshotId, nodeId} = params;
    await waitForSnapshotIds([snapshotId]);
    const snapshot = snapshots.get(snapshotId);
    const node = snapshot.getNodeById(nodeId);
    return readString(node);
  } else if (method === 'reifyById') {
    const {nodeId} = params;
    await post('Debugger.enable');
    await post('HeapProfiler.enable');
    let result = await post('HeapProfiler.getObjectByHeapObjectId', {
      objectId: `${nodeId}`,
      objectGroup: 'getObjectFromHeapId'
    });
    const objectId = result.result.objectId;
    let assigned = false;
    let callFrameId;
    client.on('event', async function assignCallFrameId({method, params}) {
      if (method === 'Debugger.paused') {
        client.off('event', assignCallFrameId);
        const {callFrames} = params;
        callFrameId = callFrames[0].callFrameId;
        assigned = true;
      }
    });
    // worker event loop doesn't like combo of Debugger.pause + Atomics.wait
    // on main thread
    while (!assigned) {
      await post('Debugger.pause');
      await post('Debugger.resume');
    }
    await post('Debugger.pause');
    await post('Debugger.setVariableValue', {
      callFrameId,
      variableName: 'reifyValueCell',
      scopeNumber: 1,
      newValue: {objectId}
    });
    await post('Runtime.releaseObjectGroup', {
      objectGroup: 'getObjectFromHeapId'
    });
    await post('Debugger.resume');
    return null;
  } else {
    throw new Error('unknown method ' + method);
  }
}
async function waitForSnapshotIds(ids) {
  if (pendingSnapshot && ids.includes(pendingSnapshotId)) {
    await pendingSnapshot;
  }
};
function inspectResult(node) {
  return {
    node: node.fields.toJSON(),
    edges: Array.from(node.edges, edge => edge.fields.toJSON())
  };
}

waitForAction();
