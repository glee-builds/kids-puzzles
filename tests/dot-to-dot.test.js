// Tests for src/games/dot-to-dot.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, hint, PICTURES, STEPS } from '../src/games/dot-to-dot.js';

const seed = (key) => seedFor(key, 'dot-to-dot');

test('every picture is valid counting by 3s, 4s, and 6s, and never counts past 12 times the step', () => {
  for (const [picture, points] of Object.entries(PICTURES)) {
    for (const step of STEPS) {
      const puzzle = { picture, step, points, labels: points.map((_, i) => step * (i + 1)) };
      assertValid(verify(puzzle), `${picture} by ${step}s`);
      assert.ok(puzzle.labels.at(-1) <= 12 * step);
    }
  }
});

test('every day for two years makes a valid picture; the step goes 3, 4, 6 in turn', () => {
  const steps = [];
  everyDay((key, day) => {
    const puzzle = generate(seed(key), day);
    assertValid(verify(puzzle), key);
    steps.push(puzzle.step);
  });
  assert.deepEqual(steps.slice(0, 6), [3, 4, 6, 3, 4, 6]);
});

test('the same day always makes the same picture, and every picture comes around', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 329), generate(seed('2026-11-26'), 329));
  const seen = new Set();
  for (let day = 0; day < Object.keys(PICTURES).length; day++) seen.add(generate(0, day).picture);
  assert.equal(seen.size, Object.keys(PICTURES).length);
});

test('the dots say the multiples of the step', () => {
  const puzzle = generate(0, 2); // day 2 counts by 6s
  assert.equal(puzzle.step, 6);
  assert.deepEqual(puzzle.labels.slice(0, 4), [6, 12, 18, 24]);
});

test('check: the next dot joins on, a wrong dot does not, and the last dot wins', () => {
  const puzzle = generate(0, 0);
  let state = check(start(puzzle), 3);
  assert.deepEqual([state.next, state.tries, state.last.correct], [0, 1, false]);
  state = check(state, 0);
  assert.deepEqual([state.next, state.tries, state.last.correct], [1, 0, true]);
  for (let dot = 1; dot < puzzle.points.length; dot++) state = check(state, dot);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 0));
});

test('hint: where to start, then what to add', () => {
  const puzzle = generate(0, 1); // by 4s
  assert.equal(hint(start(puzzle)), 'Start at 4.');
  assert.equal(hint(check(start(puzzle), 0)), 'After 4 comes 8. Add 4.');
});

test('verify turns away dots that are too close, off the board, or mislabeled', () => {
  const good = generate(0, 0);
  assert.equal(verify({ ...good, points: [[50, 50], [52, 52], ...good.points.slice(2)] }).ok, false);
  assert.equal(verify({ ...good, points: [[0, 50], ...good.points.slice(1)] }).ok, false);
  assert.equal(verify({ ...good, labels: good.labels.map((n) => n + 1) }).ok, false);
  assert.equal(verify({ ...good, step: 5 }).ok, false);
});
