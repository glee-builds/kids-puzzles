// Tests for src/games/magic-square.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, dayKey } from './helpers.js';
import {
  generate, verify, start, check, hint, hintLine, workable, isSolvable, answerFor,
  LINES, BLANKS, MIN_TARGET, MAX_TARGET, MAX_TRIES,
} from '../src/games/magic-square.js';

const seedForDay = (key) => seedFor(key, 'magic-square');

// A fixed square for the play tests (numbers 5, 10 ... 45; every line adds to 75):
//   10  35  30
//   45  25   5
//   20  15  40
const fixed = {
  grid: [[10, 35, 30], [45, 25, 5], [20, 15, 40]],
  target: 75,
  hidden: ['0-0', '0-1', '1-1', '2-2'],
};

// --- generate ---

test('generate gives the same square for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08')), generate(seedForDay('2026-11-08')));
});

test('every day for two years makes a valid, solvable magic square', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key));
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.hidden.length, BLANKS);
  });
});

test('targets stay in range and vary from day to day', () => {
  const targets = new Set();
  for (let day = 0; day < 60; day++) {
    const { target } = generate(seedForDay(dayKey(day)));
    assert.ok(target >= MIN_TARGET && target <= MAX_TARGET, `target ${target}`);
    targets.add(target);
  }
  assert.ok(targets.size >= 15, `only ${targets.size} different targets in 60 days`);
});

test('there are 8 lines: 3 rows, 3 columns, 2 diagonals', () => {
  assert.equal(LINES.length, 8);
  assert.ok(LINES.every((line) => line.length === 3));
});

// --- isSolvable ---

test('isSolvable: blanks that each have a line with two known squares', () => {
  assert.equal(isSolvable(fixed.hidden), true);
});

test('isSolvable: four blank corners cannot be worked out one line at a time', () => {
  // Every line through a corner holds a second blank corner.
  assert.equal(isSolvable(['0-0', '0-2', '2-0', '2-2']), false);
});

// --- check ---

test('check: the right number fills the square', () => {
  const state = check(start(fixed), { cell: '0-1', value: 35 });
  assert.equal(state.entries['0-1'], 35);
  assert.equal(state.last.correct, true);
});

test('check: a wrong number counts a miss and leaves the square open', () => {
  const state = check(start(fixed), { cell: '0-1', value: 36 });
  assert.equal(state.entries['0-1'], undefined);
  assert.equal(state.tries['0-1'], 1);
});

test(`check: after ${MAX_TRIES} misses the square fills itself in`, () => {
  let state = start(fixed);
  for (let i = 0; i < MAX_TRIES; i++) state = check(state, { cell: '0-1', value: 1 });
  assert.equal(state.entries['0-1'], 35);
  assert.deepEqual(state.revealed, ['0-1']);
});

test('check: filling every blank wins', () => {
  let state = start(fixed);
  for (const cell of ['0-1', '1-1', '0-0', '2-2']) {
    state = check(state, { cell, value: answerFor(fixed, cell) });
  }
  assert.equal(state.status, 'won');
});

test('check: refuses a square that is not an open blank', () => {
  assert.throws(() => check(start(fixed), { cell: '0-2', value: 30 }));
});

// --- workable and hint ---

test('workable lists only blanks with a ready line', () => {
  // Ready now: 0-0 (column 45 + 20), 1-1 (row 45 + 5), 2-2 (row 20 + 15).
  // Not yet: 0-1, because its row has 0-0 blank and its column has 1-1 blank.
  assert.deepEqual(workable(start(fixed)).sort(), ['0-0', '1-1', '2-2']);
});

test('hint: first which line to use, then the number sentence', () => {
  let state = start(fixed);
  assert.equal(hint(state, '2-2'), 'What number makes this line add to 75?');
  assert.deepEqual(hintLine(state, '2-2'), ['2-0', '2-1', '2-2']);
  state = check(state, { cell: '2-2', value: 1 });
  state = check(state, { cell: '2-2', value: 1 });
  assert.equal(hint(state, '2-2'), '20 + 15 + ? = 75');
});

test('hint: a square that needs more numbers says to try another first', () => {
  assert.match(hint(start(fixed), '0-1'), /Try a different square first/);
});

// --- verify ---

test('verify: catches broken squares', () => {
  assert.equal(verify(fixed).ok, true);
  const notMagic = { ...fixed, grid: [[10, 35, 30], [45, 25, 5], [20, 40, 15]] };
  assert.equal(verify(notMagic).ok, false);
  const repeated = { ...fixed, grid: [[25, 25, 25], [25, 25, 25], [25, 25, 25]] };
  assert.equal(verify(repeated).ok, false);
  const unsolvable = { ...fixed, hidden: ['0-0', '0-2', '2-0', '2-2'] };
  assert.equal(verify(unsolvable).ok, false);
  const wrongShape = { ...fixed, grid: [[1, 2], [3, 4]] };
  assert.equal(verify(wrongShape).ok, false);
});
