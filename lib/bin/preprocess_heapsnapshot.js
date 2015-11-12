import SplitSnapshotProvider from "../SplitSnapshotProvider";
import path from "path";
import fs from "fs";

const outdir = path.normalize(process.argv[2])
if (!path.isAbsolute(outdir)) {
	console.error('You must specify an absolute path for outdir');
	process.exit(3);
}

SplitSnapshotProvider.fromStream(process.stdin, function (err, provider) {
  provider.writeToDirectory(outdir, _=>_);
})