#!/usr/bin/env node --experimental-modules
import { HeapSnapshot } from '../';
import dominators from '../lib/dominators';
import fs from 'fs';

// We are going to use argv to get our snapshot and ids
// usage: `node --experimental-modules id.mjs my.heapsnapshot $ID1 $ID2 ...
const [streamSpecifier] = process.argv.slice(2);
const stream =
  streamSpecifier === '-'
    ? process.stdin
    : fs.createReadStream(streamSpecifier);

// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
HeapSnapshot.fromJSONStream(stream, snapshot => {
  const dom = dominators(snapshot);
  for (let i = 0; i < dom.length; i++) {
    console.log(
      JSON.stringify(
        {
          id: snapshot.getNode(i).fields().id,
          dominator: snapshot.getNode(dom[i]).fields().id,
        },
        null,
        0
      )
    );
  }
});
