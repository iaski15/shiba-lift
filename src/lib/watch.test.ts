import assert from 'node:assert/strict';
import type { Block, Draft } from './db';
import { newActions, watchState } from './watch';

const now = 1_000_000;
const raw = [
  { id: now - 10, type: 'set', bi: 0, si: 1, ex: 'bench', w: 60, r: 8 },
  { id: now - 20, type: 'undo', bi: 0, si: 0, ex: 'bench' },
  { id: now - 30, type: 'rest', add: 0 }, // already handled
  { id: now - 3 * 60_000, type: 'start' }, // stale start
  { id: now - 5, type: 'start', routineId: 2 },
].map(a => JSON.stringify(a));
assert.deepEqual(newActions(raw, now - 30, now).map(a => a.id), [now - 20, now - 10, now - 5]);

const ex = { id: 'bench', name: 'Bench', muscle: 'chest', equipment: 'barbell', custom: 0, rep_min: 8, rep_max: 12, increment: 2.5 };
const block: Block = {
  ex, prev: [], sugg: [{ weight: 60, reps: 9 }],
  sets: [
    { weight: '62,5', reps: '8', done: true }, // typed (comma decimal)
    { weight: '', reps: '', done: false }, // suggestion
    { weight: '', reps: '10', done: false, warmup: true }, // no suggestion for this index: last suggestion, typed reps
  ],
};
const empty: Block = { ex: { ...ex, id: 'curl' }, prev: [], sugg: [], sets: [{ weight: '', reps: '', done: false }, { weight: '20', reps: '', done: false }] };
const d: Draft = { name: 'Push', startedAt: 5, blocks: [block, empty], restEnd: 99 };
const st = JSON.parse(watchState(d, [{ id: 2, name: 'Pull', items: [] }], 7));
assert.equal(st.ack, 7);
assert.deepEqual(st.routines, [{ id: 2, name: 'Pull' }]);
assert.deepEqual(st.workout.blocks[0].sets, [
  { w: 62.5, r: 8, done: true, warmup: false },
  { w: 60, r: 9, done: false, warmup: false },
  { w: 60, r: 10, done: false, warmup: true },
]);
// nothing typed or suggested: 0 kg x rep_min, then carries the set before it forward
assert.deepEqual(st.workout.blocks[1].sets.map((s: { w: number; r: number }) => [s.w, s.r]), [[0, 8], [20, 8]]);
assert.equal(JSON.parse(watchState(null, [], 0)).workout, null);

console.log('watch ok 🐕');
