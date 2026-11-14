// Tests for src/games/maze.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, dayKey } from './helpers.js';
import {
  generate, verify, solution, canMove, start, step, hintSquares, offRoute, SIZE, SMALL_SIZE, SHAPES, N, E, S, W,
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
  everyDay((key) => {
    const puzzle = generate(seedForDay(key));
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.size, SIZE);
  });
});

test('the star is far away: every route is at least 150 squares long', () => {
  for (let day = 0; day < 100; day++) {
    const puzzle = generate(seedForDay(dayKey(day)));
    const route = solution(puzzle);
    assert.ok(route.length >= 150, `${puzzle.shape}: route of ${route.length}`);
  }
});

test('every outline makes a perfect maze, and all of them come up', () => {
  for (const shape of Object.keys(SHAPES)) {
    const puzzle = generate(seedForDay('2026-11-14'), SIZE, shape);
    assert.equal(puzzle.shape, shape);
    assert.ok(verify(puzzle).ok, `${shape}: ${verify(puzzle).problems.join('; ')}`);
  }
  const seen = new Set();
  everyDay((key) => seen.add(generate(seedForDay(key)).shape), 120);
  assert.deepEqual([...seen].sort(), Object.keys(SHAPES).sort());
});

test('squares outside the outline are not part of the maze', () => {
  const puzzle = generate(seedForDay('2026-11-14'), SIZE, 'diamond');
  assert.equal(puzzle.walls[0][0], null); // a corner of the grid is outside a diamond
  assert.equal(canMove(puzzle, [0, 0], [0, 1]), false);
  const inside = puzzle.walls.flat().filter((w) => w != null).length;
  assert.ok(inside > 400 && inside < SIZE * SIZE);
  // Start and star are inside, and the star is the farthest square from the start.
  assert.notEqual(puzzle.walls[puzzle.start[0]][puzzle.start[1]], null);
  assert.notEqual(puzzle.walls[puzzle.goal[0]][puzzle.goal[1]], null);
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
  assert.equal(hintSquares(start(generate(seedForDay('2026-11-14')))).length, 8); // 8 squares at a time in a big maze
});

test('after a wrong turn, the hint starts where the path left the route', () => {
  const lost = step(start(tiny), [1, 0]);
  assert.equal(offRoute(lost), true);
  assert.deepEqual(hintSquares(lost), [[0, 1], [1, 1]]);
  assert.equal(offRoute(start(tiny)), false);
});

// --- two sizes ---

test('the 20 by 20 maze is perfect every day for two years, in every outline', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key), SMALL_SIZE);
    assert.ok(verify(puzzle).ok, `${key}: ${verify(puzzle).problems.join('; ')}`);
    assert.equal(puzzle.size, SMALL_SIZE);
    assert.ok(solution(puzzle).length >= 60, `${puzzle.shape}: route of ${solution(puzzle).length}`);
  });
  for (const shape of Object.keys(SHAPES)) {
    assert.ok(verify(generate(seedForDay('2026-11-14'), SMALL_SIZE, shape)).ok, shape);
  }
});

test('the day\'s two mazes are different mazes, and often different outlines', () => {
  let differentOutline = 0;
  everyDay((key) => {
    const small = generate(seedForDay(key), SMALL_SIZE);
    const big = generate(seedForDay(key), SIZE);
    assert.notDeepEqual(small.walls, big.walls);
    if (small.shape !== big.shape) differentOutline++;
  }, 100);
  assert.ok(differentOutline > 60, `${differentOutline} of 100 days`);
});

test('leaving the size out makes the big maze', () => {
  assert.deepEqual(generate(seedForDay('2026-11-14')), generate(seedForDay('2026-11-14'), SIZE));
});
