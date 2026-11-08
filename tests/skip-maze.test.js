// Tests for src/games/skip-maze.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, seedFor } from '../src/seed.js';
import {
  generate, verify, start, step, hint, onPattern, nextValue, STEPS, SIZE,
} from '../src/games/skip-maze.js';

const seedForDay = (key) => seedFor(key, 'skip-maze');

// A fixed grid counting by 5s from 5. The path is the top row, then down
// the right side: 5 10 15 20 25 / 30 35 40 45.
const fixed = {
  step: 5,
  first: 5,
  grid: [
    [5, 10, 15, 20, 25],
    [6, 12, 18, 23, 30],
    [7, 13, 19, 24, 35],
    [8, 14, 21, 26, 40],
    [9, 16, 22, 27, 45],
  ],
  path: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]],
};

// --- generate and verify ---

test('onPattern knows which numbers belong to the count', () => {
  assert.equal(onPattern(35, 5, 5), true);
  assert.equal(onPattern(36, 5, 5), false);
  assert.equal(onPattern(47, 7, 10), true);
  assert.equal(onPattern(48, 7, 10), false);
  assert.equal(onPattern(9, 2, 2), false);
});

test('generate gives the same grid for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08')), generate(seedForDay('2026-11-08')));
});

test('every day for two years makes a grid with exactly one way through', () => {
  const steps = new Set();
  for (let day = 0; day < 730; day++) {
    const key = dateKey(new Date(2026, 10, 1 + day));
    const puzzle = generate(seedForDay(key));
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.grid.length, SIZE);
    steps.add(puzzle.step);
  }
  assert.deepEqual([...steps].sort((a, b) => a - b), STEPS); // every kind of count shows up
});

test('verify catches a number that fits the count off the path, and a broken path', () => {
  assert.equal(verify(fixed).ok, true);
  const extra = { ...fixed, grid: fixed.grid.map((row) => [...row]) };
  extra.grid[2][0] = 50; // fits "count by 5s" but isn't on the path
  assert.equal(verify(extra).ok, false);
  const gap = { ...fixed, path: fixed.path.filter((_, i) => i !== 3) };
  assert.equal(verify(gap).ok, false);
});

// --- step ---

test('step: the next number grows the trail', () => {
  const state = step(start(fixed), [0, 1]);
  assert.equal(state.last.result, 'grow');
  assert.equal(state.trail.length, 2);
  assert.equal(nextValue(state), 15);
});

test('step: a number next to the head that breaks the count is wrong and does not move', () => {
  const state = step(start(fixed), [1, 0]); // 6
  assert.equal(state.last.result, 'wrong');
  assert.equal(state.trail.length, 1);
});

test('step: squares that are not next to the head are ignored', () => {
  const state = step(start(fixed), [0, 2]); // 15, but two squares away
  assert.equal(state.last.result, 'stay');
});

test('step: sliding back shrinks the trail, tapping further back cuts to it', () => {
  let state = start(fixed);
  for (const sq of fixed.path.slice(1, 5)) state = step(state, sq);
  state = step(state, [0, 3]);
  assert.equal(state.last.result, 'back');
  assert.equal(state.trail.length, 4);
  state = step(state, [0, 0]);
  assert.equal(state.last.result, 'cut');
  assert.equal(state.trail.length, 1);
});

test('step: reaching the star wins', () => {
  let state = start(fixed);
  for (const sq of fixed.path.slice(1)) state = step(state, sq);
  assert.equal(state.status, 'won');
});

// --- hints ---

test('hint: first the counting question, then the next square lights', () => {
  let state = step(start(fixed), [0, 1]);
  let result = hint(state);
  assert.equal(result.text, 'Counting by 5s: what comes after 10?');
  assert.equal(result.square, null);
  result = hint(result.state);
  assert.deepEqual(result.square, [0, 2]);
});
