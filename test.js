import api from './snapshot-api.js';
try {
  class EASY_TO_TRACK {}

  let snapshotParams = {method: 'snapshot'};
  let diffParams = {method: 'newNodes', params: [-1, -1]};
  let inspectParams = {method: 'inspectById', params: {
    snapshotId: -1,
    nodeId: -1
  }}
  let dirOptions = {depth: null};
  
  ////////////////////////////////
  // SNAPSHOTTING HERE          //
  ////////////////////////////////
  let before = api(snapshotParams);
  let x = new EASY_TO_TRACK();
  let after = api(snapshotParams);

  
  diffParams.params[0] = before;
  diffParams.params[1] = after;
  inspectParams.params.snapshotId = after;
  const newNodes = api(diffParams);
  let nodeId;

  for (nodeId of newNodes) {
    inspectParams.params.nodeId = nodeId;
    console.dir(api(inspectParams).node, dirOptions)
  }

  console.log('saw %d new nodes', newNodes.length);
} catch (e) {
  console.error(e);
}