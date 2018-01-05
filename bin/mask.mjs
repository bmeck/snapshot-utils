#!/usr/bin/env node --experimental-modules

// compare before.heapsnapshot after.heapsnapshot {dead,old,new}
import { HeapSnapshot, SplitSnapshotProvider } from '../';
import fs from 'fs';

(async () => {
  const providers = await Promise.all(
    process.argv.slice(2).map(file => {
      return {
        then(f, r) {
          SplitSnapshotProvider.fromStream(
            fs.createReadStream(file),
            (err, provider) => {
              if (err) {
                r(err);
              } else {
                f(provider);
              }
            }
          );
        },
      };
    })
  );
  const snapshots = providers.map(provider => new HeapSnapshot(provider));
  let onId = null;
  let mask = null;
  const print = () => {
    if (mask) {
      const sizes = mask.reduce((acc, m) => {
        let delta;
        if (!m) delta = null;
        else {
          delta = m.self_size;
          if (acc.length) {
            const last = acc[acc.length - 1];
            if (typeof last === 'number') {
              delta -= last;
            }
          }
        }
        return [...acc, delta];
      }, []);
      // return;
      console.log(
        JSON.stringify({
          node: onId,
          mask: mask.map(m => !!m),
        })
      );
    }
  };
  const scans = snapshots.map((snapshot, i) =>
    snapshot.scan({
      onNode(node) {
        if (!node) return;
        const id = node.fields.id;
        values[i] = node;
        if (onId !== id) {
          print();
          onId = id;
          mask = Array.from({ length: snapshots.length }).fill(null);
        }
        mask[i] = {
          self_size: node.fields.self_size,
          edges: [...node.edges],
        };
      },
    })
  );
  const values = Array.from({ length: snapshots.length }).fill(null);
  // while some scans are not done
  while (scans.some(s => Boolean(s))) {
    const min = Math.min(
      ...values.map((v, i) => {
        if (v) {
          return v.fields.id;
        }
        return scans[i] === null ? Infinity : -Infinity;
      })
    );
    const next = values.findIndex((v, i) => {
      return !v ? scans[i] !== null : v.fields.id === min;
    });
    const { done } = scans[next].next();
    if (done) {
      scans[next] = null;
      values[next] = null;
    }
  }
  print();
})().catch(e =>
  setTimeout(() => {
    throw e;
  })
);
