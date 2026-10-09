import assert from 'node:assert/strict';
import { suggest, isPR, e1rm, parseRange } from './progression';

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
// 7-formula average: 100 kg x 5 lands between Brzycki (112.5) and Mayhew (~119)
const five = e1rm({ weight: 100, reps: 5 });
assert.ok(five > 114 && five < 117, String(five));
assert.ok(e1rm({ weight: 100, reps: 6 }) > five); // more reps = higher estimate
assert.equal(e1rm({ weight: 100, reps: 13 }), 0); // too many reps to estimate
assert.equal(e1rm({ weight: 0, reps: 10 }), 0); // bodyweight
// a 20-rep set gives no 1RM estimate, so it can only ever be a reps PR, never an e1RM PR
assert.equal(isPR({ weight: 60, reps: 20 }, [{ weight: 100, reps: 5 }]), "reps");

// settings parsing
assert.deepEqual(parseRange({ rep_min: '6', rep_max: '10', increment: '1,25' }), { rep_min: 6, rep_max: 10, increment: 1.25 });
assert.deepEqual(parseRange({ rep_min: '5', rep_max: '5', increment: '5' }), { rep_min: 5, rep_max: 5, increment: 5 }); // straight sets
assert.equal(typeof parseRange({ rep_min: '12', rep_max: '8', increment: '2.5' }), 'string');
assert.equal(typeof parseRange({ rep_min: '8', rep_max: '12', increment: '0' }), 'string');
assert.equal(typeof parseRange({ rep_min: '8.5', rep_max: '12', increment: '2.5' }), 'string');
assert.equal(typeof parseRange({ rep_min: '', rep_max: '12', increment: '2.5' }), 'string');
// a custom setting drives the suggestion: 5x5, +5 kg
assert.deepEqual(suggest([{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }], { rep_min: 5, rep_max: 5, increment: 5 }), [
  { weight: 105, reps: 5 }, { weight: 105, reps: 5 },
]);

console.log('progression ok 🐕');
