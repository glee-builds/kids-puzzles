// Tests for src/games/coin-count.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, check, hint, totalOf, countingOn, COINS, HANDFULS, MAX_TRIES,
} from '../src/games/coin-count.js';

const seedForDay = (key) => seedFor(key, 'coin-count');
const sample = generate(seedForDay('2026-11-13'));

test('totalOf adds the coins, and countingOn starts with the biggest', () => {
  assert.equal(totalOf(['penny', 'quarter', 'dime', 'nickel']), 41);
  assert.equal(countingOn(['penny', 'quarter', 'dime', 'nickel']), '25, 35, 40, 41');
});

test('every day for two years, at every level, makes 4 valid handfuls', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seedForDay(key), level);
      const result = verify(puzzle);
      assert.ok(result.ok, `level ${level}, ${key}: ${result.problems.join('; ')}`);
    });
  }
});

test('level 1 has no quarters and is in order; level 3 shows names', () => {
  everyDay((key) => {
    for (const { coins, names } of generate(seedForDay(key), 1).rounds) {
      assert.ok(!coins.includes('quarter') && !names);
      assert.deepEqual(coins, [...coins].sort((a, b) => COINS[b] - COINS[a]));
    }
    assert.ok(generate(seedForDay(key), 3).rounds.every((r) => r.names));
  }, 60);
});

test('the right totals win; the third miss shows the total and moves on', () => {
  let state = start(sample);
  for (const { total } of sample.rounds) state = check(state, total);
  assert.equal(state.status, 'won');
  assert.equal(state.round, HANDFULS);

  state = start(sample);
  for (let i = 0; i < MAX_TRIES; i++) state = check(state, 0);
  assert.equal(state.last.shown, true);
  assert.equal(state.round, 1);
  assert.deepEqual(state.shown, [0]);
});

test('the hint gets stronger: a rule first, then counting on', () => {
  const round = { coins: ['dime', 'nickel', 'penny'], total: 16, names: false };
  assert.match(hint(round, 1), /biggest coin/);
  assert.match(hint(round, 2), /10, 15, 16/);
  assert.match(hint({ ...round, names: true }, 1), /dime is 10/);
});

test('verify catches a wrong total', () => {
  const broken = structuredClone(sample);
  broken.rounds[0].total += 1;
  assert.equal(verify(broken).ok, false);
});
