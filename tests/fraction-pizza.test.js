// Tests for src/games/fraction-pizza.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, hint, isRight, goesWith, bigger, fractionText, LEVELS, MAX_TRIES, MATCHES, ROUNDS } from '../src/games/fraction-pizza.js';

const seed = (key) => seedFor(key, 'fraction-pizza');
const sample = generate(seed('2026-11-26'));
/** A right answer for a round. */
const rightFor = (round) => ({ make: round.topped, match: MATCHES })[round.kind] ?? round.answer;
/** Every pizza a round shows. */
const pizzasOf = (round) => ({ compare: [round.left, round.right], match: round.pairs })[round.kind] ?? [round];

test('every day for two years, at every level, makes 5 valid rounds of the kinds that level uses', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seed(key), level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      assert.deepEqual(puzzle.rounds.map((round) => round.kind), LEVELS[level - 1].kinds);
    });
  }
});

test('the same day and level always make the same rounds', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 1), sample);
});

test('level 1 uses only halves, thirds, and fourths', () => {
  everyDay((key) => {
    for (const round of generate(seed(key), 1).rounds) for (const pizza of pizzasOf(round)) assert.ok([2, 3, 4].includes(pizza.slices));
  });
});

test('bigger compares fractions, not slice counts', () => {
  assert.equal(bigger({ topped: 1, slices: 2 }, { topped: 3, slices: 8 }), 'left'); // 1/2 is more than 3/8
  assert.equal(bigger({ topped: 2, slices: 6 }, { topped: 2, slices: 3 }), 'right');
  assert.equal(bigger({ topped: 1, slices: 2 }, { topped: 4, slices: 8 }), 'same');
});

test('level 2 compares pizzas cut the same way or with the same number topped; never equal', () => {
  everyDay((key) => {
    for (const { left, right, answer, choices } of generate(seed(key), 2).rounds.filter((r) => r.kind === 'compare')) {
      assert.ok(left.slices === right.slices || left.topped === right.topped);
      assert.notEqual(answer, 'same');
      assert.deepEqual(choices, ['left', 'right']);
    }
  });
});

test('level 3 has one pair of equal fractions and one pair cut differently that is not equal', () => {
  everyDay((key) => {
    const compares = generate(seed(key), 3).rounds.filter((r) => r.kind === 'compare');
    assert.deepEqual(compares.map((r) => r.answer === 'same'), [true, false]);
    for (const { left, right } of compares) assert.notEqual(left.slices, right.slices);
  });
});

test('check: right answers move through all 5 rounds', () => {
  let state = start(sample);
  for (const round of sample.rounds) {
    assert.equal(isRight(round, rightFor(round)), true);
    state = check(state, rightFor(round));
    assert.equal(state.last.correct, true);
  }
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 1));
});

test('check: the third miss at making a pizza shows it; picking a fraction is never shown', () => {
  const puzzle = generate(seed('2026-11-26'), 1); // name, make, name, make
  let state = check(start(puzzle), 'nope');
  for (let i = 0; i < 5; i++) state = check(state, 'nope');
  assert.deepEqual([state.round, state.shown], [0, []]);
  state = check(state, puzzle.rounds[0].answer);
  for (let miss = 1; miss < MAX_TRIES; miss++) state = check(state, 0);
  assert.equal(state.round, 1);
  state = check(state, 0);
  assert.deepEqual([state.round, state.shown, state.last.shown], [2, [1], true]);
});

test('hints say what the numbers mean', () => {
  assert.match(hint({ kind: 'name', slices: 4, topped: 3 }, '1/4'), /slices in all: 4/);
  assert.equal(hint({ kind: 'make', slices: 4, topped: 3 }, 2), '3/4 means 3 of the 4 slices. You have 2.');
  assert.match(hint({ kind: 'compare', left: { topped: 1, slices: 4 }, right: { topped: 3, slices: 4 } }, 'left'), /same size/);
  assert.match(hint({ kind: 'compare', left: { topped: 2, slices: 3 }, right: { topped: 2, slices: 6 } }, 'right'), /fewer slices has bigger slices/);
  assert.match(hint({ kind: 'compare', left: { topped: 1, slices: 2 }, right: { topped: 2, slices: 4 } }, 'right'), /whole pizza/);
});

test('verify turns away a wrong answer, a whole pizza, and a missing choice', () => {
  const rounds = (change) => sample.rounds.map((round, i) => (i === 0 ? { ...round, ...change } : round));
  assert.equal(verify({ ...sample, rounds: rounds({ answer: '9/9' }) }).ok, false);
  assert.equal(verify({ ...sample, rounds: rounds({ topped: sample.rounds[0].slices, answer: fractionText(sample.rounds[0].slices, sample.rounds[0].slices) }) }).ok, false);
  assert.equal(verify({ ...sample, rounds: rounds({ choices: sample.rounds[0].choices.slice(0, 2) }) }).ok, false);
  assert.equal(verify({ ...sample, rounds: sample.rounds.slice(1) }).ok, false);
});

test('every choice for naming a pizza is a real fraction: top smaller than bottom', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      for (const { choices } of generate(seed(key), level).rounds.filter((round) => round.kind === 'name')) {
        for (const [top, bottom] of choices.map((text) => text.split('/').map(Number))) assert.ok(top >= 1 && top < bottom, choices.join(' '));
      }
    });
  }
});

test('levels 2 and 3 go up to tenths, and use every way of cutting a pizza', () => {
  for (const level of [2, 3]) {
    const used = new Set();
    everyDay((key) => {
      for (const round of generate(seed(key), level).rounds) {
        for (const pizza of pizzasOf(round)) {
          used.add(pizza.slices);
          assert.ok(pizza.slices <= 10);
        }
      }
    });
    assert.deepEqual([...used].sort((a, b) => a - b), [2, 3, 4, 5, 6, 8, 10]);
  }
});

test('the last round joins 4 fractions to 4 pizzas: all different amounts, cut more than one way', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const { rounds } = generate(seed(key), level);
      assert.equal(rounds.length, ROUNDS);
      const { kind, pairs, order } = rounds.at(-1);
      assert.equal(kind, 'match');
      assert.equal(new Set(pairs.map((p) => p.topped / p.slices)).size, MATCHES); // never 1/2 and 2/4 together
      assert.ok(new Set(pairs.map((p) => p.slices)).size >= 2);
      assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
    });
  }
});

test('match: a fraction goes with the pizza that shows it, and the round is right when all 4 are joined', () => {
  const round = { kind: 'match', pairs: [{ topped: 1, slices: 2 }, { topped: 1, slices: 3 }, { topped: 3, slices: 4 }, { topped: 1, slices: 4 }], order: [2, 0, 3, 1] };
  assert.equal(goesWith(round, 2, 0), true); // the top pizza shows fraction 2 (3/4)
  assert.equal(goesWith(round, 0, 0), false);
  assert.equal(isRight(round, 3), false);
  assert.equal(isRight(round, 4), true);
  assert.equal(hint(round, 2), '3/4 is a pizza cut into 4 slices, with toppings on 3 of them.');
});

test('verify turns away a match round with two equal fractions or a pizza missing', () => {
  const withLast = (change) => ({ ...sample, rounds: sample.rounds.map((round, i) => (i === ROUNDS - 1 ? { ...round, ...change } : round)) });
  assert.equal(verify(withLast({ pairs: [{ topped: 1, slices: 2 }, { topped: 2, slices: 4 }, { topped: 1, slices: 3 }, { topped: 1, slices: 4 }] })).ok, false);
  assert.equal(verify(withLast({ order: [0, 1, 2, 2] })).ok, false);
});
