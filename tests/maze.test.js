// Tests for src/games/maze.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, dayKey } from './helpers.js';
import {
  generate, verify, solution, canMove, start, step, hintSquares, offRoute, gridFor, SIZE, SMALL_SIZE, SHAPES, N, E, S, W,
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

test("the day's two mazes are both the regular size, with different paths and different outlines", () => {
  everyDay((key) => {
    const first = generate(seedForDay(key), SMALL_SIZE);
    const second = generate(seedForDay(key), SMALL_SIZE, undefined, undefined, true);
    assert.equal(second.size, SMALL_SIZE);
    assert.notEqual(first.shape, second.shape);
    assert.notDeepEqual(first.walls, second.walls);
    assert.deepEqual(verify(second), { ok: true, problems: [] });
    assert.deepEqual(second, generate(seedForDay(key), SMALL_SIZE, undefined, undefined, true)); // same day, same maze
  }, 100);
});

test('leaving the size out makes a 30 by 30 maze', () => {
  assert.deepEqual(generate(seedForDay('2026-11-14')), generate(seedForDay('2026-11-14'), SIZE));
});

// --- shaped to the screen ---

const ROOMS = {
  'small phone': { width: 363, height: 417 },
  'tall phone': { width: 378, height: 594 },
  'iPad upright': { width: 579, height: 538 },
  'iPad sideways': { width: 1012, height: 518 },
};

test('gridFor: with no room the grid is square; with room it takes its shape and keeps about the same squares', () => {
  assert.deepEqual(gridFor(20), { cols: 20, rows: 20 });
  assert.deepEqual(gridFor(20, { width: 0, height: 100 }), { cols: 20, rows: 20 });
  assert.deepEqual(gridFor(20, { width: 300, height: 300 }), { cols: 20, rows: 20 });
  for (const size of [SMALL_SIZE, SIZE]) {
    for (const [name, room] of Object.entries(ROOMS)) {
      const { cols, rows } = gridFor(size, room);
      assert.ok(Math.abs(cols * rows - size * size) <= size, `${name}: ${cols} x ${rows}`);
      assert.equal(cols > rows, room.width > room.height, `${name}: ${cols} x ${rows}`);
    }
  }
  const tall = gridFor(20, ROOMS['tall phone']);
  assert.ok(tall.rows > tall.cols + 4, 'a tall phone gets a tall maze');
});

test('gridFor: a very long, thin room is never more than twice as long one way', () => {
  const { cols, rows } = gridFor(20, { width: 2000, height: 100 });
  assert.ok(cols <= rows * 2 + 1, `${cols} x ${rows}`);
});

test('every outline makes a valid maze in every screen shape, at both sizes', () => {
  for (const size of [SMALL_SIZE, SIZE]) {
    for (const [name, room] of Object.entries(ROOMS)) {
      for (const shape of Object.keys(SHAPES)) {
        const puzzle = generate(seedForDay('2026-11-14'), size, shape, room);
        const result = verify(puzzle);
        assert.ok(result.ok, `${size}, ${name}, ${shape}: ${result.problems.join('; ')}`);
        assert.equal(puzzle.walls.length, puzzle.rows);
        assert.equal(puzzle.walls[0].length, puzzle.cols);
        assert.ok(solution(puzzle).length >= size * 2, `${size}, ${name}, ${shape}: the route is ${solution(puzzle).length} squares`);
      }
    }
  }
});

test('the same day and the same screen always make the same maze', () => {
  const room = ROOMS['tall phone'];
  assert.deepEqual(generate(seedForDay('2026-11-14'), SMALL_SIZE, undefined, room), generate(seedForDay('2026-11-14'), SMALL_SIZE, undefined, room));
});
