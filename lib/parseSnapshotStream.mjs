import clarinet from 'clarinet';
/**
 * @typedef {Object} parseSnapshotStreamCallbacks
 * @property {function(snapshot_info: {meta:Object})} onsnapshot_info
 * @property {function(node_buffer: Buffer)} onnode
 * @property {function(edge_buffer: Buffer)} onedge
 * @property {function(sample_buffer: Buffer)} onsample
 * @property {function(str: string)} onstring
 */
/**
 * Create a writable stream for parsing JSON.
 *
 * @param parseSnapshotStreamCallbacks callbacks t
 * @return {undefined}
 */
export default function parseSnapshotStream({
  onsnapshot_info = Function.prototype,
  onnode = Function.prototype,
  onedge = Function.prototype,
  onstring = Function.prototype,
  onsample = Function.prototype,
  ontracefninfo = Function.prototype,
  // (buffer, [push,pop]) push
  ontraceframe_and_state = Function.prototype,
}) {
  const parser = clarinet.createStream();

  const parser_keys = [];
  const key = k => {
    return parser_keys.push(k);
  };
  const unkey = () => {
    return parser_keys.pop();
  };

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
  let field_index = 0;
  let buffer = null;
  let innodes = false;
  let inedges = false;
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
      onsnapshot_info(snapshot);
    } else if (insnapshot()) pop();
  });
  parser.on('openarray', () => {
    if (insnapshot()) nest([]);
    else if (atnodes()) {
      innodes = true;
      buffer = new Buffer(node_fields_size);
      field_index = 0;
    } else if (atedges()) {
      inedges = true;
      buffer = new Buffer(edge_fields_size);
      field_index = 0;
    } else if (atsamples()) {
      insamples = true;
      buffer = new Buffer(4 * 2);
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
        buffer = new Buffer(node_fields_size);
      }
    } else if (inedges) {
      buffer.writeUInt32BE(value, field_index);
      field_index = (field_index + 4) % edge_fields_size;
      if (field_index === 0) {
        onedge(buffer);
        buffer = new Buffer(edge_fields_size);
      }
    } else if (insamples) {
      buffer.writeUInt32BE(value, field_index);
      field_index = (field_index + 4) % (4 * 2);
      if (field_index === 0) {
        onsample(buffer);
        buffer = new Buffer(4 * 2);
      }
    } else if (instrings) {
      onstring(value);
    } else if (insnapshot()) push(value);
  });
  return parser;
}
