import {HeapSnapshot,SplitSnapshotProvider} from "../";

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node dump.js <"my.heapsnapshot"`
const stream = process.stdin;

// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
SplitSnapshotProvider.fromStream(stream, (err, provider) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	// This gives us an API that can be used to analyze the snapshot.
	// Since snapshot data contains the structure of Nodes and Edges
	// the Node and Edge classes we obtain from this may be different
	// from different snapshots.
	const snapshot = new HeapSnapshot(provider);
	
  console.log(snapshot.getNodeById(3));
});
