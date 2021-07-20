import {
  takeSnapshot,
  newNodes,
  inspectById,
  reifyById,
  getFunctionLocation,
  close
} from './snapshot-api.js';
function main() {
  let diffParams = [-1, -1];
  class InspectParams {
    snasphotId;
    nodeId;
    constructor(snapshotId, nodeId) {
      this.snasphotId = snapshotId;
      this.nodeId = nodeId;
    }
  }
  let inspectParams = new InspectParams(-1, -1);






  ////////////////////////////////
  // SNAPSHOTTING HERE          //
  ////////////////////////////////
  let before = takeSnapshot();
  setTimeout(
    function () { }.bind(null),
    1000
  );
  let after = takeSnapshot();

  console.log('Function, Instances Allocated');
  for (const [functionLocation, instances] of diff(before, after)) {
    console.log([functionLocation, instances].join(', '));
  }
  close();











  function* diff(before, after) {
    diffParams[0] = before;
    diffParams[1] = after;
    inspectParams.snapshotId = after;
    const allocated = newNodes(diffParams);
    let nodeId;

    let seen = new Map();
    for (nodeId of allocated) {
      inspectParams.nodeId = nodeId;
      const { node: nodeFields, edges } = inspectById(inspectParams);
      if (nodeFields.type !== 'closure') {
        continue;
      }
      if (nodeFields.name.startsWith('<')) {
        continue;
      }
      try {
        // may already be GC'd by now
        const nodeId = nodeFields.id;
        const value = reifyById({ nodeId });
        try {
          if (typeof value === 'function') {
            const loc = getFunctionLocation({ nodeId });
            // internal functions don't have locations
            if (loc) {
              let key = `${loc.url}:${loc.line}:${loc.column}`;
              let existing = seen.get(key);
              existing = existing || 0;
              seen.set(key, existing + 1);
            }
          }
        } catch (e) {
          console.error(e);
        }
        // console.dir(value);
        // console.log({nodeId})
      } catch (e) {
        console.error(e);
      }
    }
    for (const key of [...seen.keys()].sort()) {
      yield [key, seen.get(key)];
    }
  }
}
main();
// process.exit(0);
