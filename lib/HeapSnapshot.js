/**
 * Representation for iterating over a snapshot's Nodes and Edges.
 * The structure of a snapshot's Node and Edge is defined within the contents of the snapshot.
 */
export default class HeapSnapshot {
  /**
   * @param {SplitSnapshotProvider} provider Snapshot data provider
   */
  constructor(provider) {
    /**
     * @private
     */
    this.meta = provider.getMeta();
    /**
     * @private
     */
    this.Node = createNodeClass(this, provider);
    /**
     * @private
     */
    this.Edge = createEdgeClass(this, provider);
    /**
     * @private
     */
    this.provider = provider;
  }

  /**
  * @typedef {Object} NodeResult
  * @property {Node} fields
  * @property {number} node_index Index that can be used with getNode to get this Node.
  * @property {number} edge_index Index that can be used to get the first Edge of this Node.
  * @property {function():EdgeIterator} walkEdges Helper for iterating the edges of a Node.
  */
  /**
  * Gets a Node by index, not by ID. The root Node is at index 0.
  * @param {number} node_index
  * @return {NodeResult}
  */
  getNode(node_index) {
    if (node_index > this.provider.getNodeArraySize()) {
      return null;
    }
    const node_buffer = this.provider.getNodeBuffer(node_index);
    const node = new this.Node(node_buffer);
    const edge_index = node_buffer.readUInt32BE(node_buffer.length - 4);
    const self = this;
    return {
      fields: node,
      node_index,
      edge_index,
      *walkEdges() {
        let edge_count = node.edge_count;
        let edge_size = self.meta.edge_fields.length;
        for (let i = 0; i < edge_count; i++) {
          let index = (edge_index + i) * edge_size;
          let e = self.getEdge(index);
          if (e != null) {
            yield e;
          }
        }
      }
    };
  }

  /**
  * @typedef {Object} EdgeResult
  * @property {Edge} fields
  * @property {number} index Index that can be used with getEdge to get this Edge.
  * @property {function():NodeResult} getNode Helper for getting the Node this Edge points to.
  */
  /**
  * Gets an Edge by index. This should only be used in conjuction with a Node object.
  * @param {number} edge_index Index of the Edge we wish to get a hold of.
  * @return {EdgeResult}
  */
  getEdge(edge_index) {
    if (edge_index > this.provider.getEdgeArraySize()) {
      return null;
    }
    const edge_buffer = this.provider.getEdgeBuffer(edge_index);
    const fields = new this.Edge(edge_buffer);
    const self = this;
    return {
      fields,
      edge_index,
      getNode() {
        return self.getNode(fields.to_node);
      }
    };
  }
}
/**
 * Generates an Node class tailored for HeapSnapshot. These can vary between snapshots.
 * @param {HeapSnapshot} snapshot HeapSnapshot that created this Node class
 * @param {SplitSnapshotProvider} provider Our snapshot data
 */
function createNodeClass(snapshot, provider) {
  const meta = provider.getMeta();
  class Node {
    constructor(buffer) {
      this._buffer = buffer;
    }
    inspect() {
      let ret = '';
      let i = 0;
      for (const field of meta.node_fields) {
        ret += ' '+[field, this[field], this._buffer.slice(i * 4, i * 4 + 4).toString('hex')].join(':');
        i++;
      }
      return `HeapSnapshot::Node${ret}`;
    }
  }
  let i = 0;
  for (const field of meta.node_fields) {
    let field_index = i * 4;
    let field_type = meta.node_types[i];
    if (Array.isArray(field_type)) {
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        get() {
          return field_type[this._buffer.readUInt32BE(field_index)];
        }
      });
    }
    else if (field_type === 'string') {
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        get() {
          return provider.getString(this._buffer.readUInt32BE(field_index));
        }
      });
    }
    else {
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        get() {
          return this._buffer.readUInt32BE(field_index);
        }
      });
    }
    i++;
  };
  return Node;
}
/**
 * Generates an Edge class tailored for HeapSnapshot. These can vary between snapshots.
 * @param {HeapSnapshot} snapshot HeapSnapshot that created this Edge class
 * @param {SplitSnapshotProvider} provider Our snapshot data
 */
function createEdgeClass(snapshot, provider) {
  const meta = provider.getMeta();
  class Edge {
    constructor(buffer) {
      this._buffer = buffer;
    }
    inspect() {
      let ret = '';
      let i = 0;
      for (const field of meta.edge_fields) {
        ret += ' '+[field, this[field], this._buffer.slice(i * 4, i * 4 + 4).toString('hex')].join(':');
        i++;
      }
      ret += ' node.id:' + snapshot.getNode(this.to_node).node.id;
      return `HeapSnapshot::Edge ${ret}`;
    }
  }
  let i = 0;
  for (let field of meta.edge_fields) {
    (function(){ 
    const field_index = i * 4;
    const field_type = meta.edge_types[i];
    i++;
    if (Array.isArray(field_type)) {
      Object.defineProperty(Edge.prototype, field, {
        enumerable: true,
        get() {
          return field_type[this._buffer.readUInt32BE(field_index)];
        }
      });
    }
    else if (field === 'name_or_index') {
      Object.defineProperty(Edge.prototype, field, {
        enumerable: true,
        get() {
          let value = this._buffer.readUInt32BE(field_index);
          if (this.type !== 'element') {
            value = provider.getString(value).toString();
          }
          return value;
        }
      });
    }
    else {
      Object.defineProperty(Edge.prototype, field, {
        enumerable: true,
        get() {
          return this._buffer.readUInt32BE(field_index);
        }
      });
    }
    })();
  };
  return Edge;
}