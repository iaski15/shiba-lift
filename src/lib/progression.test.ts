import assert from 'node:assert/strict';
import { suggest, isPR, e1rm } from './progression';

const r = { rep_min: 8, rep_max: 12, increment: 2.5 };

// not all sets at top of range -> +1 rep, same weight
assert.deepEqual(suggest([{ weight: 60, reps: 12 }, { weight: 60, reps: 10 }], r), [
  { weight: 60, reps: 12 },
  { weight: 60, reps: 11 },
]);
// all working sets at rep_max -> add weight, reset reps; warmup untouched
assert.deepEqual(suggest([{ weight: 20, reps: 10 }, { weight: 60, reps: 12 }, { weight: 60, reps: 12 }], r), [
  { weight: 20, reps: 10 },
  { weight: 62.5, reps: 8 },
  { weight: 62.5, reps: 8 },
]);
assert.deepEqual(suggest([], r), []);

const hist = [{ weight: 100, reps: 5 }, { weight: 80, reps: 10 }];
assert.equal(isPR({ weight: 105, reps: 1 }, hist), 'weight');
assert.equal(isPR({ weight: 100, reps: 6 }, hist), 'e1rm');
assert.equal(isPR({ weight: 100, reps: 5 }, hist), null);
assert.equal(isPR({ weight: 50, reps: 5 }, hist), null);
assert.equal(isPR({ weight: 0, reps: 20 }, [{ weight: 0, reps: 15 }]), 'reps'); // bodyweight
assert.equal(isPR({ weight: 0, reps: 10 }, [{ weight: 0, reps: 15 }]), null);
assert.equal(isPR({ weight: 100, reps: 5 }, []), null);
assert.equal(e1rm({ weight: 100, reps: 1 }), 100);

console.log('progression ok 🐕');
