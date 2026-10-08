import assert from 'node:assert/strict';
import { toImported } from './hevy';

const w = toImported({
  id: 'abc',
  title: ' Push ',
  start_time: '2024-08-14T12:00:00Z',
  end_time: '2024-08-14T13:05:00Z',
  exercises: [
    { title: 'Bench Press (Barbell)', sets: [{ type: 'warmup', weight_kg: 40, reps: 10 }, { type: 'normal', weight_kg: 80.333, reps: 8 }] },
    { title: 'Push Up', sets: [{ type: 'normal', weight_kg: null, reps: 15 }] },
    { title: 'Plank', sets: [{ type: 'normal', weight_kg: null, reps: null }] }, // timed: skipped
  ],
});
assert.equal(w.hevyId, 'abc');
assert.equal(w.name, 'Push');
assert.equal(w.end - w.start, 65 * 60000);
assert.deepEqual(w.sets, [
  { exercise: 'Bench Press (Barbell)', weight: 40, reps: 10 },
  { exercise: 'Bench Press (Barbell)', weight: 80.33, reps: 8 },
  { exercise: 'Push Up', weight: 0, reps: 15 },
]);

console.log('hevy ok 🐕');
