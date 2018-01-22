#!/usr/bin/env node --experimental-modules
import { HeapSnapshot } from '../';
import fs from 'fs';
const findGlobal = closureNode => {
  try {
    return [
      ...[
        ...[...closureNode.edges()].find(
          e => e.fields().name_or_index === 'context'
        ).node().edges(),
      ].find(e => e.fields().name_or_index === 'native_context').node().edges(),
    ].find(e => e.fields().name_or_index === 'extension').node().fields().id;
  } catch (e) {
    // console.log(e)
    return null;
  }
};
const findScript = closureNode => {
  for (const edge of closureNode.edges()) {
    // closures have what is called shared script information
    // this information is shared between *all* instances of a
    // function and includes things like what script the closure
    // was from
    if (edge.fields().name_or_index === 'shared') {
      for (const shared_edge of edge.node().edges()) {
        if (shared_edge.fields().name_or_index === 'script') {
          return shared_edge.node().fields().name;
        }
      }
    }
  }
  return null;
}

// We are going to use argv to get our snapshot and ids
// usage: `node --experimental-modules id.mjs my.heapsnapshot $ID1 $ID2 ...
const [streamSpecifier, ...ids] = process.argv.slice(2);
const stream =
  streamSpecifier === '-'
    ? process.stdin
    : fs.createReadStream(streamSpecifier);

function reduce(acc, edge, node) {
  if (acc === null) acc = 0;
  return acc + node.fields().self_size;
}

HeapSnapshot.fromJSONStream(stream, snapshot => {
  const nodes = process.argv.slice(3).map(id => snapshot.getNodeById(+id));

  // setup the walk
  for (const query of nodes) {
    let acc = null;
    const queued = [query];
    const queryId = query.fields().id;
    const seen = new Uint8Array(snapshot.node_count);
    const script = findScript(query);
    const global = findGlobal(query);
    const out = (edge, node) => {
      acc = reduce(acc, edge, node);
    }
    out(null, query);
    // if (global) queued.push(global);
    while (queued.length) {
      const node = queued.shift();
      const id = node.fields().id;
      if (seen[node.index] !== 0) continue;
      seen[node.index] = 1;
      for (const edge of node.edges()) {
        const type = edge.fields().type;
        if (type === 'context' || type === 'property' || type == 'element') {
          const child = edge.node();
          if (seen[child.index] !== 0) continue;
          seen[child.index] = 1;
          out(edge, child);
          if (child.fields().type !== 'closure') {
            queued.push(child);
          } else {
          }
        } else if (
          node.fields().type === 'closure' &&
          type === 'internal' &&
          edge.fields().name_or_index === 'context'
        ) {
          queued.push(edge.node());
        }
      }
    }
    console.error('@%d => name:%s url:%s, global:%d, acc:%j', queryId, query.fields().name, script, global, acc);
  }
});

