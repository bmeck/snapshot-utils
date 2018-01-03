#!/usr/bin/env node --experimental-modules
import { HeapSnapshot, SplitSnapshotProvider } from '../';

// We are going to use stdin to read our snapshot
// pipe a snapshot in via: `node --experimental-modules dominators.mjs <"my.heapsnapshot"`
const stream = process.stdin;

// This is used to parse the snapshot data.
// A provider is generally not used for analyzing the snapshot.
// It is an abstraction to allow saving/loading the snapshot to different
// location.
SplitSnapshotProvider.fromStream(stream, (err, provider) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  // This gives us an API that can be used to analyze the snapshot.
  // Since snapshot data contains the structure of Nodes and Edges
  // the Node and Edge classes we obtain from this may be different
  // from different snapshots.
  const snapshot = new HeapSnapshot(provider);

  const path = [];

  let tree = null;
  const lookup = new Map();
  const $id = node => node.fields.id;
  function integrate(id) {
    if (tree == null) {
      tree = new DominatorTreeNode(null, id);
      lookup.set(id, tree);
      return;
    }
    let parent_id = path.length - 1;
    let node = new DominatorTreeNode(path[parent_id], id);
    lookup.set(id, node);
  }
  // we only ever need to reduce to immediate dominator,
  // but! me must adjust any current immediate dominator as well
  function reduce(id, max_path = path.length) {
    let subpath = path.slice(0, max_path);
    let dominator = lookup.get(id).parent;
    let adjusting = [id];
    while (lookup.has(dominator)) {
      let index = subpath.indexOf(dominator);
      if (index >= 0) {
        for (const node_id of adjusting) {
          lookup.get(node_id).parent = dominator;
        }
        break;
      }
      adjusting.push(dominator);
      dominator = lookup.get(dominator).parent;
    }
  }

  // setup the walk
  const iter = snapshot.walk({
    // first time we encounter a node we need to add
    // the full path to the dominator tree
    onNodeOpen(node) {
      const id = $id(node);
      integrate(id);
      path.push(id);
    },
    // when we encounter a node we have already seen
    // we only need to reduce the dominator tree
    onNodeSkipped(node) {
      const id = $id(node);
      reduce(id);
    },
    onNodeClose(node) {
      path.pop(node);
    },
  });
  // perform the walk
  for (const _ of iter) {
  }

  // print our lovely data
  for (const node of lookup.values()) {
    let ret = `${node.id}`;
    let parent_id = node.parent;
    while (parent_id != null && lookup.has(parent_id)) {
      ret += `->${parent_id}`;
      parent_id = lookup.get(parent_id).parent;
    }
    console.log(ret);
  }
});

class DominatorTreeNode {
  constructor(parent, id) {
    this.parent = parent;
    this.id = id;
  }
}
