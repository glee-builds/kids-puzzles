// Tests for src/games/memory-match.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, PAIRS } from '../src/games/memory-match.js';

const seed = (key) => seedFor(key, 'memory-match');
const sample = generate(seed('2026-11-26'));
/** The two card numbers of a pair. */
const cardsOf = (puzzle, pair) => puzzle.cards.map((card, i) => (card.pair === pair ? i : -1)).filter((i) => i >= 0);

test('every day for two years, at every level, makes valid cards', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seed(key), level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      assert.equal(puzzle.cards.length, PAIRS[level - 1] * 2);
    });
  }
});

test('the same day and level always make the same cards', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 1), sample);
});

test('level 3 pairs a times fact with its answer, within 9 × 9, and no two facts share an answer', () => {
  everyDay((key) => {
    const { cards } = generate(seed(key), 3);
    const answers = cards.filter((card) => !card.face.includes('×')).map((card) => card.face);
    assert.equal(new Set(answers).size, 8);
    for (const card of cards.filter((c) => c.face.includes('×'))) {
      const [a, b] = card.face.split(' × ').map(Number);
      assert.ok(a >= 2 && a <= 9 && b >= 2 && b <= 9);
      assert.equal(cards.find((other) => other.pair === card.pair && other !== card).face, String(a * b));
    }
  }, 200);
});

test('check: two cards of a pair stay up; finding every pair wins with no misses', () => {
  let state = start(sample);
  for (let pair = 0; pair < sample.cards.length / 2; pair++) {
    const [one, two] = cardsOf(sample, pair);
    state = check(state, one);
    assert.deepEqual([state.up, state.last.pair], [[one], null]);
    state = check(state, two);
    assert.equal(state.last.pair, true);
    assert.deepEqual(state.up, []);
  }
  assert.equal(state.status, 'won');
  assert.equal(state.misses, 0);
  assert.throws(() => check(state, 0));
});

test('check: two that do not match stay up until the next card, then turn back', () => {
  const [a1, a2] = cardsOf(sample, 0);
  const [b1] = cardsOf(sample, 1);
  let state = check(check(start(sample), a1), b1);
  assert.equal(state.last.pair, false);
  assert.deepEqual(state.up, [a1, b1]);
  state = check(state, a2); // the next card: the two turn back, this one turns up
  assert.deepEqual(state.up, [a2]);
  assert.deepEqual(state.matched, []);
});

test('a miss counts only when the first card\'s partner had been seen before', () => {
  const [a1, a2] = cardsOf(sample, 0);
  const [b1, b2] = cardsOf(sample, 1);
  const [c1] = cardsOf(sample, 2);
  let state = check(check(start(sample), a1), b1); // looking: neither partner seen yet
  assert.equal(state.misses, 0);
  state = check(check(state, a2), c1); // a2's partner (a1) was seen: a miss
  assert.equal(state.misses, 1);
  state = check(check(state, b2), b1); // remembered: a pair
  assert.equal(state.last.pair, true);
  assert.equal(state.misses, 1);
});

test('check turns away a matched card, a card already up, and a card that does not exist', () => {
  const [a1, a2] = cardsOf(sample, 0);
  assert.throws(() => check(check(start(sample), a1), a1));
  assert.throws(() => check(check(check(start(sample), a1), a2), a1));
  assert.throws(() => check(start(sample), 99));
});

test('verify turns away a pair that does not match and the wrong number of cards', () => {
  const broken = sample.cards.map((card) => ({ ...card }));
  broken[0].face = '🦖';
  assert.equal(verify({ ...sample, cards: broken }).ok, false);
  assert.equal(verify({ ...sample, cards: sample.cards.slice(2) }).ok, false);
});
