function* preDepthFirstSearch(node, visited, depth = 0) {
  visited[node.index] = 1;
  const child_depth = depth + 1;
  for (const edge of node.edges()) {
    const child = edge.node();
    if (visited[child.index] === 0) {
      yield [node.index, child.index, child_depth];
      yield* preDepthFirstSearch(child, visited, child_depth);
    }
  }
}
function dominators(snapshot) {
  const {
    node_count,
    edge_count,
    retainer_offsets_for_nodes,
    retainer_edges,
  } = snapshot;
  const visited = new Uint8Array(node_count);
  const dfs = preDepthFirstSearch(snapshot.getNode(0), visited);
  // node indexes sorted by depth first pre order traversal
  const dfs_index = new Uint32Array(node_count);
  // in order indexes of nodes as visited in depth first pre order traversal
  const dfs_nodes = new Uint32Array(node_count);
  // backrefs that are in dfs order, this cannot have cycles
  const dfs_parents = new Uint32Array(node_count);
  // depth for each node when visited in depth first pre order traversal
  const dfs_depths = new Uint32Array(node_count);
  function nearestCommonAncestor(node_index_a, node_index_b) {
    // make sure a has lower depth
    if (dfs_depths[node_index_b] < dfs_depths[node_index_a]) {
      let tmp = node_index_a;
      node_index_a = node_index_b;
      node_index_b = tmp;
    }
    // console.log(node_index_a, node_index_b)
    let ancestor_a = node_index_a;
    let ancestor_b = node_index_b;
    let depth_a = dfs_depths[node_index_a];
    let depth_b = dfs_depths[node_index_b];
    // console.log('depth a %d, depth b %d', depth_a, depth_b);
    while (depth_b > depth_a) {
      // console.log('skip', ancestor_b);
      ancestor_b = dfs_parents[ancestor_b];
      depth_b--;
    }
    for (let i = 0; i <= depth_a; i++) {
      // console.log('cmp', ancestor_a, ancestor_b);
      if (ancestor_a === ancestor_b) return ancestor_a;
      ancestor_a = dfs_parents[ancestor_a];
      ancestor_b = dfs_parents[ancestor_b];
    }
    // everything has the root as an ancestor
    throw new Error('unreachable');
  }
  let time = 0;
  for (const [parent_index, node_index, depth] of dfs) {
    dfs_index[node_index] = time;
    dfs_parents[node_index] = parent_index;
    dfs_depths[node_index] = depth;
    dfs_nodes[time] = node_index;
    time++;
  }
  const dominators = new Uint32Array(node_count).map((_, i) => i);
  // calculate all the semi dominators
  for (let i = dfs_nodes.length - 1; i >= 0; i--) {
    const node_index = dfs_nodes[i];
    for (const retainer of snapshot.getNode(node_index).retainers()) {
      dominators[node_index] = nearestCommonAncestor(
        dominators[node_index],
        retainer.node.index
      );
    }
  }
  return dominators;
}
export { dominators as default };
