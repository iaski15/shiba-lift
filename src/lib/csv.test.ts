import assert from 'node:assert/strict';
import { parseCsv, parseHevy, parseHevyDate } from './csv';

assert.deepEqual(parseCsv('a,"b,c","say ""hi"""\r\n\r\n1,2,3'), [['a', 'b,c', 'say "hi"'], ['1', '2', '3']]);
assert.deepEqual(parseCsv('﻿x\n"multi\nline",y\n'), [['x'], ['multi\nline', 'y']]);

assert.equal(parseHevyDate('01 Aug 2024, 18:23'), new Date(2024, 7, 1, 18, 23).getTime());
assert.equal(parseHevyDate('2024-08-01T18:23:00Z'), Date.UTC(2024, 7, 1, 18, 23));
assert.ok(Number.isNaN(parseHevyDate('garbage')));

const H = 'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';
const csv = [
  H,
  '"Push, heavy","02 Aug 2024, 18:00","02 Aug 2024, 19:05","",Bench Press (Barbell),,,0,warmup,40,10,,,',
  '"Push, heavy","02 Aug 2024, 18:00","02 Aug 2024, 19:05","",Bench Press (Barbell),,,1,normal,80,8,,,8',
  '"Push, heavy","02 Aug 2024, 18:00","02 Aug 2024, 19:05","",Push Up,,,0,normal,,15,,,',
  '"Push, heavy","02 Aug 2024, 18:00","02 Aug 2024, 19:05","",Treadmill,,,0,normal,,,2.1,600,', // cardio: skipped
  'Legs,"01 Aug 2024, 07:30","01 Aug 2024, 08:30","",Squat (Barbell),,,0,normal,100,5,,,',
].join('\n');
const ws = parseHevy(csv);
assert.equal(ws.length, 2);
assert.equal(ws[0].name, 'Legs'); // sorted oldest first
assert.equal(ws[1].name, 'Push, heavy');
assert.equal(ws[1].end - ws[1].start, 65 * 60000);
assert.deepEqual(ws[1].sets, [
  { exercise: 'Bench Press (Barbell)', weight: 40, reps: 10, warmup: true },
  { exercise: 'Bench Press (Barbell)', weight: 80, reps: 8 },
  { exercise: 'Push Up', weight: 0, reps: 15 },
]);

const lbs = parseHevy('title,start_time,exercise_title,weight_lbs,reps\nA,"01 Aug 2024, 07:30",Curl,100,10');
assert.equal(lbs[0].sets[0].weight, 45.36);

assert.throws(() => parseHevy('Date,Workout Name,Exercise Name\n1,2,3'), /Hevy/);

console.log('csv ok 🐕');
