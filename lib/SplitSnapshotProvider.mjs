import fs from 'fs';
import path from 'path';
import parseSnapshotStream from './parseSnapshotStream';

/**
 * An implementation of working directly with snapshot data, not meant for dev consumption.
 * This implementation uses Synchronous file APIs
 */
export default class SplitSnapshotProvider {
  constructor({
    meta,
    node_count,
    edge_count,
    node_field_buffers,
    edge_field_buffers,
    node_offsets_in_sorted_id_order,
    edge_offsets_for_nodes,
    retainer_counts_for_nodes,
    retainer_nodes,
    retainer_edges,
    string_buffer,
    string_offsets,
    string_lengths,
  }) {
    const snapshot = this;
    Object.assign(this, {
      meta,
      node_count,
      edge_count,
      node_field_buffers,
      edge_field_buffers,
      node_offsets_in_sorted_id_order,
      edge_offsets_for_nodes,
      retainer_counts_for_nodes,
      retainer_nodes,
      retainer_edges,
      string_buffer,
      string_offsets,
      string_lengths,
    });
    this.Node = class Node {
      constructor(i) {
        this.i = i;
      }
      *edges() {
        for (let i = 0; i < this.field('edge_count'); i++) {
          let edge_i = edge_offsets_for_nodes[this.i] + i;
          yield snapshot.getEdge(i);
        }
      }
      *retainers() {
        for (let i = 0; i < retainer_counts_for_nodes[this.i]; i++) {
          let retainer_i = retainer_offsets_for_nodes[this.i] + i;
          yield {
            edge: snapshot.getEdge(retainer_edges[retainer_i]),
            node: snapshot.getNode(retainer_nodes[retainer_i]),
          };
        }
      }
      field(name) {
        return node_field_buffers[meta.node_fields.indexOf(name)][
          this.i
        ];
      }
    };
    this.Edge = class Edge {
      constructor(i) {
        this.i = i;
      }
      node() {
        return new snapshot.Node(this.field('to_node'));
      }
      field(name) {
        return edge_field_buffers[meta.edge_fields.indexOf(name)][
          this.i
        ];
      }
    };
  }
  static fromReader(reader, done) {
    // 1MB
    const KB = 1024;
    const MB = 1024 * KB;
    let node_id_field = 0; //meta.node_fields.indexOf('id');
    let node_edge_count_field = 0; //meta.node_fields.indexOf('edge_count');
    let edge_to_node_field = 0; //meta.edge_fields.indexOf('to_node');

    let max_node_id_seen = 0;

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
        /**
         * @private
         */
        node_field_buffers = Array.from({
          length: node_length,
        }).map(_ => new Uint32Array(node_count));
        edge_field_buffers = Array.from({
          length: edge_length,
        }).map(_ => new Uint32Array(edge_count));

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
          if (value < max_node_id_seen) {
            // value is lower than what we have seen so we
            // have to sort

            // do a reverse insertion sort since the ids are generally
            // mostly sorted already
            node_offsets_in_sorted_id_order[node_i] = node_i;
            for (let i = node_i - 1; i >= 0; i--) {
              if (node_offsets_in_sorted_id_order[i] < value) {
                break;
              } else {
                node_offsets_in_sorted_id_order[i + 1] =
                  node_offsets_in_sorted_id_order[i];
                node_offsets_in_sorted_id_order[i] = value;
              }
            }
          } else {
            node_offsets_in_sorted_id_order[node_i] = node_i;
          }
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
        done(
          new SplitSnapshotProvider({
            meta,
            node_count,
            edge_count,
            node_field_buffers,
            edge_field_buffers,
            node_offsets_in_sorted_id_order,
            edge_offsets_for_nodes,
            retainer_counts_for_nodes,
            retainer_nodes,
            retainer_edges,
            string_buffer: final_string_buffer,
            string_offsets: final_string_offsets,
            string_lengths: final_string_lengths,
          })
        );
      },
    });
  }
  getNode(i) {
    return new this.Node(i);
  }
  getEdge(i) {
    return new this.Edge(i);
  }
  getString(i) {
    return this.string_buffer.slice(this.string_offsets[i], this.string_offsets[i] + this.string_lengths[i]);
  }
}
