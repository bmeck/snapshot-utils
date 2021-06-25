#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../index.js';

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node --experimental-modules dump.mjs <"my.heapsnapshot"`
const stream = process.stdin;

// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
const provider = await SplitSnapshotProvider.fromStream(stream);
// This gives us an API that can be used to analyze the snapshot.
// Since snapshot data contains the structure of Nodes and Edges
// the Node and Edge classes we obtain from this may be different
// from different snapshots.
const snapshot = new HeapSnapshot(provider);

// setup the walk
const iter = snapshot.walk({
  onNodeOpen(node) {
    console.group('Node', node.fields.id);
    console.log(node.fields);
  },
  onEdge(edge, owner) {
    console.log(edge.fields);
  },
  onNodeClose(node) {
    console.groupEnd();
  },
  onNodeSkipped(node) {
    console.log('Skipping (already visited)', node.fields.id);
  },
});
// perform the walk
for (const _ of iter) {
}
