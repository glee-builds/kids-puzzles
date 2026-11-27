// Tests for src/games/tangram-pond.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { PICTURES, generate, verify, start, check, fits } from '../src/games/tangram-pond.js';

const seed = (key) => seedFor(key, 'tangram-pond');
const sample = generate(seed('2026-11-26'), 0);
const withPieces = (pieces) => ({ ...sample, pieces });
const square = (x, y, color = 'go') => ({ shape: [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], color });

test('every picture is well made: 5 to 7 pieces that touch, stay on the grid, and never overlap', () => {
  assert.ok(PICTURES.length >= 10);
  assert.equal(new Set(PICTURES.map((picture) => picture.name)).size, PICTURES.length);
  for (const picture of PICTURES) {
    assertValid(verify({ ...picture, tray: picture.pieces.map((_, i) => i) }), picture.name);
    // At least two different shapes, so there is something to work out.
    assert.ok(picture.pieces.some((piece) => !fits(piece, picture.pieces[0])), picture.name);
  }
});

test('every day for two years makes a valid picture, and none repeats until all have been used', () => {
  const names = [];
  everyDay((key, day) => {
    const puzzle = generate(seed(key), day);
    assertValid(verify(puzzle), key);
    names.push(puzzle.name);
  });
  for (let day = 0; day + PICTURES.length <= names.length; day++) {
    assert.equal(new Set(names.slice(day, day + PICTURES.length)).size, PICTURES.length);
  }
});

test('the same seed and day always make the same puzzle; days differ', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 0), sample);
  const puzzles = new Set();
  everyDay((key, day) => puzzles.add(JSON.stringify(generate(seed(key), day))));
  assert.ok(puzzles.size > 400);
});

test('fits: the same shape after sliding, but not after turning', () => {
  assert.equal(fits(square(0, 0), square(4, 3)), true);
  assert.equal(fits({ shape: [[4, 4], [5, 4], [5, 5], [4, 5]] }, { shape: [[1, 2], [0, 2], [0, 1], [1, 1]] }), true); // corners listed from a different start
  assert.equal(fits({ shape: [[0, 0], [1, 0], [1, 1]] }, { shape: [[0, 0], [1, 0], [0, 1]] }), false); // a turned triangle
  assert.equal(fits(square(0, 0), { shape: [[0, 0], [2, 0], [2, 1], [0, 1]] }), false);
});

test('check: every piece in its own place wins with no misses', () => {
  for (const picture of PICTURES) {
    let state = start({ ...picture, tray: [] });
    picture.pieces.forEach((_, i) => {
      state = check(state, { piece: i, place: i });
      assert.equal(state.last.correct, true);
    });
    assert.deepEqual([state.status, state.misses, state.helped], ['won', 0, 0]);
    assert.throws(() => check(state, { piece: 0, place: 0 }));
  }
});

test('check: a piece can go in the place of another piece with the same shape', () => {
  const house = start({ ...PICTURES.find((picture) => picture.name === 'house'), tray: [] });
  const state = check(house, { piece: 1, place: 2 }); // the two flat rectangles
  assert.equal(state.last.correct, true);
  assert.equal(state.placed[2], 1);
  assert.throws(() => check(state, { piece: 1, place: 1 })); // already placed
  assert.throws(() => check(state, { piece: 2, place: 2 })); // already filled
  assert.throws(() => check(house, { piece: 9, place: 0 }));
});

test('check: a miss is counted, and two misses in a row with one piece make its place glow', () => {
  const house = start({ ...PICTURES.find((picture) => picture.name === 'house'), tray: [] });
  let state = check(house, { piece: 0, place: 3 }); // the roof on a square
  assert.deepEqual([state.last.correct, state.last.hinted, state.misses, state.helped, state.glow], [false, false, 1, 0, null]);
  assert.deepEqual(state.placed, {});
  state = check(state, { piece: 0, place: 4 });
  assert.deepEqual([state.last.hinted, state.misses, state.helped, state.glow], [true, 2, 1, 0]);
  state = check(state, { piece: 0, place: 3 }); // a third miss gives no second hint
  assert.deepEqual([state.last.hinted, state.misses, state.helped], [false, 3, 1]);

  // Misses with different pieces are not "in a row".
  state = check(house, { piece: 0, place: 3 });
  state = check(state, { piece: 3, place: 0 });
  assert.deepEqual([state.last.hinted, state.misses, state.helped], [false, 2, 0]);
  // The glow goes to an empty place: with place 1 filled, piece 2's hint is place 2.
  state = check(house, { piece: 2, place: 1 });
  state = check(check(state, { piece: 1, place: 0 }), { piece: 1, place: 3 });
  assert.equal(state.glow, 2);
});

test('verify turns away bad pictures', () => {
  const pieces = sample.pieces;
  const moved = (i, corners) => withPieces(pieces.map((piece, k) => (k === i ? { ...piece, shape: corners } : piece)));
  assert.equal(verify(withPieces(pieces.slice(0, 4))).ok, false); // too few pieces
  assert.equal(verify({ ...sample, pieces: Array.from({ length: 8 }, (_, i) => square(i % 6, 0)), tray: [0, 1, 2, 3, 4, 5, 6, 7] }).ok, false); // too many
  assert.equal(verify(moved(0, [[5, 5], [7, 5], [7, 6], [5, 6]])).ok, false); // off the grid
  assert.equal(verify(moved(0, pieces[1].shape)).ok, false); // one piece on top of another
  assert.equal(verify(moved(0, [[0, 0], [2, 0], [2, 1]])).ok, false); // an edge that is not a square's diagonal
  assert.equal(verify(withPieces(pieces.map((piece, k) => (k ? piece : { ...piece, color: 'mud' })))).ok, false);
  assert.equal(verify({ ...sample, tray: sample.tray.slice(1) }).ok, false);
  // Five squares in a row are fine; move one away and they no longer all touch.
  const row = [0, 1, 2, 3, 4].map((x) => square(x, 0));
  assertValid(verify({ name: 'row', pieces: row, tray: [0, 1, 2, 3, 4] }), 'a row of squares');
  assert.equal(verify({ name: 'row', pieces: [...row.slice(0, 4), square(4, 3)], tray: [0, 1, 2, 3, 4] }).ok, false);
  // Two overlapping pieces whose middles are not inside each other: the areas still give it away.
  const wide = { shape: [[0, 0], [2, 0], [2, 1], [0, 1]], color: 'go' };
  const shifted = { shape: [[1, 0], [3, 0], [3, 1], [1, 1]], color: 'go' };
  assert.equal(verify({ name: 'row', pieces: [wide, shifted, square(3, 0), square(4, 0), square(5, 0)], tray: [0, 1, 2, 3, 4] }).ok, false);
});
