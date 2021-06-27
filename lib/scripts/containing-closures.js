import { HeapSnapshot } from '../../index.js';
import calcRetainers from './retainers.js';

/**
 * @param {HeapSnapshot} snapshot 
 * @param {Array<number>} nodeIds 
 */
 export default (snapshot, nodeIds) => {
  const retainers = calcRetainers(snapshot);
  const results = new Map();
  for (const nodeId of nodeIds) {
    const seen = new Map();
    const walking = new Set();
    function walkBack(node_index) {
      if (walking.has(node_index)) {
        return null;
      }
      if (seen.has(node_index)) {
        return seen.get(node_index);
      }
      try {
        walking.add(node_index);
        const retaining = retainers.getRetainers(node_index);
        if (!retaining) return null;
        let results = [];
        seen.set(node_index, results);
        for (const {
          node_index: retaining_node_index,
          edge_index: retaining_edge_index
        } of retaining) {
          const retainingNode = snapshot.getNode(retaining_node_index);
          const retainingEdge = snapshot.getEdge(retaining_edge_index);
          if (retainingNode.fields.type === 'synthetic' && retainingNode.fields.name === '(GC roots)') {
            results.push({
              node_id: retainingNode.fields.id,
              edge: retainingEdge.fields.toJSON()
            });
            continue; 
          } else if (retainingNode.fields.type === 'closure') {
            // internal closure's start with <, keep going if found
            if (!retainingNode.fields.name.startsWith('<')) {
              results.push({
                node_id: retainingNode.fields.id,
                edge: retainingEdge.fields.toJSON()
              });
              continue; 
            }
          }
          results.push({
            node_id: retainingNode.fields.id,
            containing_closures: walkBack(retaining_node_index)?.filter(Boolean),
            edge: retainingEdge.fields.toJSON()
          });
        }
        return results;
      } finally {
        walking.delete(node_index);
      }
    }
    results.set(
      nodeId,
      walkBack(snapshot.getNodeById(nodeId).node_index)
    );
  }
  return results;
}
