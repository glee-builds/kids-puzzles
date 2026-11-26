// Tests for src/games/pond-sudoku.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, hint, answerFor, BLANKS, MAX_TRIES } from '../src/games/pond-sudoku.js';

const seed = (key) => seedFor(key, 'pond-sudoku');
const sample = generate(seed('2026-11-26'));

test('every day for two years, at every level, makes a valid pond with exactly one answer', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seed(key), level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      assert.equal(puzzle.hidden.length, BLANKS[level - 1]);
    });
  }
});

test('the same day and level always make the same pond; days differ', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 1), sample);
  const ponds = new Set();
  everyDay((key) => ponds.add(JSON.stringify(generate(seed(key)))), 60);
  assert.ok(ponds.size > 50);
});

test('check: the right animal fills the square; filling every square wins', () => {
  let state = start(sample);
  for (const cell of sample.hidden) {
    state = check(state, { cell, value: answerFor(sample, cell) });
    assert.equal(state.last.correct, true);
  }
  assert.equal(state.status, 'won');
  assert.deepEqual(state.shown, []);
  assert.throws(() => check(state, { cell: sample.hidden[0], value: 0 }));
});

test('check: a wrong animal leaves the square empty, and the third miss shows the answer', () => {
  const cell = sample.hidden[0];
  const wrong = (answerFor(sample, cell) + 1) % 4;
  let state = start(sample);
  for (let miss = 1; miss < MAX_TRIES; miss++) {
    state = check(state, { cell, value: wrong });
    assert.deepEqual([state.last.correct, state.last.shown, cell in state.entries], [false, false, false]);
  }
  state = check(state, { cell, value: wrong });
  assert.equal(state.last.shown, true);
  assert.equal(state.entries[cell], answerFor(sample, cell));
  assert.deepEqual(state.shown, [cell]);
  assert.throws(() => check(state, { cell, value: wrong })); // it's full now
  assert.throws(() => check(start(sample), { cell: 'nowhere', value: 0 }));
});

test('hint: says where the animal already is when it can be seen', () => {
  // Top row: frog, duck, empty, empty. A frog in the third square clashes with the row.
  const puzzle = { solution: [[0, 1, 2, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 2, 1, 0]], hidden: ['0-2', '0-3', '1-2', '1-3', '2-3', '3-0'], level: 1 };
  assertValid(verify(puzzle), 'the hint pond');
  assert.equal(hint(start(puzzle), '0-2', 0), "There's already a frog in this row.");
  assert.equal(hint(start(puzzle), '0-2', 3), "There's already a fish in this column."); // the fish at the bottom of that column
  assert.match(hint(start(puzzle), '0-3', 2), /^Not the turtle\./); // no turtle can be seen from there
});

test('verify turns away a repeat, the wrong number of empty squares, and a pond with two answers', () => {
  const broken = sample.solution.map((line) => [...line]);
  broken[0][0] = broken[0][1];
  assert.equal(verify({ ...sample, solution: broken }).ok, false);
  assert.equal(verify({ ...sample, hidden: sample.hidden.slice(1) }).ok, false);
  assert.equal(verify({ solution: sample.solution, hidden: ['0-0', '0-1', '0-2', '0-3', '1-0', '1-1', '1-2', '1-3', '2-0', '2-1'], level: 3 }).ok, false);
});
