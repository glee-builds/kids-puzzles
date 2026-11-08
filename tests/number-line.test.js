// Tests for src/games/number-line.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, positions, start, check, hint, windowFor, HOPS, MAX_TRIES,
} from '../src/games/number-line.js';

const seedForDay = (key) => seedFor(key, 'number-line');

// A fixed set of hops: 34 → 44 → 41 → 61 → 66 → 56
const fixed = {
  start: 34,
  hops: [
    { op: '+', amount: 10 },
    { op: '-', amount: 3 },
    { op: '+', amount: 20 },
    { op: '+', amount: 5 },
    { op: '-', amount: 10 },
  ],
};

// --- generate ---

test('positions follows each hop', () => {
  assert.deepEqual(positions(fixed), [34, 44, 41, 61, 66, 56]);
});

test('generate gives the same hops for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08')), generate(seedForDay('2026-11-08')));
});

test('every day for two years makes valid hops between 0 and 100', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key));
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.hops.length, HOPS);
  });
});

test('verify catches hops that leave 0 to 100 or are all the same kind', () => {
  assert.equal(verify(fixed).ok, true);
  assert.equal(verify({ start: 95, hops: fixed.hops }).ok, false); // 95 + 10 = 105
  const allTens = fixed.hops.map((h) => ({ ...h, amount: 10 }));
  assert.equal(verify({ start: 50, hops: allTens }).ok, false);
  const allForward = fixed.hops.map((h) => ({ ...h, op: '+' }));
  assert.equal(verify({ start: 10, hops: allForward }).ok, false);
});

// --- check ---

test('check: the right landing spot moves to the next hop', () => {
  const state = check(start(fixed), 44);
  assert.equal(state.hop, 1);
  assert.equal(state.last.correct, true);
});

test('check: a wrong answer stays on the same hop', () => {
  const state = check(start(fixed), 45);
  assert.equal(state.hop, 0);
  assert.equal(state.tries[0], 1);
});

test(`check: after ${MAX_TRIES} misses the frog hops there itself`, () => {
  let state = start(fixed);
  for (let i = 0; i < MAX_TRIES; i++) state = check(state, 1);
  assert.equal(state.hop, 1);
  assert.deepEqual(state.revealed, [0]);
  assert.equal(state.last.revealed, true);
});

test('check: answering every hop wins', () => {
  let state = start(fixed);
  for (const spot of positions(fixed).slice(1)) state = check(state, spot);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 1));
});

// --- hints ---

test('hint: tens hops talk about the tens digit, then show the sentence', () => {
  let state = start(fixed);
  assert.equal(hint(state), '+10 means one ten more. Change the tens digit.');
  state = check(check(state, 1), 1);
  assert.equal(hint(state), '34 + 10 = ?');
});

test('hint: ones hops say count on or count back', () => {
  const state = check(start(fixed), 44); // now on hop 1: 44 − 3
  assert.equal(hint(state), 'Count back 3 from 44.');
});

test('hint: bigger tens hops name the number of tens', () => {
  let state = start(fixed);
  for (const spot of [44, 41]) state = check(state, spot); // now on hop 2: 41 + 20
  assert.equal(hint(state), '+20 means 2 tens more. Change the tens digit.');
});

// --- windowFor ---

test('windowFor always shows the frog and where it lands, at least 20 wide', () => {
  for (const [from, to] of [[34, 44], [41, 61], [5, 2], [95, 100], [100, 90], [0, 9], [58, 78]]) {
    const { lo, hi } = windowFor(from, to);
    assert.ok(lo <= Math.min(from, to) && hi >= Math.max(from, to), `${from}→${to}: ${lo}-${hi}`);
    assert.ok(hi - lo >= 20, `${from}→${to}: only ${hi - lo} wide`);
    assert.ok(lo >= 0 && hi <= 100, `${from}→${to}: ${lo}-${hi} leaves 0-100`);
    assert.equal(lo % 10, 0);
  }
});
