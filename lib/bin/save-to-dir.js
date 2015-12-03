#!/usr/bin/env node
import SplitSnapshotProvider from "../SplitSnapshotProvider";
import path from "path";
import fs from "fs";

const outdir = path.normalize(process.argv[2])
if (!path.isAbsolute(outdir)) {
	console.error('You must specify an absolute path for outdir');
	process.exit(3);
}

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node save-to-dir.js $dir <"my.heapsnapshot"`
SplitSnapshotProvider.fromStream(process.stdin, function (err, provider) {
  provider.writeToDirectory(outdir, _=>_);
});