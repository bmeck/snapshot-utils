#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../index.js';
import calcRetainers from '../lib/scripts/retainers.js';
import readString from '../lib/scripts/read-string.js';

const getGlobal = closureNode => {
  try {
    return [
      ...[
        ...[...closureNode.edges].find(
          e => e.fields.name_or_index === 'context'
        ).node.edges,
      ].find(e => e.fields.name_or_index === 'native_context').node.edges,
    ].find(e => e.fields.name_or_index === 'extension').node.fields.id;
  } catch (e) {
    return null;
  }
};
const getName = closureNode => {
  try {
  const trueName = closureNode.fields.name;
  let name = trueName;
  const reName = [
    ...[...closureNode.edges].find(e => e.fields.name_or_index === 'shared')
      .node.edges,
  ].find(e => e.fields.name_or_index === 'function_identifier');
  if (reName) {
    name = `${JSON.stringify(trueName)} as ${JSON.stringify(
      reName.node.fields.name
    )}`;
  }
  return name;
} catch (e) {return null;}
};
const getScript = closureNode => {
  try {
  const script = [
    ...[...closureNode.edges].find(e => e.fields.name_or_index === 'shared')
      .node.edges,
  ].find(e => e.fields.name_or_index === 'script_or_debug_info').node;
  // let source = readString([...script.edges].find(
  //   e => e.fields.name_or_index === 'source'
  // ).node);
  const nameNode = [...script.edges].find(e => {
    return e.fields.name_or_index === 'name'
  }).node;
  let name = readString(nameNode);
  //debugger;
  let source = '';
  return { id: script.fields.id, name, source };
} catch (e) {
  console.log(e)
  return null;
}
};

// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
const provider = await SplitSnapshotProvider.fromDirectory(process.argv[2]);
// This gives us an API that can be used to analyze the snapshot.
// Since snapshot data contains the structure of Nodes and Edges
// the Node and Edge classes we obtain from this may be different
// from different snapshots.
const snapshot = new HeapSnapshot(provider);
const nodes = new Set(
  process.argv.slice(3).map(id => snapshot.getNodeById(+id))
);

// setup the walk
const retainers = calcRetainers(snapshot);
for (const query of nodes) {
  const queryId = query.fields.id;
  const queued = [
    {
      node: query,
      backPath: [],
    },
  ];
  const seen = new Set();
  const bail = (queryId, backPath) => {
    for (let i = 0; i < backPath.length; i++) {
      const parent = backPath[i];
      if (parent.node.type === 'object') {
        console.log(
          JSON.stringify({
            query: queryId,
            container: parent,
            backPath: newPath,
          })
        );
        break;
      }
    }
  };
  while (queued.length) {
    const { node, backPath } = queued.shift();
    if (seen.has(node)) continue;
    const {node_index} = node;
    seen.add(node.fields.id);
    // fell through
    if (!retainers.getRetainers(node_index)) {
      bail(queryId, backPath);
      continue;
    }
    const owners = retainers.getRetainers(node_index).map(_ => ({
      node: snapshot.getNode(_.node_index),
      edge: snapshot.getEdge(_.edge_index),
    }));
    for (const { node: owner, edge } of owners) {
      const newPath = [...backPath, edge];
      console.log('edge %j : %j', edge.fields.name_or_index, edge.fields.type)
      if (
        owner.fields.type === 'hidden' ||
        // owner.fields.type === 'native' ||
        owner.fields.type === 'synthetic'
      ) {
        if (!seen.has(owner.fields.id)) bail(queryId, backPath);
      }
      if (owner.fields.type === 'closure') {
        console.log(
          JSON.stringify({
            query: queryId,
            closure: owner.fields.id,
            info: {
              global: getGlobal(owner),
              name: getName(owner),
              script: getScript(owner),
            },
            backPath: newPath.slice(0, -1).map(e => e.fields.name_or_index),
          })
        );
      } else if (
        edge.fields.type !== 'hidden' &&
        edge.fields.type !== 'shortcut' &&
        edge.fields.type !== 'internal'
      ) {
        queued.push({
          node: owner,
          backPath: newPath,
        });
      }
    }
  }
}