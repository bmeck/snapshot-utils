#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../';

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node --experimental-modules dump.mjs <"my.heapsnapshot"`
const stream = process.stdin;
// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
SplitSnapshotProvider.fromStream(stream, (err, provider) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  // This gives us an API that can be used to analyze the snapshot.
  // Since snapshot data contains the structure of Nodes and Edges
  // the Node and Edge classes we obtain from this may be different
  // from different snapshots.
  const snapshot = new HeapSnapshot(provider);
  const nodes = new Set(
    process.argv.slice(2).map(id => snapshot.getNodeById(+id))
  );

  // setup the walk
  for (const query of nodes) {
    const queued = [
      {
        node: query,
        backPath: [],
      },
    ];
    const seen = new Set();
    while (queued.length) {
      const { node, backPath } = queued.shift();
      if (seen.has(node)) continue;
      seen.add(node.fields.id);
      const iter = snapshot.walk({
        onEdge(edge, owner) {
          if (edge.fields.to_node === node.node_index) {
            const newPath = [...backPath, edge];
            if (owner.fields.type === 'object') {
              console.log(
                JSON.stringify(
                  {
                    query,
                    container: owner,
                    backPath: newPath,
                  },
                  null,
                  2
                )
              );
            } else {
              queued.push({
                node: owner,
                backPath: newPath,
              });
            }
          }
        },
      });
      // perform the walk
      for (const _ of iter) {
      }
    }
  }
});
