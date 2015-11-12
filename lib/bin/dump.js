import HeapSnapshot from '../HeapSnapshot';
import SplitSnapshotProvider from '../SplitSnapshotProvider';

if (process.argv[2] && process.argv[2] != '-') {
  SplitSnapshotProvider.fromDirectory(process.argv[2], go);
}
else {
  SplitSnapshotProvider.fromStream(process.stdin, go);
}
function go(err, provider) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const snapshot = new HeapSnapshot(provider);
  
  let edge = {
    getNode: function () {
      return snapshot.getNode(0)
    }
  };
  
  const to_walk = [{edge}];
  const visited = new Set();
  walk:
  while(to_walk.length) {
    let task = to_walk.shift();
    let node = task.edge.getNode();
    if (visited.has(node.index)) {
      continue;
    }
	console.log(node.node);
    visited.add(node.index);
    for (const edge of node.walkEdges()) {
	  console.log(edge.edge);
      if (visited.has(edge.edge.to_node)) {
        continue;
      }
      to_walk.push({
        edge
      });
    }
  }
}