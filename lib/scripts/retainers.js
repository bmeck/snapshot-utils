/**
 * @param {import('../HeapSnapshot.js').default} snapshot
 */
export default (snapshot) => {

  // // setup the walk
  // const retainer_offsets = new Uint32Array();
  // // edge
  // const retainer_edges = new Uint32Array();
  // // node_offset[][]
  // const retainer_nodes = new Uint32Array();
  // const retainers_count = new Uint32Array(snapshot.meta.node_count);
  /**
   * @type {Map<number, Array<{node_index: number, edge_index: number}>>}
   */
  const retainers = new Map();
  const iter = snapshot.walk({
    onEdge(edge, owner) {
      const node_index = edge.fields.to_node;
      if (!retainers.has(node_index)) {
        retainers.set(node_index, []);
      }
      retainers.get(node_index).push({
        node_index: owner.node_index,
        edge_index: edge.edge_index,
      });
    },
  });
  // perform the walk
  for (const _ of iter) {
  }
  return {
    /**
     * @param {number} node_offset 
     * @returns {Array<{node_index: number, edge_index: number}>}
     */
    getRetainers(node_offset) {
      return retainers.get(node_offset);
    }
  }
}