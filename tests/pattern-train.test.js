// Tests for src/games/pattern-train.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, hint, carsFor, ruleText, LEVELS } from '../src/games/pattern-train.js';

const seed = (key) => seedFor(key, 'pattern-train');
const sample = generate(seed('2026-11-26'));

test('every day for two years, at every level, makes 4 valid trains that follow that level\'s rules', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seed(key), level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      assert.deepEqual(puzzle.rounds.map((round) => round.rule.type), LEVELS[level - 1].map((recipe) => recipe.type));
    });
  }
});

test('the same day and level always make the same trains', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 1), sample);
});

test('carsFor follows each kind of rule', () => {
  assert.deepEqual(carsFor({ type: 'add', step: 4 }, 5, 3), [3, 7, 11, 15, 19]);
  assert.deepEqual(carsFor({ type: 'take', step: 5 }, 5, 40), [40, 35, 30, 25, 20]);
  assert.deepEqual(carsFor({ type: 'grow' }, 5, 2), [2, 3, 5, 8, 12]);
  assert.deepEqual(carsFor({ type: 'double' }, 5, 3), [3, 6, 12, 24, 48]);
  assert.deepEqual(carsFor({ type: 'repeat', unit: ['a', 'b', 'b'] }, 6), ['a', 'b', 'b', 'a', 'b', 'b']);
});

test('level 1 leaves the last car empty; levels 2 and 3 also empty a car in the middle', () => {
  everyDay((key) => {
    for (const round of generate(seed(key), 1).rounds) assert.equal(round.hidden, round.cars.length - 1);
    for (const level of [2, 3]) {
      const middles = generate(seed(key), level).rounds.filter((round) => round.hidden < round.cars.length - 1);
      assert.ok(middles.length >= 1);
      for (const round of middles) assert.ok(round.hidden >= 2); // at least two cars before it show the rule
    }
  }, 200);
});

test('numbers stay from 1 to 100, and no wrong choice is the answer', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      for (const { rule, cars, answer, choices } of generate(seed(key), level).rounds) {
        if (rule.type !== 'repeat') for (const n of [...cars.filter((car) => car !== null), answer]) assert.ok(n >= 1 && n <= 100);
        assert.equal(choices.filter((choice) => choice === answer).length, 1);
      }
    });
  }
});

test('check: a wrong pick stays on the train; right picks finish all 4', () => {
  let state = check(start(sample), 'nope');
  assert.deepEqual([state.round, state.tries, state.last.correct], [0, 1, false]);
  for (let i = 0; i < 5; i++) state = check(state, 'nope'); // never shown: there are only 3 choices
  assert.equal(state.round, 0);
  for (const round of sample.rounds) state = check(state, round.answer);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 1));
});

test('the first hint says where to look; the second gives the rule', () => {
  const adding = { rule: { type: 'add', step: 4 } };
  const shapes = { rule: { type: 'repeat', unit: ['🔴', '⭐'] } };
  assert.match(hint(adding, 1), /from one car to the next/);
  assert.equal(hint(adding, 2), 'The rule: add 4 each time.');
  assert.match(hint(shapes, 1), /start again/);
  assert.equal(hint(shapes, 2), 'The rule: 🔴 ⭐ again and again.');
  assert.equal(ruleText({ type: 'double' }), 'double each time');
});

test('verify turns away a train that breaks its rule, two empty cars, and a missing answer', () => {
  const rounds = (change) => sample.rounds.map((round, i) => (i === 1 ? { ...round, ...change } : round));
  const second = sample.rounds[1];
  assert.equal(verify({ ...sample, rounds: rounds({ answer: second.answer + 1, choices: [second.answer + 1, 1, 2] }) }).ok, false);
  assert.equal(verify({ ...sample, rounds: rounds({ cars: second.cars.map((car, i) => (i === 0 ? null : car)) }) }).ok, false);
  assert.equal(verify({ ...sample, rounds: rounds({ choices: [second.answer + 1, second.answer + 2, second.answer + 3] }) }).ok, false);
  assert.equal(verify({ ...sample, rounds: sample.rounds.slice(1) }).ok, false);
});
