#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../';

// FINDS ALL THE PATHS UP TO CLOSURES

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
  const nodes = new Set(
    process.argv.slice(3).map(id => snapshot.getNodeById(+id))
  );

  // setup the walk
  for (const query of nodes) {
    const queued = [query];
    const queryId = query.fields.id;
    const seen = new Set();
    console.log(
      JSON.stringify(
        {
          query: queryId,
          node: query,
        },
        null,
        2
      )
    );
    while (queued.length) {
      const node = queued.shift();
      const id = node.fields.id;
      seen.add(id);
      for (const edge of node.edges) {
        const { fields: { type } } = edge;
        if (type === 'context' || type === 'property' || type == 'element') {
          const child = edge.node;
          const childId = child.fields.id;
          if (seen.has(childId)) continue;
          seen.add(childId);
          console.log(
            JSON.stringify(
              {
                query: queryId,
                node: child,
              },
              null,
              0
            )
          );
          if (child.fields.type !== 'closure') {
            queued.push(child);
          }
        } else if (
          node.fields.type === 'closure' &&
          type === 'internal' &&
          edge.fields.name_or_index === 'context'
        ) {
          queued.push(edge.node);
        }
      }
    }
  }
});
