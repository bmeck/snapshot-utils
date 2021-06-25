import {
  takeSnapshot,
  newNodes,
  inspectById
} from './snapshot-api.js';
try {
  class EASY_TO_TRACK {}

  let diffParams = [-1, -1];
  let inspectParams = {
    snapshotId: -1,
    nodeId: -1
  };
  let dirOptions = {depth: null};
  
  ////////////////////////////////
  // SNAPSHOTTING HERE          //
  ////////////////////////////////
  let before = takeSnapshot();
  let x = new EASY_TO_TRACK();
  let after = takeSnapshot();

  
  diffParams[0] = before;
  diffParams[1] = after;
  inspectParams.snapshotId = after;
  const allocated = newNodes(diffParams);
  let nodeId;

  for (nodeId of allocated) {
    inspectParams.nodeId = nodeId;
    console.dir(inspectById(inspectParams).node, dirOptions)
  }

  console.log('saw %d new nodes', allocated.length);
} catch (e) {
  console.error(e);
}