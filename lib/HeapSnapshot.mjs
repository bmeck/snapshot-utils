import parseSnapshotStream from './parseSnapshotStream';
const required = () => {
  throw new TypeError('missing required argument');
};
const binarySearch = (offset_buffer, value_buffer, target) => {
  let left = 0;
  let right = value_buffer.length;
  while (left !== right) {
    const i = (left + right) >>> 1;
    const offset = offset_buffer[i];
    const found = value_buffer[offset];
    if (found === target) {
      return offset;
    } else if (found > target) {
      right = i - 1;
    } else {
      left = i + 1;
    }
  }
  const offset = offset_buffer[left];
  const found = value_buffer[offset];
  if (found === target) {
    return offset;
  }
  return -1;
};
export default class SplitSnapshotProvider {
  constructor(
    {
      meta = required(),
      node_count = required(),
      edge_count = required(),
      node_field_buffers = required(),
      edge_field_buffers = required(),
      node_offsets_in_sorted_id_order = required(),
      edge_offsets_for_nodes = required(),
      retainer_offsets_for_nodes = required(),
      retainer_counts_for_nodes = required(),
      retainer_nodes = required(),
      retainer_edges = required(),
      string_buffer = required(),
      string_offsets = required(),
      string_lengths = required(),
    } = required()
  ) {
    Object.assign(this, {
      meta,
      node_count,
      edge_count,
      node_field_buffers,
      node_id_field: meta.node_fields.indexOf('id'),
      edge_field_buffers,
      node_offsets_in_sorted_id_order,
      edge_offsets_for_nodes,
      retainer_offsets_for_nodes,
      retainer_counts_for_nodes,
      retainer_nodes,
      retainer_edges,
      string_buffer,
      string_offsets,
      string_lengths,
    });
    class Node {
      constructor(index = required()) {
        this.index = index;
        Object.freeze(this);
      }
      *edges() {
        for (let i = 0; i < this.fields().edge_count; i++) {
          let edge_i = edge_offsets_for_nodes[this.index] + i;
          yield new Edge(edge_i);
        }
      }
      *retainers() {
        for (let i = 0; i < retainer_counts_for_nodes[this.index]; i++) {
          let retainer_i = retainer_offsets_for_nodes[this.index] + i;
          yield {
            edge: new Edge(retainer_edges[retainer_i]),
            node: new Node(retainer_nodes[retainer_i]),
          };
        }
      }
      toJSON() {
        return this.index;
      }
      fields() {
        return new NodeFields(this.index);
      }
    }
    class NodeFields {
      constructor(index = required()) {
        this.index = index;
        Object.freeze(this);
      }
      toJSON() {
        const ret = { __proto__: null };
        for (const key of Object.keys(NodeFields.prototype)) {
          ret[key] = this[key];
        }
        return ret;
      }
    }
    delete NodeFields.prototype.constructor;
    Object.setPrototypeOf(NodeFields.prototype, null);
    for (let field_i = 0; field_i < meta.node_fields.length; field_i++) {
      const field = meta.node_fields[field_i];
      const field_buffer = node_field_buffers[field_i];
      let handler = null;
      const field_type = meta.node_types[field_i];
      if (Array.isArray(field_type)) {
        handler = i => field_type[field_buffer[i]];
      } else if (field_type === 'string') {
        handler = i => this.getString(field_buffer[i]);
      } else {
        handler = i => field_buffer[i];
      }
      Object.defineProperty(NodeFields.prototype, field, {
        get() {
          return handler(this.index);
        },
        enumerable: true,
      });
    }
    class Edge {
      constructor(index = required()) {
        this.index = index;
        Object.freeze(this);
      }
      node() {
        return new Node(this.fields().to_node);
      }
      toJSON() {
        return this.index;
      }
      fields() {
        return new EdgeFields(this.index);
      }
    }
    class EdgeFields {
      constructor(index = required()) {
        this.index = index;
        Object.freeze(this);
      }
      toJSON() {
        const ret = { __proto__: null };
        for (const key of Object.keys(EdgeFields.prototype)) {
          ret[key] = this[key];
        }
        return ret;
      }
    }
    delete EdgeFields.prototype.constructor;
    Object.setPrototypeOf(EdgeFields.prototype, null);
    const edge_type_field_index = meta.node_fields.indexOf('type');
    const edge_type_element_value = meta.node_fields[
      edge_type_field_index
    ].indexOf('element');
    const edge_type_field_buffer = edge_field_buffers[edge_type_field_index];
    for (let field_i = 0; field_i < meta.edge_fields.length; field_i++) {
      const field = meta.edge_fields[field_i];
      const field_buffer = edge_field_buffers[field_i];
      let handler = null;
      const field_type = meta.edge_types[field_i];
      if (Array.isArray(field_type)) {
        handler = i => field_type[field_buffer[i]];
      } else if (field_type === 'string') {
        handler = i => this.getString(field_buffer[i]);
      } else if (field_type === 'string_or_number') {
        handler = i => {
          if (edge_type_field_buffer[i] === edge_type_element_value) {
            return field_buffer[i];
          } else {
            return this.getString(field_buffer[i]);
          }
        };
      } else {
        handler = i => field_buffer[i];
      }
      Object.defineProperty(EdgeFields.prototype, field, {
        get() {
          return handler(this.index);
        },
        enumerable: true,
      });
    }
    Object.defineProperty(this, 'Node', {
      value: Node,
    });
    Object.defineProperty(this, 'Edge', {
      value: Edge,
    });
    Object.freeze(this);
  }
  static fromJSONStream(stream, fulfill, reject) {
    SplitSnapshotProvider.fromReader(
      ({
        onSnapshotInfo,
        onDone,
        onNodeField,
        onEdgeField,
        onString,
        onError,
      }) => {
        stream.pipe(
          parseSnapshotStream({
            onSnapshotInfo,
            onDone,
            onNodeField,
            onEdgeField,
            onString,
            onError,
          })
        );
      },
      fulfill,
      reject
    );
  }
  static fromReader(reader, fulfill, reject) {
    // 1MB
    const KB = 1024;
    const MB = 1024 * KB;
    let node_id_field = 0; //meta.node_fields.indexOf('id');
    let node_edge_count_field = 0; //meta.node_fields.indexOf('edge_count');
    let edge_to_node_field = 0; //meta.edge_fields.indexOf('to_node');

    let node_i = 0;
    let node_field_i = 0;
    let edge_count_total = 0;

    let edge_i = 0;
    let edge_field_i = 0;
    let edge_owner = 0;

    let string_buffer = new Uint8Array(MB);
    let string_offsets = new Uint32Array(4 * KB);
    let string_lengths = new Uint32Array(4 * KB);

    let string_i = 0;
    let string_buffer_offset = 0;
    let node_length = 0;
    let edge_length = 0;
    let node_field_buffers = null;
    let edge_field_buffers = null;
    let edge_offsets_for_nodes = null;
    let node_offsets_in_sorted_id_order = null;
    let retainer_counts_for_nodes = null;
    let retainer_offsets_for_nodes = null;
    let retainer_nodes = null;
    let retainer_edges = null;
    let node_count = 0;
    let edge_count = 0;
    let meta = null;
    reader({
      onSnapshotInfo: snapshot_info => {
        ({ node_count, edge_count, meta } = snapshot_info);
        edge_length = meta.edge_fields.length;
        node_length = meta.node_fields.length;
        node_field_buffers = Array.from(
          {
            length: node_length,
          },
          _ => new Uint32Array(node_count)
        );
        edge_field_buffers = Array.from(
          {
            length: edge_length,
          },
          _ => new Uint32Array(edge_count)
        );

        node_offsets_in_sorted_id_order = new Uint32Array(node_count);
        edge_offsets_for_nodes = new Uint32Array(node_count);
        retainer_counts_for_nodes = new Uint32Array(node_count);
        retainer_offsets_for_nodes = new Uint32Array(node_count);
        retainer_nodes = new Uint32Array(edge_count);
        retainer_edges = new Uint32Array(edge_count);
        node_id_field = meta.node_fields.indexOf('id');
        node_edge_count_field = meta.node_fields.indexOf('edge_count');
        edge_to_node_field = meta.edge_fields.indexOf('to_node');
      },
      onNodeField: value => {
        node_field_buffers[node_field_i][node_i] = value;
        // recording sorted ids
        if (node_field_i === node_id_field) {
          let other_i = node_i - 1;
          if (value === 75) debugger;
          if (other_i >= 0) {
            let other_offset = node_offsets_in_sorted_id_order[other_i];
            let other_id =
              node_field_buffers[node_id_field][other_offset];
            while (other_i >= 0 && value < other_id) {
              node_offsets_in_sorted_id_order[other_i + 1] =
                node_offsets_in_sorted_id_order[other_i];
              other_i--;
              other_offset = node_offsets_in_sorted_id_order[other_i];
              other_id =
                node_field_buffers[node_id_field][other_offset];
            }
          }
          node_offsets_in_sorted_id_order[other_i + 1] = node_i;
          // tracking where in edge buffer node edges are
        } else if (node_field_i === node_edge_count_field) {
          edge_offsets_for_nodes[node_i] = edge_count_total;
          edge_count_total += value;
        }
        node_field_i = (node_field_i + 1) % node_length;
        if (node_field_i === 0) node_i++;
      },
      onEdgeField: value => {
        // can't eagerly sort retainers, but we can setup counts
        // to quickly do them afterwards
        if (edge_field_i === edge_to_node_field) {
          // convert to_node to our index system
          value = (value / node_length) | 0;
          if (
            edge_i >=
            edge_offsets_for_nodes[edge_owner] +
              node_field_buffers[node_edge_count_field][edge_owner]
          ) {
            edge_owner++;
          }
          retainer_counts_for_nodes[value]++;
        }
        edge_field_buffers[edge_field_i][edge_i] = value;
        edge_field_i = (edge_field_i + 1) % edge_length;
        if (edge_field_i === 0) edge_i++;
      },
      onString: str => {
        let need_bytes =
          str.length + string_buffer_offset - string_buffer.byteLength;
        if (need_bytes > 0) {
          // Align to MB boundary
          const new_buffer_length =
            string_buffer.byteLength + need_bytes + (MB - need_bytes % MB);
          const new_buffer = new Uint8Array(new_buffer_length);
          new_buffer.set(string_buffer);
          string_buffer = new_buffer;
        }
        for (let i = 0; i < str.length; i++) {
          string_buffer[string_buffer_offset + i] = str.charCodeAt(i);
        }
        if (string_i > string_offsets.length) {
          const new_string_offsets = new Uint32Array(
            string_offsets.length + 4 * KB
          );
          const new_string_lengths = new Uint32Array(
            string_lengths.length + 4 * KB
          );
          new_string_offsets.set(string_offsets);
          new_string_lengths.set(string_lengths);
          string_offsets = new_string_offsets;
          string_lengths = new_string_lengths;
        }
        string_offsets[string_i] = string_buffer_offset;
        string_lengths[string_i] = str.length;
        string_buffer_offset += str.length;
        string_i++;
      },
      onDone: () => {
        const final_string_buffer = new Uint8Array(string_buffer_offset);
        final_string_buffer.set(
          new Uint8Array(string_buffer.buffer, 0, string_buffer_offset)
        );
        const final_string_offsets = new Uint32Array(string_i);
        final_string_offsets.set(
          new Uint32Array(string_offsets.buffer, 0, string_i)
        );
        const final_string_lengths = new Uint32Array(string_i);
        final_string_lengths.set(
          new Uint32Array(string_lengths.buffer, 0, string_i)
        );
        let retainer_offset = 0;
        for (let i = 0; i < retainer_counts_for_nodes.length; i++) {
          const retainer_count = retainer_counts_for_nodes[i];
          retainer_offsets_for_nodes[i] = retainer_offset;
          retainer_offset += retainer_count;
        }
        let retainers_seen = new Uint32Array(retainer_counts_for_nodes.length);
        let edge_owner = 0;
        for (let edge_i = 0; edge_i < edge_count; edge_i++) {
          const to_node = edge_field_buffers[edge_to_node_field][edge_i];
          const offset =
            retainer_offsets_for_nodes[to_node] + retainers_seen[to_node];
          retainers_seen[to_node]++;
          if (
            edge_i >=
            edge_offsets_for_nodes[edge_owner] +
              node_field_buffers[node_edge_count_field][edge_owner]
          ) {
            edge_owner++;
          }
          retainer_nodes[offset] = edge_owner;
          retainer_edges[offset] = edge_i;
        }
        fulfill(
          new SplitSnapshotProvider({
            meta,
            node_count,
            edge_count,
            node_field_buffers,
            edge_field_buffers,
            node_offsets_in_sorted_id_order,
            edge_offsets_for_nodes,

            retainer_offsets_for_nodes,
            retainer_counts_for_nodes,
            retainer_nodes,
            retainer_edges,
            string_buffer: final_string_buffer,
            string_offsets: final_string_offsets,
            string_lengths: final_string_lengths,
          })
        );
      },
      onError: error => {
        reject;
      },
    });
  }
  *nodes() {
    for (let i = 0; i < this.node_count; i++) {
      yield this.getNode(i);
    }
  }
  *nodesSortedById() {
    for (const i of this.node_offsets_in_sorted_id_order) {
      yield this.getNode(i);
    }
  }
  getNode(i = required()) {
    if (typeof i !== 'number' || (i | 0) !== i) {
      throw TypeError('expected whole number');
    }
    return new this.Node(i);
  }
  getNodeById(id = required()) {
    if (typeof id !== 'number' || (id | 0) !== id) {
      throw TypeError('expected whole number');
    }
    const found = this.node_field_buffers[this.node_id_field].indexOf(id);
    return found === -1
      ? null
      : this.getNode(this.node_offsets_in_sorted_id_order[found]);
  }
  getEdge(i = required()) {
    if (typeof i !== 'number' || (i | 0) !== i) {
      throw TypeError('expected whole number');
    }
    return new this.Edge(i);
  }
  getString(i = required()) {
    if (typeof i !== 'number' || (i | 0) !== i) {
      throw TypeError('expected whole number');
    }
    return new Buffer(
      this.string_buffer.slice(
        this.string_offsets[i],
        this.string_offsets[i] + this.string_lengths[i]
      ),
      'utf8'
    ).toString();
  }
}
Object.freeze(SplitSnapshotProvider);
Object.freeze(SplitSnapshotProvider.prototype);
