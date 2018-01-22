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

const filter = new Function(`
  'use strict';
  return ${process.argv[3] || 'true'}
`);

const map = process.argv[4]
  ? new Function(`
  'use strict';
  return ${process.argv[4]}
`)
  : function() {
      return {
        node: this,
        fields: this.fields(),
        edges: [...this.edges()].map(edge => ({
          edge,
          fields: edge.fields(),
        })),
      };
    };
// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
HeapSnapshot.fromJSONStream(stream, snapshot => {
  for (const node of snapshot.nodes()) {
    if (filter.call(node)) {
      console.log(JSON.stringify(map.call(node), null, 2));
    }
  }
});
