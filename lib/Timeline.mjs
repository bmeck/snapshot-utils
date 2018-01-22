export { Timeline };
class Timeline {
  constructor([...snapshots]) {
    this.snapshots = snapshots;
  }
  *masks({ onMask = Function.prototype }) {
    const snapshots = this.snapshots;
    let mask = null;
    const iters = snapshots.map(snapshot => snapshot.nodesSortedById());
    const steps = Array.from(iters, iter => iter.next());
    let last_id = null;
    while (true) {
      let i = 0;
      let min_i = -1;
      let min_id = Infinity;
      let min_node = null;
      for (; i < steps.length; i++) {
        if (steps[i].done === true) {
          continue;
        } else {
          const node = steps[i].value;
          const node_id = node.fields().id;
          // console.log('cmp', node_id, min_id, Boolean(node_id < min_id))
          if (node_id < min_id) {
            min_node = node;
            min_id = node_id;
            min_i = i;
          }
        }
      }
      if (min_i === -1) break;
      steps[min_i] = iters[min_i].next();

      if (min_id !== last_id) {
        if (mask !== null) {
          yield;
          onMask(mask);
        }
        mask = Array.from({length: iters.length}, () => null);
        last_id = min_id;
      }
      mask[min_i] = min_node;
    }
    if (mask !== null) {
      yield;
      onMask(mask);
    }
  }
}
