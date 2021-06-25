/**
 * @param {import('../HeapSnapshot.js').default['Node']} snapshot
 */
 export default (source_node) => {
  let {fields} = source_node;
  let {type} = fields;
  if (type === 'string') {
    return source_node.fields.name;
  }
  let source = '';
  while (type === 'concatenated string') {
    for (let edge of source_node.edges) {
      const {name_or_index} = edge.fields;
      if (name_or_index === 'first') {
        source += edge.node.fields.name;
      } else if (name_or_index === 'second') {
        source_node = edge.node;
        type = source_node.fields.type;
      }
    }
  }
  source += source_node.fields.name;
  return source;
}