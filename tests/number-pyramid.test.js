// Tests for src/games/number-pyramid.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, dayKey } from './helpers.js';
import {
  generate, verify, start, check, hint, workable, buildValues, isSolvable, answerFor,
  BLANKS, MAX_TOP, MIN_TOP, MAX_TRIES,
} from '../src/games/number-pyramid.js';

const seedForDay = (key) => seedFor(key, 'number-pyramid');

// A fixed pyramid for the play tests:
//        52
//      25  27
//    12  13  14
//   5   7   6   8
const fixed = {
  values: buildValues([5, 7, 6, 8]),
  hidden: ['0-1', '1-2', '2-0', '2-1', '3-0'],
};

// --- generate ---

test('buildValues adds pairs of bricks going up', () => {
  assert.deepEqual(buildValues([5, 7, 6, 8]), [[5, 7, 6, 8], [12, 13, 14], [25, 27], [52]]);
});

test('generate gives the same pyramid for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08')), generate(seedForDay('2026-11-08')));
});

test('every day for two years makes a valid, solvable pyramid', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key));
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    const top = puzzle.values[3][0];
    assert.ok(top >= MIN_TOP && top <= MAX_TOP, `${key}: top is ${top}`);
  });
});

test('every pyramid has a blank in the bottom row and one higher up', () => {
  for (let day = 0; day < 100; day++) {
    const { hidden } = generate(seedForDay(dayKey(day)));
    assert.equal(hidden.length, BLANKS);
    assert.ok(hidden.some((id) => id.startsWith('0-')), 'needs a bottom-row blank');
    assert.ok(hidden.some((id) => !id.startsWith('0-')), 'needs a blank above the bottom');
  }
});

test('different days give different pyramids', () => {
  const tops = new Set();
  for (let day = 0; day < 30; day++) {
    tops.add(JSON.stringify(generate(seedForDay(dayKey(day)))));
  }
  assert.ok(tops.size >= 28, `only ${tops.size} different pyramids in 30 days`);
});

// --- isSolvable ---

test('isSolvable: a blank between two known bricks can be worked out', () => {
  assert.equal(isSolvable(['0-1', '1-2', '2-0', '2-1', '3-0']), true);
});

test('isSolvable: a whole bottom row of blanks cannot', () => {
  assert.equal(isSolvable(['0-0', '0-1', '0-2', '0-3', '3-0']), false);
});

// --- check ---

test('check: the right number fills the brick', () => {
  const state = check(start(fixed), { cell: '1-2', value: 14 });
  assert.equal(state.entries['1-2'], 14);
  assert.deepEqual(state.last, { cell: '1-2', correct: true, revealed: false });
});

test('check: a wrong number counts a miss and leaves the brick open', () => {
  const state = check(start(fixed), { cell: '1-2', value: 15 });
  assert.equal(state.entries['1-2'], undefined);
  assert.equal(state.tries['1-2'], 1);
  assert.equal(state.last.correct, false);
});

test(`check: after ${MAX_TRIES} misses the brick fills itself in`, () => {
  let state = start(fixed);
  for (let i = 0; i < MAX_TRIES; i++) state = check(state, { cell: '1-2', value: 99 });
  assert.equal(state.entries['1-2'], 14);
  assert.deepEqual(state.revealed, ['1-2']);
  assert.equal(state.last.revealed, true);
});

test('check: filling every blank wins', () => {
  let state = start(fixed);
  for (const cell of fixed.hidden) state = check(state, { cell, value: answerFor(fixed, cell) });
  assert.equal(state.status, 'won');
});

test('check: refuses a brick that is not an open blank', () => {
  assert.throws(() => check(start(fixed), { cell: '0-0', value: 5 }));
  const filled = check(start(fixed), { cell: '1-2', value: 14 });
  assert.throws(() => check(filled, { cell: '1-2', value: 14 }));
});

test('check: does not change the old state', () => {
  const before = start(fixed);
  check(before, { cell: '1-2', value: 14 });
  assert.deepEqual(before.entries, {});
});

// --- workable and hint ---

test('workable lists only blanks that can be worked out now', () => {
  // Ready now: 0-1 = 12 - 5, 1-2 = 6 + 8, 2-0 = 12 + 13.
  // Not yet: 2-1 needs 1-2, and 3-0 needs 2-0 and 2-1.
  assert.deepEqual(workable(start(fixed)).sort(), ['0-1', '1-2', '2-0']);
});

test('hint: adding bricks, the rule first, then the number sentence', () => {
  let state = start(fixed);
  assert.equal(hint(state, '1-2'), 'Add the two bricks under it.');
  state = check(state, { cell: '1-2', value: 1 });
  assert.equal(hint(state, '1-2'), 'Add the two bricks under it.');
  state = check(state, { cell: '1-2', value: 1 });
  assert.equal(hint(state, '1-2'), '6 + 8 = ?');
});

test('hint: a bottom brick asks "what plus" before showing the subtraction', () => {
  let state = start(fixed);
  assert.equal(hint(state, '0-1'), 'What number plus 5 makes 12?');
  state = check(state, { cell: '0-1', value: 1 });
  state = check(state, { cell: '0-1', value: 1 });
  assert.equal(hint(state, '0-1'), '12 − 5 = ?');
});

test('hint: a brick that needs more numbers says to try another first', () => {
  assert.match(hint(start(fixed), '3-0'), /Try a different brick first/);
});

// --- verify ---

test('verify: catches broken pyramids', () => {
  assert.equal(verify(fixed).ok, true);
  const wrongSum = { ...fixed, values: [[5, 7, 6, 8], [12, 13, 99], [25, 27], [52]] };
  assert.equal(verify(wrongSum).ok, false);
  const tooBig = { ...fixed, values: buildValues([20, 20, 20, 20]) };
  assert.equal(verify(tooBig).ok, false);
  const unsolvable = { ...fixed, hidden: ['0-0', '0-1', '0-2', '0-3', '3-0'] };
  assert.equal(verify(unsolvable).ok, false);
  const wrongShape = { ...fixed, values: [[1, 2], [3]] };
  assert.equal(verify(wrongShape).ok, false);
});
