// Tests for src/games/maze.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, seedFor } from '../src/seed.js';
import {
  generate, verify, solution, canMove, start, step, hintSquares, offRoute, SIZE, N, E, S, W,
} from '../src/games/maze.js';

const seedForDay = (key) => seedFor(key, 'maze');

// A tiny 2x2 maze for play tests. Open: (0,0)-(0,1), (0,1)-(1,1), (0,0)-(1,0).
// Route from start (0,0) to goal (1,1): right, then down.
//   +---+---+
//   | S     |
//   +   +   +
//   |   | * |
//   +---+---+
const tiny = {
  size: 2,
  walls: [
    [N | W, N | E],
    [W | E | S, W | E | S],
  ],
  start: [0, 0],
  goal: [1, 1],
};

// --- generate and verify ---

test('generate gives the same maze for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08')), generate(seedForDay('2026-11-08')));
});

test('every day for two years makes a perfect maze with one route to the star', () => {
  for (let day = 0; day < 730; day++) {
    const key = dateKey(new Date(2026, 10, 1 + day));
    const puzzle = generate(seedForDay(key));
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.size, SIZE);
  }
});

test('routes are long enough to be a real maze', () => {
  for (let day = 0; day < 100; day++) {
    const route = solution(generate(seedForDay(dateKey(new Date(2026, 10, 1 + day)))));
    // The shortest possible route across a 7x7 grid is 13 squares.
    assert.ok(route.length >= 13, `route of ${route.length}`);
  }
});

test('verify catches a hole in the outside wall, a loop, and mismatched walls', () => {
  assert.equal(verify(tiny).ok, true);
  const hole = { ...tiny, walls: [[W, N | E], [W | E | S, W | E | S]] };
  assert.equal(verify(hole).ok, false);
  const loop = { ...tiny, walls: [[N | W, N | E], [W | S, E | S]] };
  assert.equal(verify(loop).ok, false);
  const mismatched = { ...tiny, walls: [[N | W | E, N | E], [W | E | S, W | E | S]] };
  assert.equal(verify(mismatched).ok, false);
});

// --- moving ---

test('canMove: only to a square next door with no wall between', () => {
  assert.equal(canMove(tiny, [0, 0], [0, 1]), true);
  assert.equal(canMove(tiny, [0, 0], [1, 0]), true);
  assert.equal(canMove(tiny, [1, 0], [1, 1]), false); // wall
  assert.equal(canMove(tiny, [0, 0], [1, 1]), false); // diagonal
  assert.equal(canMove(tiny, [0, 0], [-1, 0]), false); // outside
});

test('solution finds the one route', () => {
  assert.deepEqual(solution(tiny), [[0, 0], [0, 1], [1, 1]]);
});

test('step: the path grows, walls stop it, and reaching the star wins', () => {
  let state = start(tiny);
  state = step(state, [1, 1]);
  assert.equal(state.path.length, 1, 'cannot jump diagonally');
  state = step(state, [0, 1]);
  assert.equal(state.path.length, 2);
  state = step(state, [1, 1]);
  assert.equal(state.status, 'won');
});

test('step: going back to the previous square traces the path back', () => {
  let state = step(start(tiny), [1, 0]);
  assert.equal(state.path.length, 2);
  state = step(state, [0, 0]);
  assert.deepEqual(state.path, [[0, 0]]);
});

test('step: a wall blocks without changing anything', () => {
  const before = step(start(tiny), [1, 0]);
  assert.equal(step(before, [1, 1]), before);
});

// --- hints ---

test('hintSquares shows the next squares of the route', () => {
  assert.deepEqual(hintSquares(start(tiny)), [[0, 1], [1, 1]]);
});

test('after a wrong turn, the hint starts where the path left the route', () => {
  const lost = step(start(tiny), [1, 0]);
  assert.equal(offRoute(lost), true);
  assert.deepEqual(hintSquares(lost), [[0, 1], [1, 1]]);
  assert.equal(offRoute(start(tiny)), false);
});
