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
  onSnapshotInfo = Function.prototype,
  onNodeField = Function.prototype,
  onEdgeField = Function.prototype,
  onSampleField = Function.prototype,
  onString = Function.prototype,
  onDone = Function.prototype,
  // (buffer, [push,pop]) push
  // ontraceframe_and_state = Function.prototype,
}) {
  const parser = clarinet.createStream();

  const parser_keys = [];
  const key = k => {
    return parser_keys.push(k);
  };
  const unkey = () => {
    const k = parser_keys.pop();
    return k;
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
      onSnapshotInfo(pop());
    } else if (insnapshot()) {
      pop();
    } else if (parser_keys.length === 0) {
      onDone();
    }
  });
  parser.on('openarray', () => {
    if (insnapshot()) nest([]);
    else if (atnodes()) {
      innodes = true;
    } else if (atedges()) {
      inedges = true;
    } else if (atsamples()) {
      insamples = true;
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
    } else if (atedges()) {
      inedges = false;
    } else if (atsamples()) {
      insamples = false;
    } else if (atstrings()) {
      instrings = false;
    }
  });
  parser.on('key', new_key => {
    unkey();
    key(new_key);
  });
  parser.on('value', value => {
    if (innodes) {
      onNodeField(value)
    } else if (inedges) {
      onEdgeField(value)
    } else if (insamples) {
      onSampleField(value)
    } else if (instrings) {
      onString(value);
    } else if (insnapshot()) push(value);
  });
  return parser;
}
