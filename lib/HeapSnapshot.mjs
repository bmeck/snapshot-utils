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

  scan({ onNodeOpen = Function.prototype, onNodeClose = Function.prototype }) {
    const snapshot = this;
    return (function* scan() {
      for (let i = 0; i < snapshot.provider.snapshot.node_count; i++) {
        const offset = snapshot.provider.sorted_ids[i * 2];
        const id = snapshot.provider.sorted_ids[i * 2 + 1];
        const node = snapshot.getNode(offset);
        onNodeOpen(node);
        yield;
        onNodeClose(node);
      }
    })();
  }

  /**
   * @typedef {Object} WalkCallbacks
   * @property {function(node: NodeResult)} onNodeOpen callback called when a Node
   *   is first encountered
   * @property {function(edge: EdgeResult)} onEdge callback called when traversing
   *   an Edge
   * @property {function(node: NodeResult)} onNodeSkipped callback called when a Node
   *   is skipped because it has already been encountered
   * @property {function(node: NodeResult)} onNodeClose callback called when all
   *   children of a Node are guaranteed to have been encountered
   */

  /**
   * Helper function that performs a depth first pre order traversal of
   * the nodes of a HeapSnapshot. This will only visit each Node once, but
   * will visit all Edges of a HeapSnapshot. Since this can be a costly
   * operation it uses an iterator to allow chunked processing.
   *
   * @example
   * let walker = walk(console.log);
   * // the iterator does not return a value it is purely a controller
   * for (const _ of walker) {}
   *
   * @param {WalkCallbacks} callbacks
   * @return {Iterator} iterator to continue walking by calling .next
   */
  walk({
    onNodeOpen = Function.prototype,
    onEdge = Function.prototype,
    onNodeSkipped = Function.prototype,
    onNodeClose = Function.prototype,
  }) {
    const snapshot = this;
    return (function* walk() {
      // Heaps are graphs, they can contain cycles! So we use a Set to
      // keep track of Nodes we have already seen.
      const visited = new Set();

      // We will be keeping a list of all the Edges we need to cross
      // still in an array.
      const nodes_to_visit = [snapshot.getNode(0)];
      const edge_indices = [0];

      onNodeOpen(nodes_to_visit[0]);

      do {
        // While walking we will grab the first Edge off our list
        const edge_index = edge_indices[edge_indices.length - 1];
        const owner = nodes_to_visit[nodes_to_visit.length - 1];
        if (edge_index === owner.fields.edge_count) {
          onNodeClose(owner);
          yield;
          nodes_to_visit.pop();
          edge_indices.pop();
          continue;
        } else {
          edge_indices[edge_indices.length - 1] += 1;
        }
        const edge_to_walk = owner.getEdge(edge_index);

        onEdge(edge_to_walk, owner);
        yield;

        // We grab the Node that this edge points to
        const node = edge_to_walk.node;

        // We want to be sure we don't start a cycle so we skip
        // Nodes we have already visited (but not Edges to those Nodes
        // in this example)
        if (visited.has(node.node_index)) {
          onNodeSkipped(node);
          continue;
        }
        visited.add(node.node_index);

        // Add all of the edges of a node to the list of Edges we
        // need to visit
        nodes_to_visit.push(node);
        edge_indices.push(0);

        if (node.node_index !== 0) onNodeOpen(node);
        yield;
      } while (nodes_to_visit.length);
    })();
  }

  /**
   * Walks over all the Samples in the HeapSnapshot in order.
   *
   * @return {Iterator<Sample>} Iterator to walk over all of the Samples.
   */
  samples() {
    const snapshot = this;
    return (function* samples() {
      const samples_arr_length = snapshot.provider.getSampleArraySize();
      for (let i = 0; i < samples_arr_length; i++) {
        yield snapshot.getSample(i);
      }
    })();
  }

  /**
   * Gets a Sample by index.
   *
   * @example
   * const first = snapshot.getSample(0);
   * const second = snapshot.getSample(1);
   * console.log('delay', second.time - first.time);
   *
   * @param {number} sample_index
   * @return {Sample}
   */
  getSample(sample_index) {
    if (sample_index > this.provider.getSampleArraySize()) {
      return null;
    }
    const sample_buffer = this.provider.getSampleBuffer(sample_index);
    const sample = new Sample(sample_buffer);
    return sample;
  }

  /**
   * @typedef {Object} NodeResult
   * @property {Node} fields
   * @property {number} node_index Index that can be used with getNode to get this Node.
   * @property {number} edge_index Index that can be used to get the first Edge of this Node.
   * @property {function(index: Number):EdgeResult} getEdge Get the specified Edge of this node.
   * @property {function():EdgeIterator} walkEdges Helper for iterating the edges of a Node.
   */
  /**
   * Gets a Node by index, not by ID. The root Node is at index 0.
   *
   * @example
   * const root = snapshot.getNode(0);
   *
   * @param {number} node_index
   * @return {NodeResult}
   */
  getNode(node_index) {
    if (node_index >= this.provider.getNodeArraySize()) {
      return null;
    }
    const node_buffer = this.provider.getNodeBuffer(node_index);
    const node = new this.Node(node_buffer);
    const edge_index = node_buffer.readUInt32BE(node_buffer.length - 4);
    const self = this;
    return Object.defineProperty(
      {
        fields: node,
        node_index,
        edge_index,
        getEdge(i) {
          const edge_count = node.edge_count;
          if (i > edge_count) {
            throw new RangeError('invalid edge number');
          }
          const edge_size = self.meta.edge_fields.length;
          const index = (edge_index + i) * edge_size;
          return self.getEdge(index);
        },
        getTrace() {
          return {
            id: -1,
            line: -1,
            column: -1,
          };
        },
      },
      'edges',
      {
        enumerable: false,
        get: () => {
          function* edges() {
            const edge_count = node.edge_count;
            const edge_size = self.meta.edge_fields.length;
            for (let i = 0; i < edge_count; i++) {
              const index = (edge_index + i) * edge_size;
              const e = self.getEdge(index);
              if (e != null) {
                yield e;
              }
            }
          }
          return edges();
        },
      }
    );
  }

  /**
   * Gets a Node by ID. This can be *SIGNIFICANTLY SLOWER* than looking up the Node by index since IDs are sparse.
   *
   * @example
   * const myNode = snapshot.getNodeById(42);
   *
   * @param {number} node_id
   * @return {NodeResult}
   */
  getNodeById(node_id) {
    const node_arr_length = this.provider.getNodeArraySize();
    const node_fields_len = this.meta.node_fields.length;
    const last_id = this.provider.sorted_ids[
      this.provider.sorted_ids.length - 1
    ];
    // make a best guess given known distribution
    let node_index = Math.ceil(node_id / last_id) * node_fields_len;
    const incr =
      this.getNode(node_index).fields.id < node_id
        ? node_fields_len
        : -node_fields_len;
    while (node_index >= 0 && node_index < node_arr_length) {
      const node = this.getNode(node_index);
      const id = node.fields.id;
      if (id === node_id) {
        return node;
      }
      node_index += incr;
    }
  }

  /**
   * @typedef {Object} EdgeResult
   * @property {Edge} fields
   * @property {number} edge_index Index that can be used with getEdge to get this Edge.
   * @property {number} node_index Index that can be used with getNode to get the owner of this Edge.
   * @property {function():NodeResult} getNode Helper for getting the Node this Edge points to.
   */
  /**
   * Gets an Edge by index. This should only be used in conjuction with a Node object.
   * @private
   * @param {number} edge_index Index of the Edge we wish to get a hold of.
   * @return {EdgeResult}
   */
  getEdge(edge_index) {
    if (
      edge_index >
      this.meta.edge_fields.length * this.provider.getEdgeArraySize()
    ) {
      return null;
    }
    const edge_buffer = this.provider.getEdgeBuffer(edge_index);
    const fields = new this.Edge(edge_buffer);
    const self = this;
    return Object.defineProperty(
      {
        fields,
        edge_index,
      },
      'node',
      {
        enumerable: false,
        get: () => this.getNode(fields.to_node),
      }
    );
  }
}
/**
 * @typedef {Object} Sample
 * A Sample class for a HeapSnapshot.
 * @property {number} timestamp Timestamp of this sample in nanoseconds. The first sample will generally have a timestamp of 0 and you must compute the time differences accordingly.
 * @property {number} lastAssignedId The largest `node.fields.id` visible when this sample was taken. Since `id`s only increment, all `id`s less than this were allocated prior to this sample.
 */
