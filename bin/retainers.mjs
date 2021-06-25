#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../index.js';
import retainers from '../lib/scripts/retainers.js';

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node --experimental-modules dump.mjs <"my.heapsnapshot"`
const stream = process.stdin;
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
const snapshotRetainers = retainers(snapshot);
console.log(Object.fromEntries(
  Array.from(process.argv.slice(3), (id) => {
    const index = snapshot.getNodeById(+id).node_index;
    return [id, 
      snapshotRetainers.getRetainers(index).map(
        ({node_index, edge_index}) => {
          const node = snapshot.getNode(node_index);
          const edge = snapshot.getEdge(edge_index);
          return [
            node?.fields,
            edge?.fields
          ]
        }
          
      )
    ];
  })
));
