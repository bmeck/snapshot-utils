import {
  takeSnapshot,
  newNodes,
  inspectById,
  inspectByIndex,
  reifyById,
  containingClosures,
  retainers,
} from './snapshot-api.js';
function main() {
  try {
    let diffParams = [-1, -1];
    let inspectParams = {
      snapshotId: -1,
      nodeId: -1
    };

    ////////////////////////////////
    // SNAPSHOTTING HERE          //
    ////////////////////////////////
    let before = takeSnapshot();
    // DOESN'T SHOW UP IN SNAPSHOT IN A CONTEXT?
    // RETAINED SIZE IS EASY WAY TO FIND THE NODE
    let EASY_TO_TRACK = new Uint8Array(1024 * 1024);
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
        const nodeId = nodeFields.id;
        const value = reifyById({nodeId});
        console.dir(value);
        console.dir({
          containingClosures: containingClosures({
            snapshotId: after,
            nodeIds: [nodeId]
          })
        }, {depth: null});
      } catch (e) {
        console.error(e)
      }
    }

    console.log('saw %d new nodes', allocated.length);
  } catch (e) {
    console.error(e);
  }
}
setTimeout(main,10);