export class Sample {
  /**
   * @private
   */
  constructor(buffer) {
    this._buffer = buffer;
  }
  /**
   * @private
   */
  inspect() {
    let ret = '';
    let i = 0;
    for (const field of ['timestamp', 'lastAssignedId']) {
      ret +=
        ' ' +
        [
          field,
          this[field],
          this._buffer.slice(i * 4, i * 4 + 4).toString('hex'),
        ].join(':');
      i++;
    }
    return `HeapSnapshot::Sample${ret}`;
  }
  /**
   * @private
   */
  get timestamp() {
    return this._buffer.readUInt32BE(0);
  }
  /**
   * @private
   */
  get lastAssignedId() {
    return this._buffer.readUInt32BE(4);
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
      Object.defineProperty(this, '_buffer', { value: buffer });
    }
    toJSON() {
      return meta.node_fields.reduce((o, k) => {
        o[k] = this[k];
        return o;
      }, {});
    }
    inspect() {
      let ret = '';
      let i = 0;
      for (const field of meta.node_fields) {
        ret +=
          ' ' +
          [
            field,
            this[field],
            this._buffer.slice(i * 4, i * 4 + 4).toString('hex'),
          ].join(':');
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
      if (field === 'type') {
        // v8 bug: https://codereview.chromium.org/1450463002/#
        field_type[0x0c] = 'symbol';
        field_type[0x0d] = 'simd';
      }
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        get() {
          return field_type[this._buffer.readUInt32BE(field_index)];
        },
      });
    } else if (field_type === 'string') {
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        get() {
          return provider.getString(this._buffer.readUInt32BE(field_index));
        },
      });
    } else {
      Object.defineProperty(Node.prototype, field, {
        enumerable: true,
        get() {
          return this._buffer.readUInt32BE(field_index);
        },
      });
    }
    i++;
  }
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
      Object.defineProperty(this, '_buffer', { value: buffer });
    }
    toJSON() {
      return meta.edge_fields.reduce((o, k) => {
        if (k === 'to_node') {
          o[k] = snapshot.getNode(this.to_node).fields.id;
        } else {
          o[k] = this[k];
        }
        return o;
      }, {});
    }
    inspect() {
      let ret = '';
      let i = 0;
      for (const field of meta.edge_fields) {
        ret +=
          ' ' +
          [
            field,
            this[field],
            this._buffer.slice(i * 4, i * 4 + 4).toString('hex'),
          ].join(':');
        i++;
      }
      ret += ' node.id:' + snapshot.getNode(this.to_node).fields.id;
      return `HeapSnapshot::Edge ${ret}`;
    }
  }
  let i = 0;
  for (let field of meta.edge_fields) {
    (() => {
      const field_index = i * 4;
      const field_type = meta.edge_types[i];
      i++;
      if (Array.isArray(field_type)) {
        Object.defineProperty(Edge.prototype, field, {
          enumerable: true,
          get() {
            return field_type[this._buffer.readUInt32BE(field_index)];
          },
        });
      } else if (field === 'name_or_index') {
        Object.defineProperty(Edge.prototype, field, {
          enumerable: true,
          get() {
            let value = this._buffer.readUInt32BE(field_index);
            if (this.type !== 'element') {
              value = provider.getString(value).toString();
            }
            return value;
          },
        });
      } else {
        Object.defineProperty(Edge.prototype, field, {
          enumerable: true,
          get() {
            return this._buffer.readUInt32BE(field_index);
          },
        });
      }
    })();
  }
  return Edge;
}
function createTraceFrameClass(provider) {
  const meta = provider.getMeta();
  class TraceFrame {
    constructor(buffer) {
      this._buffer = buffer;
    }
    parent() {}
    inspect() {
      let ret = '';
      let i = 0;
      for (const field of meta.trace_node_fields) {
        ret +=
          ' ' +
          [
            field,
            this[field],
            this._buffer.slice(i * 4, i * 4 + 4).toString('hex'),
          ].join(':');
        i++;
      }
      return `HeapSnapshot::TraceFrame ${ret}`;
    }
  }
  let i = 0;
  for (let field of meta.trace_node_fields) {
    (() => {
      const field_index = i * 4;
      Object.defineProperty(TraceFrame.prototype, field, {
        enumerable: true,
        get() {
          return this._buffer.readUInt32BE(field_index);
        },
      });
    })();
  }
  return TraceFrame;
}
function createTraceLocationClass(provider) {
  const meta = provider.getMeta();
  class TraceFrame {
    constructor(buffer) {
      this._buffer = buffer;
    }
    parent() {}
    inspect() {
      let ret = '';
      let i = 0;
      for (const field of meta.trace_node_fields) {
        ret +=
          ' ' +
          [
            field,
            this[field],
            this._buffer.slice(i * 4, i * 4 + 4).toString('hex'),
          ].join(':');
        i++;
      }
      return `HeapSnapshot::TraceFrame ${ret}`;
    }
  }
  let i = 0;
  for (let field of meta.trace_node_fields) {
    (() => {
      const field_index = i * 4;
      Object.defineProperty(TraceFrame.prototype, field, {
        enumerable: true,
        get() {
          return this._buffer.readUInt32BE(field_index);
        },
      });
    })();
  }
  return TraceFrame;
}
