import assert from 'node:assert/strict';
import { parseBackup } from './backup';

const ok = JSON.stringify({ app: 'shiba-lift', schema: 6, exportedAt: 1, tables: { workouts: [], sets: [] } });
assert.equal(parseBackup(ok, 6).schema, 6);
assert.equal(parseBackup(ok, 7).schema, 6); // older backup restores into a newer app
assert.throws(() => parseBackup(ok, 5), /newer version/);
assert.throws(() => parseBackup('not json', 6), /isn’t a Shiba Lift backup/);
assert.throws(() => parseBackup('{"app":"hevy"}', 6), /isn’t a Shiba Lift backup/);
assert.throws(() => parseBackup('null', 6), /isn’t a Shiba Lift backup/);

console.log('backup ok 🐕');
