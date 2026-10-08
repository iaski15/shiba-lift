import assert from 'node:assert/strict';
import { detach, groupBounds, moveGroup, pair, removeAt } from './superset';

type X = { n: string; linked?: boolean };
const mk = (spec: string): X[] => spec.split(' ').map(t => ({ n: t.replace('+', ''), linked: t.endsWith('+') })); // "A+" = linked to next
const show = (a: X[]) => a.map(x => x.n + (x.linked ? '+' : '')).join(' ');

// A B+ C D   (B&C superset)
const base = mk('A B+ C D');
assert.deepEqual(groupBounds(base, 2), [1, 2]);

// moving: supersets move as one unit
assert.equal(show(moveGroup(base, 0, 1)), 'B+ C A D');
assert.equal(show(moveGroup(base, 2, -1)), 'B+ C A D'); // moving C moves B&C
assert.equal(show(moveGroup(base, 1, 1)), 'A D B+ C');
assert.equal(show(moveGroup(base, 3, -1)), 'A D B+ C'); // D jumps over the whole superset
assert.equal(moveGroup(base, 0, -1), base); // already first
assert.equal(moveGroup(base, 3, 1), base); // already last

// pairing any two exercises
assert.equal(show(pair(mk('A B C D'), 0, 3)), 'A+ D B C'); // D comes up next to A
assert.equal(show(pair(mk('A B C D'), 3, 0)), 'B C D+ A'); // A goes down next to D
assert.equal(show(pair(base, 1, 3)), 'A B+ C+ D'); // add D to B&C: tri-set
assert.equal(show(pair(base, 0, 2)), 'A+ C B D'); // C leaves B to join A
assert.equal(pair(base, 1, 2), base); // already together

// removing never leaves a dangling link
assert.equal(show(removeAt(base, 2)), 'A B D');
assert.equal(show(removeAt(base, 1)), 'A C D');
assert.equal(show(removeAt(mk('A+ B+ C'), 1)), 'A+ C');

// detaching
assert.equal(show(detach(base, 1)), 'A C B D');
assert.equal(show(detach(base, 2)), 'A B C D');
assert.equal(show(detach(mk('A+ B+ C D'), 0)), 'B+ C A D');
assert.equal(detach(base, 0), base);

console.log('superset ok 🐕');
