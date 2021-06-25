import {
  takeSnapshot,
  newNodes,
  inspectById,
  reifyById,
} from './snapshot-api.js';
try {
  let diffParams = [-1, -1];
  let inspectParams = {
    snapshotId: -1,
    nodeId: -1
  };

  ////////////////////////////////
  // SNAPSHOTTING HERE          //
  ////////////////////////////////
  class EASY_TO_TRACK {
    static x = 'class';
    constructor(_x) {
      this.x = _x;
    }
  }
  let before = takeSnapshot();
  let hoho = class EASY_TO_TRACK {
    static x = 'same name class';
  }
  let x = new EASY_TO_TRACK(['instance']);
  let after = takeSnapshot();

  
  diffParams[0] = before;
  diffParams[1] = after;
  inspectParams.snapshotId = after;
  const allocated = newNodes(diffParams);
  let nodeId;

  for (nodeId of allocated) {
    inspectParams.nodeId = nodeId;
    const {
      node: nodeFields,
      edges
    } = inspectById(inspectParams);
    if (nodeFields.type !== 'object') {
      if (nodeFields.type !== 'closure') {
        continue;
      }
      if (nodeFields.name.startsWith('<')) {
        continue;
      }
    }
    try {
      // may already be GC'd by now
      const value = reifyById({nodeId: nodeFields.id});
      console.dir(value);
    } catch {}
  }

  console.log('saw %d new nodes', allocated.length);
} catch (e) {
  console.error(e);
}