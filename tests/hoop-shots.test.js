// Tests for src/games/hoop-shots.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, launch, fly, SPOTS, TARGET } from '../src/games/hoop-shots.js';

const seed = (key) => seedFor(key, 'hoop-shots');
const LENGTHS = Array.from({ length: 121 }, (_, i) => i / 2); // swipes of 0 to 60 court units
/** Whether a swipe of this length (and slant from straight up) scores from a spot. */
const scores = (spot, length, slant = 0) => fly(spot, launch({ up: length * Math.cos(slant), toward: length * Math.sin(slant) })).made;
/** The straight-up swipe lengths that score from a spot. */
const scoring = (spot) => LENGTHS.filter((length) => scores(spot, length));

test('every day for two years is the same valid game: play to 20', () => {
  everyDay((key) => {
    const puzzle = generate(seed(key));
    assertValid(verify(puzzle), key);
    assert.deepEqual(puzzle, { target: 20 });
  });
  assert.equal(TARGET, 20);
});

test('a swipe of the right length scores from both spots, with room to spare', () => {
  for (const spot of SPOTS) {
    const lengths = scoring(spot);
    assert.ok(lengths.length >= 16, `${lengths.length} lengths score`); // at least 8 court units of room
    // Nearly every length between the softest and hardest good shot scores (a real ball
    // sometimes rattles out of the rim, so one or two may not).
    const between = (lengths.at(-1) - lengths[0]) * 2 + 1;
    assert.ok(between - lengths.length <= 2, `${between - lengths.length} misses inside the range`);
  }
});

test('a shot much too soft or much too hard does not go in', () => {
  for (const spot of SPOTS) {
    const lengths = scoring(spot);
    const short = fly(spot, launch({ up: lengths[0] - 6, toward: 0 }));
    const long = fly(spot, launch({ up: lengths.at(-1) + 12, toward: 0 }));
    assert.equal(short.made, false);
    assert.equal(long.made, false);
  }
});

test('3 points takes a longer swipe than 2', () => {
  assert.ok(scoring(SPOTS[1])[0] > scoring(SPOTS[0])[0]);
});

test('a slanted swipe can score too, with a flatter arc', () => {
  for (const spot of SPOTS) assert.ok(LENGTHS.some((length) => scores(spot, length, Math.PI / 6)));
});

test('the flight is the same every time, and the ball never goes through the floor', () => {
  const shot = launch({ up: 25, toward: 0 });
  assert.deepEqual(fly(SPOTS[0], shot), fly(SPOTS[0], shot));
  for (let length = 5; length <= 60; length += 5) {
    for (const [, y] of fly(SPOTS[1], launch({ up: length, toward: 3 })).path) assert.ok(y >= 0);
  }
});

test('launch: a longer swipe is a faster shot, and a downward swipe still goes up', () => {
  const speed = ({ vx, vy }) => Math.hypot(vx, vy);
  assert.ok(speed(launch({ up: 30, toward: 0 })) > speed(launch({ up: 15, toward: 0 })));
  assert.ok(launch({ up: -10, toward: 5 }).vy > 0);
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
  state = check(state, { made: true, three: true }); // 20 exactly
  assert.deepEqual([state.score, state.status], [20, 'won']);
  assert.throws(() => check(state, { made: true, three: false }));
  assert.equal(check({ ...state, score: 19, status: 'playing' }, { made: true, three: true }).status, 'won'); // 22 wins too
});

test('verify turns away a game that is not played to 20', () => {
  assert.equal(verify({ target: 10 }).ok, false);
  assert.equal(verify({}).ok, false);
  assert.equal(verify(null).ok, false);
});
