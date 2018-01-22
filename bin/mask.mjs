#!/usr/bin/env node --experimental-modules

import { HeapSnapshot } from '../';
import { Timeline } from '../lib/Timeline';
import fs from 'fs';

(async () => {
  const snapshots = await Promise.all(
    process.argv.slice(2).map(file => {
      return {
        then(f, r) {
          HeapSnapshot.fromJSONStream(
            fs.createReadStream(file),
            snapshot => f(snapshot),
            r
          );
        },
      };
    })
  );
  debugger;
  const walk = new Timeline(snapshots).masks({
    onMask(m) {
      console.log(JSON.stringify(m.map(n => {
        return n && n.fields().id
      })));
    },
  });
  for (const _ of walk) {
  }
})().catch(e =>
  setTimeout(() => {
    throw e;
  })
);
