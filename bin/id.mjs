#!/usr/bin/env node --experimental-modules
import { HeapSnapshot } from '../';
import fs from 'fs';

// We are going to use argv to get our snapshot and ids
// usage: `node --experimental-modules id.mjs my.heapsnapshot $ID1 $ID2 ...
const [streamSpecifier, ...ids] = process.argv.slice(2);
const stream =
  streamSpecifier === '-'
    ? process.stdin
    : fs.createReadStream(streamSpecifier);

// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
HeapSnapshot.fromJSONStream(stream, snapshot => {
  for (const id of ids) {
    const node = snapshot.getNodeById(+id);
    if (!node) {
      console.error(id, 'not found');
      continue;
    }
    console.log(
      JSON.stringify(
        {
          node,
          fields: node.fields(),
          edges: [...node.edges()].map(edge => ({
            edge,
            fields: edge.fields(),
          })),
        },
        null,
        2
      )
    );
    debugger;
  }
});
