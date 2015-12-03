#!/usr/bin/env node
import {HeapSnapshot,SplitSnapshotProvider} from "../";

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node script-vars.js <"my.heapsnapshot"`
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
	
	// we will keep a list of all the globals we have seen and visit them at the end
	// this is because global Nodes have a type of "object" and can be confused easily
	// unless we grab them from context Nodes
	const globals = new Set();
	
	// setup the walk
	const iter = snapshot.walk({
		onNodeOpen
	});
	
	// perform the walk, we don't need to process it in chunks for the example
	for (const _ of iter) {}
	
	function onNodeOpen(node) {
		if (node.fields.type === 'closure') {
			// Store information that we want to print out
			// This is because the information is split up
			// and we want to have all of it at once
			const vars = [];
			let script = null;
			let global = null;
			for (const edge of node.walkEdges()) {
				// closures that have variables create context Nodes
				// these will list all the variables that a closure
				// uses. unused variables are not listed.
				if (edge.fields.name_or_index === 'context') {
					for (const context_edge of edge.getNode().walkEdges()) {
						// context Nodes have Edges with a type of "context"
						// to represent where variables are
						if (context_edge.fields.type === 'context') {
							// grab the name of the variable and
							// the id of the Node that is in the variable
							const name = context_edge.fields.name_or_index;
							const val_id = context_edge.getNode().fields.id;
							vars.push(`${name} = @${val_id}`);
						}
						// context Nodes always keep track of the global they
						// are attached to, just like frames in a browser
						// there can be multiple globals
						else if (context_edge.fields.type === 'internal'
						&& context_edge.fields.name_or_index === 'global') {
							// it is easier to lookup Nodes by index than id
							globals.add(context_edge.fields.to_node);
							global = context_edge.getNode().fields.id;
						}
					}
				}
				// closures have what is called shared script information
				// this information is shared between *all* instances of a
				// function and includes things like what script the closure
				// was from
				if (edge.fields.name_or_index === 'shared') {
					for (const shared_edge of edge.getNode().walkEdges()) {
						if (shared_edge.fields.name_or_index === 'script') {
							script = shared_edge.getNode().fields.name;
						}
					}
				}
			}
			// print our closure data!
			for (const line of vars) {
				if (script != null) {
					console.log(`${line} in function ${node.fields.name} in script ${script} in global @${global}`)
				}
				else {
					console.log(`${line} in global @${global}`)
				}
			}
		}
	}
	
	// next we walk all of the global objects we saw
	for (const global_index of globals) {
		let node = snapshot.getNode(global_index);
		for (const edge of node.walkEdges()) {
			if (edge.fields.type === 'property') {
				const property_node = edge.getNode();
				console.log(`${edge.fields.name_or_index} = @${property_node.fields.id} on global @${node.fields.id}`)
			}
		}
	}
});