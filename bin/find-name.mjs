#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../';

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node --experimental-modules dump.mjs <"my.heapsnapshot"`
const stream = process.stdin;
// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
SplitSnapshotProvider.fromDirectory(process.argv[2], (err, provider) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  // This gives us an API that can be used to analyze the snapshot.
  // Since snapshot data contains the structure of Nodes and Edges
  // the Node and Edge classes we obtain from this may be different
  // from different snapshots.
  const snapshot = new HeapSnapshot(provider);
  const names = new Set(process.argv.slice(3));

  // setup the walk
  const iter = snapshot.walk({
    onEdge(edge, owner) {
      if (names.has(edge.fields.name_or_index)) {
        console.log(
          JSON.stringify(
            {
              edge,
              owner: owner.fields.id,
            },
            null,
            0
          )
        );
      }
    },
  });
  // perform the walk
  for (const _ of iter) {
  }
});
