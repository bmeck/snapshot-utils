export { Timeline };
class Timeline {
  constructor([...snapshots]) {
    this.snapshots = snapshots;
  }
  *masks({ onMask = Function.prototype }) {
    const snapshots = this.snapshots;
    // Tracks the current ID
    // since we are using sorted ids we always have the lowest ID left to go
    let onId = null;
    // A place to store data part snapshot
    // an array of length == snapshots.length
    let mask = null;
    const flush = () => {
      if (onId && mask) {
        if (onId === 901) debugger;
        const sizes = mask.reduce((acc, m) => {
          let delta;
          if (!m) delta = null;
          else {
            delta = m.self_size;
            if (acc.length) {
              const last = acc[acc.length - 1];
              if (typeof last === 'number') {
                delta -= last;
              }
            }
          }
          return [...acc, delta];
        }, []);
        const edges = mask.reduce((acc, m) => {
          const previous_edges = acc.length ? [...acc[acc.length - 1]] : [];
          if (m === null) {
            return [
              ...acc,
              previous_edges.map(m => {
                m.delta = 'delete';
                return m;
              }),
            ];
          }
          const snap_edges = [...m.edges];
          const changes = [];
          for (let i = 0; i < previous_edges.length; i++) {
            const prev = previous_edges[i].edge;
            const same_i = snap_edges.findIndex(_ => {
              return (
                _ &&
                _.fields.name_or_index === prev.fields.name_or_index &&
                _.fields.type === prev.fields.type
              );
            });
            if (same_i !== -1) {
              const same = snap_edges[same_i];
              previous_edges[i] = null;
              snap_edges[same_i] = null;
              if (same.fields.to_node !== prev.fields.to_node) {
                changes.push({
                  delta: 'change',
                  edge: same,
                });
              }
            }
          }
          return [
            ...acc,
            [
              ...previous_edges.filter(Boolean).map(({ edge }) => ({
                delta: 'delete',
                edge,
              })),
              ...changes,
              ...snap_edges.filter(Boolean).map(edge => ({
                delta: 'add',
                edge,
              })),
            ],
          ];
        }, []);
        onMask({
          node: onId,
          sizes,
          edges,
        });
      }
    };
    const scans = snapshots.map((snapshot, i) =>
      snapshot.scan({
        onNodeOpen(node) {
          if (!node) return;
          values[i] = node;
        },
        onNodeClose(node) {
          if (!node) return;
          const id = node.fields.id;
          if (onId !== null && onId !== id) {
            throw new Error('WTF');
          }
          mask[i] = {
            self_size: node.fields.self_size,
            edges: [...node.edges],
          };
        },
      })
    );
    const values = Array.from({ length: snapshots.length }).fill(null);
    // while some scans are not done
    while (scans.some(s => Boolean(s))) {
      // find the current values index that is the minimum
      // value of id
      // use -Infinity if there is a matching scan but no iterated value
      //   so that we always get values array populated ASAP
      // use Infinity if there is no matching scan
      //   so that we ignore scans that are "done"
      const min = Math.min(
        ...values.map((v, i) => {
          if (v) {
            return v.fields.id;
          }
          return scans[i] === null ? Infinity : -Infinity;
        })
      );
      // find the index of the min value
      const next = values.findIndex((v, i) => {
        return !v ? scans[i] !== null : v.fields.id === min;
      });
      // if we are not starting up a new iterator
      // we need to set onId to the current min id
      //
      // this relies on there always being a matching id of "1"
      // in the snapshots
      if (isFinite(min) && min !== onId) {
        flush();
        yield;
        mask = Array.from({ length: snapshots.length }).fill(null);
        onId = min;
      }
      const { done } = scans[next].next();
      // remove scans when they are done, but do not break the loop
      if (done) {
        scans[next] = null;
        values[next] = null;
      }
    }
    flush();
    yield;
  }
}
