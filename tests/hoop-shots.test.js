// Tests for src/games/hoop-shots.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, judge, shotGoesIn, TARGET } from '../src/games/hoop-shots.js';

const seed = (key) => seedFor(key, 'hoop-shots');

test('every day for two years is the same valid game: play to 20', () => {
  everyDay((key) => {
    const puzzle = generate(seed(key));
    assertValid(verify(puzzle), key);
    assert.deepEqual(puzzle, { target: 20 });
  });
  assert.equal(TARGET, 20);
});

test('straight, long swipes go in', () => {
  for (const three of [false, true]) {
    for (const dy of [0.35, 0.5, 0.8, 1]) {
      for (const dx of [-0.07, -0.03, 0, 0.03, 0.07]) assert.ok(shotGoesIn({ dx, dy }, three), `${dx}, ${dy}, three: ${three}`);
    }
  }
});

test('sideways, short, and downward swipes do not go in', () => {
  for (const three of [false, true]) {
    for (const dx of [-0.5, -0.2, 0.13, 0.3]) assert.equal(judge({ dx, dy: 0.6 }, three), 'wide');
    for (const dy of [-0.5, 0, 0.1, 0.19]) assert.equal(judge({ dx: 0, dy }, three), 'short');
    assert.equal(shotGoesIn({ dx: 0.4, dy: 0.05 }, three), false);
  }
});

test('3 points is stricter: it needs a longer and straighter swipe', () => {
  assert.ok(shotGoesIn({ dx: 0, dy: 0.25 }, false));
  assert.equal(judge({ dx: 0, dy: 0.25 }, true), 'short');
  assert.ok(shotGoesIn({ dx: 0.1, dy: 0.6 }, false));
  assert.equal(judge({ dx: 0.1, dy: 0.6 }, true), 'wide');
  // Anything that goes in for 3 would also go in for 2.
  for (let dx = -0.3; dx <= 0.3; dx += 0.01) {
    for (let dy = 0; dy <= 1; dy += 0.05) {
      if (shotGoesIn({ dx, dy }, true)) assert.ok(shotGoesIn({ dx, dy }, false));
    }
  }
});

test('keyboard shots: under the hoop goes in, three slides to the side misses', () => {
  for (const three of [false, true]) {
    assert.ok(shotGoesIn({ dx: 0, dy: 1 }, three));
    assert.equal(shotGoesIn({ dx: 3 * 0.05, dy: 1 }, three), false);
  }
});

test('check: a basket adds 2 or 3, a miss adds nothing, and 20 or more wins', () => {
  let state = check(start(generate(1)), { made: false, three: true });
  assert.deepEqual([state.score, state.status, state.last], [0, 'playing', { made: false, points: 0 }]);
  state = check(state, { made: true, three: false });
  assert.deepEqual([state.score, state.last.points], [2, 2]);
  state = check(state, { made: true, three: true });
  assert.equal(state.score, 5);
  for (let i = 0; i < 4; i++) state = check(state, { made: true, three: true });
  assert.deepEqual([state.score, state.status], [17, 'playing']);
  const before = state;
  state = check(state, { made: true, three: true }); // 20 exactly
  assert.deepEqual([state.score, state.status], [20, 'won']);
  assert.equal(before.score, 17); // check returns a new state
  assert.throws(() => check(state, { made: true, three: false }));
  // Going past 20 wins too: 19 + 3.
  assert.equal(check({ ...before, score: 19 }, { made: true, three: true }).status, 'won');
});

test('verify turns away a game that is not played to 20', () => {
  assert.equal(verify({ target: 10 }).ok, false);
  assert.equal(verify({ target: '20' }).ok, false);
  assert.equal(verify({}).ok, false);
  assert.equal(verify(null).ok, false);
});
