#!/usr/bin/env node --experimental-modules
// expects to have a .heapsnapshot piped in
import { HeapSnapshot, SplitSnapshotProvider } from '../';

const stream = process.stdin;

const findGlobal = closureNode => {
  try {
    return [
      ...[
        ...[...closureNode.walkEdges()]
          .find(e => e.fields.name_or_index === 'context')
          .getNode()
          .walkEdges(),
      ]
        .find(e => e.fields.name_or_index === 'native_context')
        .getNode()
        .walkEdges(),
    ]
      .find(e => e.fields.name_or_index === 'extension')
      .getNode();
  } catch (e) {
    return null;
  }
};
SplitSnapshotProvider.fromStream(stream, (err, provider) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const snapshot = new HeapSnapshot(provider);
  const globals = new Set();

  // setup the walk
  const iter = snapshot.walk({
    onNodeOpen,
  });

  // perform the walk, we don't need to process it in chunks for the example
  for (const _ of iter) {
  }

  function onNodeOpen(node) {
    if (node.fields.type === 'closure') {
      // Store information that we want to print out
      // This is because the information is split up
      // and we want to have all of it at once
      const vars = [];
      let script = null;
      let global = findGlobal(node);
      for (const edge of node.walkEdges()) {
        // closures that have variables create context Nodes
        // these will list all the variables that a closure
        // uses. unused variables are not listed.
        if (edge.fields.name_or_index === 'context') {
          for (const context_edge of edge.getNode().walkEdges()) {
            // console.error(context_edge.fields.name_or_index);
            // context Nodes have Edges with a type of "context"
            // to represent where variables are
            if (context_edge.fields.type === 'context') {
              // grab the name of the variable and
              // the id of the Node that is in the variable
              const name = context_edge.fields.name_or_index;
              const val_id = context_edge.getNode().fields.id;
              vars.push(`${name} = @${val_id}`);
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
          console.log(
            `${line} in function ${node.fields.name}@${
              node.fields.id
            } in script ${script} in global @${global.fields.id}`
          );
        } else {
          console.log(`${line} in global @${global.fields}`);
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
        console.log(
          `${edge.fields.name_or_index} = @${
            property_node.fields.id
          } on global @${node.fields.id}`
        );
      }
    }
  }
});
