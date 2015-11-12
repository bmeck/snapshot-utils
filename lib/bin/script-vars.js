import HeapSnapshot from '../HeapSnapshot';
import SplitSnapshotProvider from '../SplitSnapshotProvider';

if (process.argv[2] && process.argv[2] != '-') {
  SplitSnapshotProvider.fromDirectory(process.argv[2], go);
}
else {
  SplitSnapshotProvider.fromStream(process.stdin, go);
}
function go(err, provider) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  const snapshot = new HeapSnapshot(provider);
  
  
  let edge = {
    getNode: function () {
      return snapshot.getNode(0)
    }
  };
  
  function routeNodeEdges(node, route) {
    var i = 0;
    for (let item of node.walkEdges()) {
      const name = item.edge.name_or_index;
      if (route[name] && Object.prototype.hasOwnProperty.call(route, name)) {
        route[name](item, item.getNode());
      }
      i++;
    }
  }
  
  // phase 1, gather all indexes that always occur
  //          in paths to node
  
  // simple queue to avoid recursion for postorder traversal
  const to_walk = [{edge,path}];
  const visited = new Set();
  const dominated_by = new Map();
  const retainers = new Map();
  walk:
  while(to_walk.length) {
    let task = to_walk.shift();
    let node = task.edge.getNode();
    // each node gets its own Set for path
    const path = new Set(task.path);
    // we always add ourselves to path, since node dominators
    // include the node themselves
    path.add(node.index);
  
    if (!dominated_by.has(node.index)) {
      dominated_by.set(node.index, path);
    }
    else {
      const known_doms = dominated_by.get(node.index);
      // we want to remove any known dominators not in the current path
      for (const dom of known_doms) {
        if (!path.has(dom)) {
          known_doms.delete(dom);
        }
      }
    }
    if (visited.has(node.index)) {
      continue;
    }
    visited.add(node.index);
    const refs = new Set();
    let script_index = null;
    if (node.node.type === 'closure') {
      routeNodeEdges(node, {
        context(item, node) {
          //console.log('context', node)
          if (item.edge.type !== 'internal') return;
          Array.from(node.walkEdges())
              .filter(i=>i.edge.type==='context')
              .map(i=>i.getNode().index)
              .forEach(index=>refs.add(index));
        },
        shared(item, node) {
          if (item.edge.type !== 'internal') return;
          routeNodeEdges(node, {
            script(item, node) {
              script_index = node.index;
            }
          });
        }
      });
    }
    if (refs.size) {
      for (const ref of refs) {
        if (!retainers.has(ref)) {
          retainers.set(ref, new Set());
        }
        const retainer = retainers.get(ref);
        retainer.add(script_index);
      }
    }
    for (const edge of node.walkEdges()) {
      //console.log('GONNA VISIT', edge.edge)
      if (visited.has(edge.edge.to_node)) {
        continue;
      }
      to_walk.push({
        edge,
        path
      });
    }
  }
  // invert dominated_by to dominator=>[slave]
  const dominating = new Map();
  for (const entry of dominated_by.entries()) {
    const dominators = entry[1];
    const node_index = entry[0];
    const node = snapshot.getNode(node_index);
    const node_id = node.node.id;
    for (const dominator of dominators) {
      const dominator_node = snapshot.getNode(dominator);
      const dominator_id = dominator_node.node.id;
      if (!dominating.has(dominator_id)) {
        dominating.set(dominator_id, new Set());
      }
      const slaves = dominating.get(dominator_id);
      slaves.add({
        id: node_id,
        self_size: node.node.self_size
      });
    }
  }
  // refs, shared
  const ret = new Map();
  for (const entry of retainers.entries()) {
    const ref = snapshot.getNode(entry[0]);
    const scripts = entry[1];
    let map = ret;
    let refs;
    for (const script of scripts) {
      if (!map.has(script)) {
        map.set(script, {
          refs: refs = new Set(),
          shared: map = new Map()
        });
      }
      else {
        let info = map.get(script);
        map = info.shared;
        refs = info.refs;
      }
    }
    refs.add({
      id: ref.node.id,
      retained_size: Array.from(dominating.get(ref.node.id))
        .reduce((c,s)=>c+s.self_size, 0)
    });
  }
  process.stdout.write('[\n');
  let first = true;
  function dump(map, path) {
    for (const entry of map.entries()) {
      const script_index = entry[0];
      const info = entry[1];
      const script_node = snapshot.getNode(script_index);
      let script_name;
      routeNodeEdges(script_node,{
        name(item, node) {
          script_name = node.node.name;
        }
      });
      const next_path = path.concat({
        id: script_node.node.id,
        name: script_name
      });
      if (info.refs.size) {
        if (first) first = false;
        else process.stdout.write(', ');
        process.stdout.write(JSON.stringify({
          scripts: next_path,
          refs: Array.from(info.refs)
        }));
        process.stdout.write('\n');
      }
      if (info.shared.size) {
        dump(info.shared, next_path);
      }
    }
  }
  dump(ret, []);
  process.stdout.write(']\n');
}