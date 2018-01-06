#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../';

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node --experimental-modules id.mjs <"my.heapsnapshot"`
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

  for (const id of process.argv.slice(3)) {
    const node = snapshot.getNodeById(+id);
    if (!node) {
      console.error(id, 'not found');
      continue;
    }
    console.log(
      JSON.stringify(
        {
          node,
          edges: [...node.edges],
        },
        null,
        2
      )
    );
    debugger;
  }
});
