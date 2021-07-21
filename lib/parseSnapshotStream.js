import clarinet from 'clarinet';
import { writeFileSync } from 'fs';
/**
 * @typedef {Object} parseSnapshotStreamCallbacks
 * @property {(snapshot_info: {meta:Object}) => void} onsnapshot_info
 * @property {(node_buffer: Buffer) => void} onnode
 * @property {(edge_buffer: Buffer) => void} onedge
 * @property {(location_buffer: Buffer) => void} onlocation
 * @property {(sample_buffer: Buffer) => void} onsample
 * @property {(str: string) => void} onstring
 */
/**
 * Create a writable stream for parsing JSON.
 *
 * @param parseSnapshotStreamCallbacks callbacks t
 * @return {import('stream').Writable}
 */
export default function parseSnapshotStream({
  onsnapshot_info = Function.prototype,
  onnode = Function.prototype,
  onedge = Function.prototype,
  onlocation = Function.prototype,
  onstring = Function.prototype,
  onsample = Function.prototype,
  ontracefninfo = Function.prototype,
  // (buffer, [push,pop]) push
  ontraceframe_and_state = Function.prototype,
}) {
  const parser = clarinet.createStream();

  /** @type {string[]} */
  const parser_keys = [];
  const key = (/** @type {string } */ k) => {
    return parser_keys.push(k);
  };
  const unkey = () => {
    return parser_keys.pop();
  };

  /** @type {Array<string | number>} */
  const parser_path = [];
  const push = value => {
    if (parser_path.length) {
      const target = parser_path[parser_path.length - 1];
      const field = parser_keys[parser_keys.length - 1];
      if (Array.isArray(target)) {
        parser_keys[parser_keys.length - 1]++;
      }
      target[field] = value;
    } else {
      parser_path.push(value);
    }
  };
  const nest = value => {
    let first = parser_path.length === 0;
    push(value);
    if (!first) parser_path.push(value);
  };
  const pop = () => {
    return parser_path.pop();
  };

  let node_fields_size = 0;
  let edge_fields_size = 0;
  let location_fields_size = 0;
  let field_index = 0;
  /** @type {Buffer | null} */
  let buffer = null;
  let innodes = false;
  let inedges = false;
  let inlocations = false;
  let instrings = false;
  let insamples = false;
  const atsnapshot = () => {
    return parser_keys.length === 1 && parser_keys[0] === 'snapshot';
  };
  const insnapshot = () => {
    return parser_keys.length >= 1 && parser_keys[0] === 'snapshot';
  };
  const atnodes = () => {
    return parser_keys.length === 1 && parser_keys[0] === 'nodes';
  };
  const atedges = () => {
    return parser_keys.length === 1 && parser_keys[0] === 'edges';
  };
  const atlocations = () => {
    return parser_keys.length === 1 && parser_keys[0] === 'locations';
  };
  const atsamples = () => {
    return parser_keys.length === 1 && parser_keys[0] === 'samples';
  };
  const atstrings = () => {
    return parser_keys.length === 1 && parser_keys[0] === 'strings';
  };
  parser.on('openobject', first_key => {
    if (insnapshot()) nest({});
    if (typeof first_key === 'string') key(first_key);
    else key(undefined);
  });
  parser.on('closeobject', () => {
    unkey();
    if (atsnapshot()) {
      const snapshot = pop();
      node_fields_size = snapshot.meta.node_fields.length * 4;
      edge_fields_size = snapshot.meta.edge_fields.length * 4;
      location_fields_size = snapshot.meta.location_fields.length * 4;
      onsnapshot_info(snapshot);
    } else if (insnapshot()) pop();
  });
  parser.on('openarray', () => {
    if (insnapshot()) nest([]);
    else if (atnodes()) {
      innodes = true;
      buffer = Buffer.alloc(node_fields_size);
      field_index = 0;
    } else if (atedges()) {
      inedges = true;
      buffer = Buffer.alloc(edge_fields_size);
      field_index = 0;
    } else if (atlocations()) {
      inlocations = true;
      buffer = Buffer.alloc(location_fields_size);
      field_index = 0;
    } else if (atsamples()) {
      insamples = true;
      buffer = Buffer.alloc(4 * 2);
      field_index = 0;
    } else if (atstrings()) {
      instrings = true;
    }
    key(0);
  });
  parser.on('closearray', () => {
    unkey();
    if (insnapshot()) pop();
    else if (atnodes()) {
      innodes = false;
      onnode(null);
    } else if (atedges()) {
      inedges = false;
      onedge(null);
    } else if (atlocations()) {
      inlocations = false;
      onlocation(null);
    } else if (atsamples()) {
      insamples = false;
      onsample(null);
    } else if (atstrings()) {
      instrings = false;
      onstring(null);
    }
  });
  parser.on('key', new_key => {
    unkey();
    key(new_key);
  });
  parser.on('value', value => {
    if (innodes) {
      buffer.writeUInt32BE(value, field_index);
      field_index = (field_index + 4) % node_fields_size;
      if (field_index === 0) {
        onnode(buffer);
        buffer = Buffer.alloc(node_fields_size);
      }
    } else if (inedges) {
      buffer.writeUInt32BE(value, field_index);
      field_index = (field_index + 4) % edge_fields_size;
      if (field_index === 0) {
        onedge(buffer);
        buffer = Buffer.alloc(edge_fields_size);
      }
    } else if (inlocations) {
      buffer.writeUInt32BE(value, field_index);
      field_index = (field_index + 4) % location_fields_size;
      if (field_index === 0) {
        onlocation(buffer);
        buffer = Buffer.alloc(location_fields_size);
      }
    } else if (insamples) {
      buffer.writeUInt32BE(value, field_index);
      field_index = (field_index + 4) % (4 * 2);
      if (field_index === 0) {
        onsample(buffer);
        buffer = Buffer.alloc(4 * 2);
      }
    } else if (instrings) {
      onstring(value);
    } else if (insnapshot()) push(value);
  });
  return parser;
}
