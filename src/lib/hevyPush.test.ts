import assert from 'node:assert/strict';
import { buildHevyWorkout, matchTemplate, toHevyEquipment, toHevyMuscle, type PushRow } from './hevyPush';

const T = [
  { id: 'A', title: 'Squat (Barbell)' },
  { id: 'B', title: 'Bench Press (Barbell)' },
  { id: 'C', title: 'Bench Press (Dumbbell)' },
  { id: 'D', title: 'Lat Pulldown (Cable)' },
];
assert.equal(matchTemplate('Squat (Barbell)', T), 'A'); // synced from Hevy: exact
assert.equal(matchTemplate('squat (barbell)', T), 'A');
assert.equal(matchTemplate('Barbell Squat', T), 'A'); // built-in library name, same words
assert.equal(matchTemplate('Dumbbell Bench Press', T), 'C');
assert.equal(matchTemplate('Bench Press', T), null); // ambiguous / no clean match -> custom exercise
assert.equal(matchTemplate('Shiba Squat', T), null);

assert.equal(toHevyMuscle('middle back'), 'upper_back');
assert.equal(toHevyMuscle('lower back'), 'lower_back');
assert.equal(toHevyMuscle('chest'), 'chest');
assert.equal(toHevyMuscle('whatever'), 'other');
assert.equal(toHevyEquipment('e-z curl bar'), 'barbell');
assert.equal(toHevyEquipment('body only'), 'none');
assert.equal(toHevyEquipment('bands'), 'resistance_band');
assert.equal(toHevyEquipment('cable'), 'other');

const row = (exercise_id: string, weight: number, reps: number, warmup = 0, superset: number | null = null): PushRow =>
  ({ exercise_id, name: exercise_id, muscle: 'chest', equipment: 'barbell', hevy_template: null, weight, reps, warmup, superset });
const body = buildHevyWorkout(
  { name: 'Push', started_at: Date.UTC(2026, 9, 14, 18, 0), ended_at: Date.UTC(2026, 9, 14, 19, 5) },
  [row('bench', 40, 10, 1), row('bench', 80, 8), row('fly', 20, 12, 0, 1), row('raise', 8, 15, 0, 1), row('bench', 70, 10)],
  ex => `tpl-${ex}`,
);
assert.equal(body.workout.start_time, '2026-10-14T18:00:00.000Z');
assert.equal(body.workout.end_time, '2026-10-14T19:05:00.000Z');
assert.equal(body.workout.is_private, false);
assert.deepEqual(body.workout.exercises, [
  { exercise_template_id: 'tpl-bench', superset_id: null, sets: [{ type: 'warmup', weight_kg: 40, reps: 10 }, { type: 'normal', weight_kg: 80, reps: 8 }] },
  { exercise_template_id: 'tpl-fly', superset_id: 1, sets: [{ type: 'normal', weight_kg: 20, reps: 12 }] },
  { exercise_template_id: 'tpl-raise', superset_id: 1, sets: [{ type: 'normal', weight_kg: 8, reps: 15 }] },
  { exercise_template_id: 'tpl-bench', superset_id: null, sets: [{ type: 'normal', weight_kg: 70, reps: 10 }] }, // same lift later = new entry
]);
// a zero-length workout still gets a valid end time
assert.equal(buildHevyWorkout({ name: '', started_at: 0, ended_at: 0 }, [], x => x).workout.end_time, '1970-01-01T00:01:00.000Z');

console.log('hevyPush ok 🐕');
