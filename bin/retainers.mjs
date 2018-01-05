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
  const node_indices = new Set(
    process.argv.slice(2).map(id => snapshot.getNodeById(+id).node_index)
  );

  // setup the walk
  const iter = snapshot.walk({
    onNodeOpen(node) {},
    onEdge(edge, owner) {
      if (node_indices.has(edge.fields.to_node)) {
        console.log(
          JSON.stringify(
            {
              edge,
              owner: owner.fields.id,
            },
            null,
            2
          )
        );
      }
    },
    onNodeClose(node) {},
  });
  // perform the walk
  for (const _ of iter) {
  }
});
