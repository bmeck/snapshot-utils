#!/usr/bin/env node
import { SplitSnapshotProvider } from '../index.js';
import {isAbsolute, normalize} from 'path';

const outdir = normalize(process.argv[2]);
if (!isAbsolute(outdir)) {
  console.error('You must specify an absolute path for outdir');
  process.exit(3);
}

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node save-to-dir.js $dir <"my.heapsnapshot"`
const provider = await SplitSnapshotProvider.fromStream(process.stdin);
await provider.writeToDirectory(outdir);