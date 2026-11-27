// Tests for src/games/lily-pad-paths.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, step, check, isJoined, isSolved, BOARDS } from '../src/games/lily-pad-paths.js';

const seed = (key) => seedFor(key, 'lily-pad-paths');
const sample = generate(seed('2026-11-26'));
const next = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

/** Draw the stored solution path for one pair, square by square. */
const join = (state, pair) => state.puzzle.solution[pair].reduce((now, square) => step(now, pair, square), state);

test('every day for two years, at every level, makes a valid puzzle that its solution solves', () => {
  for (const level of [1, 2, 3]) {
    const { size, count } = BOARDS[level - 1];
    everyDay((key) => {
      const puzzle = generate(seed(key), level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      assert.deepEqual([puzzle.size, puzzle.pairs.length], [size, count]);
      assert.equal(new Set(puzzle.pairs.map((pair) => pair.emoji)).size, count, 'each pair is a different animal');
      for (const path of puzzle.solution) {
        assert.ok(path.length >= 3, `${key}: a path is too short`);
        assert.ok(!next(path[0], path.at(-1)), `${key}: a pair starts out side by side`);
      }
      // Playing the solution through the game's own rules wins.
      const played = puzzle.pairs.reduce((state, _, pair) => join(state, pair), start(puzzle));
      assert.equal(played.status, 'won', `level ${level}, ${key}`);
    });
  }
});

test('the same day and level always make the same puzzle; days differ', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 1), sample);
  for (const level of [1, 2, 3]) {
    const puzzles = new Set();
    everyDay((key) => puzzles.add(JSON.stringify(generate(seed(key), level))));
    assert.ok(puzzles.size > 600, `level ${level}: only ${puzzles.size} different puzzles in 730 days`);
  }
});

// A small board made by hand: frogs in two corners of the top row, ducks under them.
//   F . F
//   D . D
//   . . .
const board = {
  level: 1,
  size: 3,
  pairs: [{ emoji: '🐸', name: 'frog', ends: [[0, 0], [0, 2]] }, { emoji: '🦆', name: 'duck', ends: [[1, 0], [1, 2]] }],
  solution: [[[0, 0], [0, 1], [0, 2]], [[1, 0], [1, 1], [1, 2]]],
};

test('step: a path starts on its own animal, grows square by square, and joins at the match', () => {
  assertValid(verify(board), 'the small board');
  let state = start(board);
  assert.equal(step(state, 0, [0, 1]), state, 'a path cannot start on an empty square');
  assert.equal(step(state, 0, [1, 0]), state, 'or on another animal');
  state = step(state, 0, [0, 0]);
  state = step(state, 0, [0, 1]);
  assert.deepEqual(state.paths[0], [[0, 0], [0, 1]]);
  assert.equal(isJoined(state, 0), false);
  state = check(state, { pair: 0, square: [0, 2] }); // check is the same move
  assert.equal(isJoined(state, 0), true);
  assert.deepEqual([state.status, isSolved(state)], ['playing', false]); // the ducks are still apart
  assert.equal(step(state, 0, [1, 2]), state, 'a joined path does not grow');
});

test('step: tracing back shortens; other animals, other paths and far squares just stop the path', () => {
  let state = step(step(start(board), 0, [0, 0]), 0, [0, 1]);
  assert.deepEqual(step(state, 0, [0, 0]).paths[0], [[0, 0]], 'back over the square before the end');
  state = step(state, 0, [1, 1]); // the frogs wander down the middle
  assert.equal(step(state, 0, [1, 0]), state, 'not onto a duck');
  assert.equal(step(state, 0, [2, 2]), state, 'not to a square that is not a neighbour');
  assert.equal(step(state, 0, [0, 1]).paths[0].length, 2, 'back again');
  const ducks = step(state, 1, [1, 0]);
  assert.equal(step(ducks, 1, [1, 1]), ducks, 'not onto the frog path');
  assert.equal(step(ducks, 1, [0, 0]), ducks, 'not onto a frog');
});

test('any paths that join every pair win, not only the stored ones', () => {
  let state = join(start(board), 0);
  for (const square of [[1, 0], [2, 0], [2, 1], [2, 2], [1, 2]]) state = step(state, 1, square); // the long way round
  assert.deepEqual([state.status, isSolved(state)], ['won', true]);
  assert.equal(step(state, 1, [2, 2]), state, 'nothing moves after the win');
});

test('verify turns away bad puzzles', () => {
  const withPairs = (pairs) => ({ ...board, pairs });
  const withPaths = (solution) => ({ ...board, solution });
  const frogs = board.pairs[0];
  const ducks = board.pairs[1];
  assert.equal(verify(withPairs([{ ...frogs, ends: [[0, 0], [0, 3]] }, ducks])).ok, false, 'an animal outside the grid');
  assert.equal(verify(withPairs([frogs, { ...ducks, ends: [[0, 0], [1, 2]] }])).ok, false, 'two animals on one square');
  assert.equal(verify(withPaths([board.solution[0]])).ok, false, 'a pair with no path');
  assert.equal(verify(withPaths([[[0, 0], [0, 1]], board.solution[1]])).ok, false, 'a path that stops short');
  assert.equal(verify(withPaths([[[0, 0], [0, 2]], board.solution[1]])).ok, false, 'a path that jumps');
  assert.equal(verify(withPaths([[[0, 0], [1, 0], [1, 1], [1, 2], [0, 2]], board.solution[1]])).ok, false, 'paths that share squares');
  assert.equal(verify(withPaths([[[0, 0], [0, 1], [0, 0], [0, 1], [0, 2]], board.solution[1]])).ok, false, 'a path that uses a square twice');
});
