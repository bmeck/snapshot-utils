#!/usr/bin/env node --experimental-modules

// compare before.heapsnapshot after.heapsnapshot {dead,old,new}
import { HeapSnapshot, SplitSnapshotProvider } from '../';
import { Timeline } from '../lib/Timeline';
import fs from 'fs';

(async () => {
  const providers = await Promise.all(
    process.argv.slice(2).map(file => {
      return {
        then(f, r) {
          SplitSnapshotProvider.fromDirectory(file, (err, provider) => {
            if (err) {
              r(err);
            } else {
              f(provider);
            }
          });
        },
      };
    })
  );
  const snapshots = providers.map(provider => new HeapSnapshot(provider));
  const walk = new Timeline(snapshots).masks({
    onMask(m) {
      console.log(JSON.stringify(m));
    },
  });
  for (const _ of walk) {
  }
})().catch(e =>
  setTimeout(() => {
    throw e;
  })
);
