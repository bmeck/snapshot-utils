import {
  takeSnapshot,
  diff,
  close
} from './snapshot-api.js';
function main() {
  ////////////////////////////////
  // SNAPSHOTTING HERE          //
  ////////////////////////////////
  let before = takeSnapshot({save: 'before.heapsnapshot'});
  const leaking_1 = new class TrackerA {};
  const leaking_2 = function leaking_2() { };
  setTimeout(
    // leaking_3
    leaking_2.bind(null),
    1000
  );
  let {
    allocated
  } = diff({
    snapshotId: before,
    save: 'after.heapsnapshot'
  });

  console.log('Allocation Site, Instances Allocated');
  for (const [location, instances] of allocated) {
    console.log([location, instances].join(' '));
  }
  close();

}
main();

