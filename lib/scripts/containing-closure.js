import { HeapSnapshot, SplitSnapshotProvider } from '../../index.js';

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
  ].find(e => e.fields.name_or_index === 'script').node;
  let source = '';
  let source_node = [...script.edges].find(
    e => e.fields.name_or_index === 'source'
  ).node;
  while (source_node.fields.type === 'concatenated string') {
    let head = [...source_node.edges].find(
      e => e.fields.name_or_index === 'first'
    );
    let tail = [...source_node.edges].find(
      e => e.fields.name_or_index === 'second'
    );
    source += head.node.fields.name;
    source_node = tail.node;
  }
  source += source_node.fields.name;
  const name = [...script.edges].find(e => e.fields.name_or_index === 'name')
    .node.fields.name;
  //debugger;
  return { id: script.fields.id, name, source };
} catch (e) {return null;}
};

// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
SplitSnapshotProvider.fromDirectory(process.argv[2], (err, provider) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  // This gives us an API that can be used to analyze the snapshot.
  // Since snapshot data contains the structure of Nodes and Edges
  // the Node and Edge classes we obtain from this may be different
  // from different snapshots.
  const snapshot = new HeapSnapshot(provider);
  const nodes = new Set(
    process.argv.slice(3).map(id => snapshot.getNodeById(+id))
  );

  // setup the walk
  const retainer_edges;
  const retainer_nodes = new Uint32Array();
  const retainers_count = new Uint32Array(snapshot.meta.node_count);
  const iter = snapshot.walk({
    onEdge(edge, owner) {
      const nodeId = edge.node.fields.id;
      if (!retainers.has(nodeId)) {
        retainers.set(nodeId, []);
      }
      retainers.get(nodeId).push({
        node: owner.node_index,
        edge,
      });
    },
  });
  // perform the walk
  for (const _ of iter) {
  }
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
      const nodeId = node.fields.id;
      seen.add(node.fields.id);
      // fell through
      if (!retainers.get(nodeId)) {
        bail(queryId, backPath);
        continue;
      }
      const owners = retainers.get(nodeId).map(_ => ({
        node: snapshot.getNode(_.node),
        edge: _.edge,
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
});
