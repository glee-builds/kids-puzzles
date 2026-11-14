// Tests for src/games/fact-families.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, factsFor, start, check, hint, prompt, currentWindow, HOUSES, MAX_TRIES, FIRST_HOUSE_MAX,
} from '../src/games/fact-families.js';

const seedForDay = (key) => seedFor(key, 'fact-families');

const fixed = { houses: [{ a: 7, b: 8, c: 15 }, { a: 12, b: 25, c: 37 }, { a: 30, b: 44, c: 74 }] };

// --- generate ---

test('factsFor makes the four facts of a family', () => {
  assert.deepEqual(factsFor({ a: 7, b: 8, c: 15 }), ['7+8=15', '8+7=15', '15-7=8', '15-8=7']);
});

test('generate gives the same street for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08')), generate(seedForDay('2026-11-08')));
});

test('every day for two years makes a valid street', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key));
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.houses.length, HOUSES);
    assert.ok(puzzle.houses[0].c <= FIRST_HOUSE_MAX);
  });
});

test('verify catches a wrong sum, a double, and a too-big number', () => {
  assert.equal(verify(fixed).ok, true);
  assert.equal(verify({ houses: [{ a: 7, b: 8, c: 16 }, ...fixed.houses.slice(1)] }).ok, false);
  assert.equal(verify({ houses: [{ a: 6, b: 6, c: 12 }, ...fixed.houses.slice(1)] }).ok, false);
  assert.equal(verify({ houses: [fixed.houses[0], fixed.houses[1], { a: 50, b: 60, c: 110 }] }).ok, false);
});

// --- check ---

test('check: a true adding fact lights the window', () => {
  const state = check(start(fixed), [7, 8, 15]);
  assert.equal(state.last.result, 'lit');
  assert.equal(currentWindow(state), 1);
});

test('check: the same fact twice is a repeat, not a miss', () => {
  const state = check(check(start(fixed), [7, 8, 15]), [7, 8, 15]);
  assert.equal(state.last.result, 'repeat');
  assert.equal(currentWindow(state), 1);
  assert.deepEqual(state.tries, {});
});

test('check: the switched order lights the second window', () => {
  const state = check(check(start(fixed), [7, 8, 15]), [8, 7, 15]);
  assert.equal(state.last.result, 'lit');
  assert.equal(currentWindow(state), 2);
});

test('check: take-away windows need take-away facts', () => {
  let state = check(check(start(fixed), [7, 8, 15]), [8, 7, 15]);
  state = check(state, [7, 8, 15]); // an adding fact in a take-away window
  assert.equal(state.last.result, 'wrong');
  state = check(state, [15, 7, 8]);
  assert.equal(state.last.result, 'lit');
});

test('check: four windows light the house and move to the next', () => {
  let state = start(fixed);
  for (const fact of [[7, 8, 15], [8, 7, 15], [15, 8, 7], [15, 7, 8]]) state = check(state, fact);
  assert.equal(state.house, 1);
  assert.deepEqual(state.lit[0], ['7+8=15', '8+7=15', '15-8=7', '15-7=8']);
});

test(`check: after ${MAX_TRIES} misses the window fills itself in`, () => {
  let state = start(fixed);
  for (let i = 0; i < MAX_TRIES; i++) state = check(state, [15, 7, 8]); // take-away in an adding window
  assert.equal(state.last.result, 'shown');
  assert.deepEqual(state.lit[0], ['7+8=15']);
  assert.deepEqual(state.revealed, ['0-0']);
});

test('check: lighting all three houses wins', () => {
  let state = start(fixed);
  for (const { a, b, c } of fixed.houses) {
    for (const fact of [[a, b, c], [b, a, c], [c, a, b], [c, b, a]]) state = check(state, fact);
  }
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, [7, 8, 15]));
});

// --- hints ---

test('hint: the rule first, then the first number of a missing fact', () => {
  let state = start(fixed);
  assert.match(hint(state), /adding fact/);
  state = check(check(state, [15, 7, 8]), [15, 8, 7]);
  assert.equal(hint(state), 'Try starting with 7.');
});

test('hint: take-away windows say to start with the biggest number', () => {
  const state = check(check(start(fixed), [7, 8, 15]), [8, 7, 15]);
  assert.equal(hint(state), 'In a take-away fact, start with the biggest number.');
});

// --- prompts ---

test('prompt: adding facts first, then take-away, then nothing once won', () => {
  let state = start(fixed);
  assert.match(prompt(state), /adding fact/);
  state = check(state, [7, 8, 15]);
  assert.match(prompt(state), /Switch the order/);
  state = check(state, [8, 7, 15]);
  assert.match(prompt(state), /take-away/);
  state = check(check(state, [15, 7, 8]), [15, 8, 7]);
  assert.match(prompt(state), /adding fact/); // the next house starts over
  for (const { a, b, c } of fixed.houses.slice(1)) {
    for (const fact of [[a, b, c], [b, a, c], [c, a, b], [c, b, a]]) state = check(state, fact);
  }
  assert.equal(prompt(state), '');
});

// --- levels: times families ---

test('a times family makes two times facts and two divide facts', () => {
  assert.deepEqual(factsFor({ a: 3, b: 4, c: 12, times: true }), ['3×4=12', '4×3=12', '12÷3=4', '12÷4=3']);
});

test('level 1 is the same as before; levels 2 and 3 end with 1 and 2 times houses', () => {
  everyDay((key) => {
    assert.deepEqual(generate(seedForDay(key), 1), generate(seedForDay(key)));
    for (const [level, timesHouses] of [[1, 0], [2, 1], [3, 2]]) {
      const puzzle = generate(seedForDay(key), level);
      const result = verify(puzzle);
      assert.ok(result.ok, `level ${level}, ${key}: ${result.problems.join('; ')}`);
      assert.equal(puzzle.houses.filter((h) => h.times).length, timesHouses);
      assert.ok(!puzzle.houses[0].times);
    }
  });
});

test('a times house is played with times and divide facts', () => {
  const puzzle = { houses: [{ a: 3, b: 5, c: 8 }, { a: 20, b: 30, c: 50 }, { a: 3, b: 4, c: 12, times: true }] };
  let state = start(puzzle);
  for (const fact of [[3, 5, 8], [5, 3, 8], [8, 3, 5], [8, 5, 3], [20, 30, 50], [30, 20, 50], [50, 20, 30], [50, 30, 20]]) state = check(state, fact);
  assert.equal(state.house, 2);
  assert.match(prompt(state), /times fact/);
  state = check(state, [3, 4, 12]);
  assert.equal(state.last.result, 'lit');
  state = check(state, [4, 3, 12]);
  assert.match(prompt(state), /divide fact/);
  state = check(state, [3, 12, 4]); // not a true divide fact
  assert.equal(state.last.result, 'wrong');
  assert.match(hint(state), /divide fact, start with the biggest/);
  state = check(state, [12, 3, 4]);
  state = check(state, [12, 4, 3]);
  assert.equal(state.status, 'won');
});
