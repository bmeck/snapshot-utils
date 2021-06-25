#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../index.js';

// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
const provider = await SplitSnapshotProvider.fromDirectory(process.argv[2]);
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
  console.group(node.fields);
  for (const edge of node.edges) {
    console.log(edge.fields);
  }
  console.groupEnd();
  debugger;
}