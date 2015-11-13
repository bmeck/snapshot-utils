## Dumping all the Nodes in a HeapSnapshot

```javascript
import {HeapSnapshot,SplitSnapshotProvider} from "snapshot-utils";

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
	
	// Heaps are graphs, they can contain cycles! So we use a Set to
	// keep track of Nodes we have already seen.
	const visited = new Set();
	
	// We will be keeping a list of all the Edges we need to cross
	// still in an array.
	const edges_to_visit = [];
	
	// Heaps always have a root Node (index == 0)
	// This is the first Node you should visit when walking a Heap
	{
		const root = snapshot.getNode(0);
		// for simplicity lets make a mock Edge for our root
		// so that our walking loop always takes Edges
		// and push that onto the Edges we should visit
		edges_to_visit.push({
			getNode() {return root;}
		})
	}
	
	while (edges_to_visit.length) {
		// While walking we will grab the first Edge off our list
		const edge_to_walk = edges_to_visit.shift();
		
		// We grab the Node that this edge points to
		const node = edge_to_walk.getNode();
		
		// We want to be sure we don't start a cycle so we skip
		// Nodes we have already visited (but not Edges to those Nodes
		// in this example)
		if (visited.has(node.node_index)) {
			continue;
		}
		visited.add(node.node_index);
		
		// Print the data!
		console.log(node.fields);
		
		// Add all of the edges of a node to the list of Edges we
		// need to visit
		for (const edge of node.walkEdges()) {
			edges_to_visit.push(edge);
		}
	}
});
```