/**
 * @param {import('../HeapSnapshot.js').default['Node']} source_node
 */
 export {readString as default};
 const readString = (source_node) => {
  let {fields} = source_node;
  let {type} = fields;
  if (type === 'string') {
    return source_node.fields.name;
  }
  if (type === 'sliced string') {
    for (let edge of source_node.edges) {
      const {name_or_index} = edge.fields;
      if (name_or_index === 'parent') {
        return readString(edge.node);
      }
    }
  }
  let source = '';
  if (type === 'concatenated string') {
    for (let edge of source_node.edges) {
      const {name_or_index} = edge.fields;
      if (name_or_index === 'first') {
        source += readString(edge.node);
      } else if (name_or_index === 'second') {
        source_node = edge.node;
        type = edge.node.fields.type;
      }
    }
    return source + readString(source_node);
  }
  return null;
}