import assert from 'node:assert/strict';
import { suggest, isPR, e1rm, parseRange, overload, sessionKey, stalled, deloadWeight, plates } from './progression';

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

// overload streak: workout 3 only has a new exercise (neutral), workout 4 regresses (breaks), 5 and 6 beat it
const ses = (workout_id: number, exercise_id: string, top: number, reps: number) => ({ workout_id, exercise_id, top, reps });
const o = overload([
  ses(1, 'bench', 60, 24), ses(1, 'squat', 100, 15),
  ses(2, 'bench', 60, 26), ses(2, 'squat', 95, 30), // more reps at the same top weight = up, lighter squat doesn't matter
  ses(3, 'curl', 12, 30),
  ses(4, 'bench', 60, 20),
  ses(5, 'bench', 62.5, 16), // heavier = up even with fewer reps
  ses(6, 'squat', 100, 15), // vs workout 2's 95 kg
]);
assert.deepEqual([...o.byWorkout], [[2, true], [4, false], [5, true], [6, true]]);
assert.deepEqual({ current: o.current, best: o.best }, { current: 2, best: 2 });
assert.ok(o.up.has(sessionKey({ workout_id: 2, exercise_id: 'bench' })) && !o.up.has('2:squat') && o.up.has('6:squat'));
assert.deepEqual({ ...overload([]), up: 0, byWorkout: 0 }, { up: 0, byWorkout: 0, current: 0, best: 0 });

// deload: 3 sessions stuck at 100 kg -> stalled; 10% off, rounded to the increment, warm-up untouched
assert.ok(stalled([ses(1, 'b', 100, 24), ses(2, 'b', 100, 22), ses(3, 'b', 100, 24)]));
assert.ok(!stalled([ses(1, 'b', 100, 24), ses(2, 'b', 100, 22), ses(3, 'b', 100, 25)])); // more reps = progress
assert.ok(!stalled([ses(1, 'b', 100, 24), ses(2, 'b', 100, 22), ses(3, 'b', 90, 24)])); // already deloaded
assert.ok(!stalled([ses(1, 'b', 100, 24), ses(2, 'b', 100, 22)]));
assert.ok(!stalled([ses(1, 'b', 0, 20), ses(2, 'b', 0, 20), ses(3, 'b', 0, 20)])); // bodyweight
assert.deepEqual(suggest([{ weight: 40, reps: 8 }, { weight: 100, reps: 9 }], r, true), [{ weight: 40, reps: 8 }, { weight: 90, reps: 9 }]);
assert.equal(deloadWeight(62.5, 2.5), 57.5);
assert.equal(deloadWeight(10, 2.5), 7.5); // always at least one increment lighter
assert.deepEqual(suggest([{ weight: 2.5, reps: 10 }], r, true), [{ weight: 2.5, reps: 11 }]); // can't go lighter: normal rule

// plates per side
assert.deepEqual(plates(100), { plates: [25, 15], rest: 0, underBar: false });
assert.deepEqual(plates(62.5), { plates: [20, 1.25], rest: 0, underBar: false });
assert.deepEqual(plates(20), { plates: [], rest: 0, underBar: false });
assert.deepEqual(plates(21), { plates: [], rest: 0.5, underBar: false });
assert.equal(plates(10).underBar, true);

console.log('progression ok 🐕');
