// Tests for src/games/share-it-out.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, isRight, solution, hint, factText, total, answerOf, FROGS, MOST_BERRIES } from '../src/games/share-it-out.js';

const seed = (key) => seedFor(key, 'share-it-out');
const sample = generate(seed('2026-11-26'));
const twelve = { frogs: 3, each: 4, ask: 'each', choices: [4, 3, 5] };
const turned = { frogs: 5, each: 4, ask: 'frogs', choices: [5, 4, 6] };

test('every day for two years, at every level, makes 3 valid rounds in that level\'s numbers', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seed(key), level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      for (const round of puzzle.rounds) {
        assert.ok(FROGS[level - 1].includes(round.frogs));
        assert.ok(round.frogs <= 10 && total(round) <= MOST_BERRIES);
        assert.equal(round.choices.filter((n) => n === answerOf(round)).length, 1);
        assert.ok(round.choices.every((n) => n > 0));
      }
      // Only level 3 turns a question around, and only one a day.
      assert.equal(puzzle.rounds.filter((round) => round.ask === 'frogs').length, level === 3 ? 1 : 0);
    });
  }
});

test('the same day and level always make the same rounds', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 1), sample);
  assert.deepEqual(generate(seed('2026-11-26'), 3), generate(seed('2026-11-26'), 3));
});

test('the puzzles vary from day to day', () => {
  for (const level of [1, 2, 3]) {
    const seen = new Set();
    everyDay((key) => seen.add(JSON.stringify(generate(seed(key), level).rounds)));
    assert.ok(seen.size > 300, `level ${level}: only ${seen.size} different days`);
  }
});

test('isRight: the pile is empty and every frog has the same', () => {
  assert.equal(isRight(twelve, [4, 4, 4]), true);
  assert.equal(isRight(twelve, [5, 4, 3]), false); // not equal
  assert.equal(isRight(twelve, [3, 3, 3]), false); // berries left in the pile
  assert.equal(isRight(twelve, [0, 0, 0]), false);
  assert.equal(isRight(twelve, solution(twelve)), true);
});

test('isRight, turned around: the right number of pads each have the full share', () => {
  assert.equal(isRight(turned, [4, 4, 4, 4, 4, 0, 0, 0, 0]), true);
  assert.equal(isRight(turned, [4, 0, 4, 4, 0, 4, 0, 4, 0]), true); // any 5 pads
  assert.equal(isRight(turned, [5, 5, 5, 5, 0, 0, 0, 0, 0]), false);
  assert.equal(isRight(turned, [4, 4, 4, 4, 2, 2, 0, 0, 0]), false);
  assert.equal(solution(turned).length, 9);
});

test('hints say what is wrong', () => {
  assert.equal(hint(twelve, [5, 4, 3]), 'One frog has 5 and another has 3. Equal means the same for everyone.');
  assert.match(hint(twelve, [4, 4, 3]), /still 1 berry in the pile/);
  assert.match(hint(twelve, [1, 1, 1]), /still 9 berries/);
  assert.match(hint(turned, [5, 5, 5, 5, 0, 0, 0, 0, 0]), /exactly 4/);
  assert.equal(factText(twelve), '3 × 4 = 12, so 12 ÷ 3 = 4.');
  assert.equal(factText(turned), '5 × 4 = 20, so 20 ÷ 4 = 5.');
});

test('check: share, then the fact, for all 3 rounds', () => {
  let state = start(sample);
  for (const [i, round] of sample.rounds.entries()) {
    state = check(state, solution(round).fill(0)); // a miss stays on the sharing step
    assert.deepEqual([state.round, state.step, state.tries, state.last.correct], [i, 'share', 1, false]);
    state = check(state, solution(round));
    assert.deepEqual([state.round, state.step, state.tries, state.status], [i, 'fact', 0, 'playing']);
    for (let n = 0; n < 4; n++) state = check(state, 0); // the fact is never given away
    assert.deepEqual([state.round, state.step, state.last.correct], [i, 'fact', false]);
    state = check(state, answerOf(round));
    assert.equal(state.last.correct, true);
  }
  assert.equal(state.status, 'won');
  assert.deepEqual(state.shown, []);
  assert.throws(() => check(state, 1));
});

test('check: the third unfair share is shared for the player', () => {
  let state = start(sample);
  for (let n = 0; n < 3; n++) state = check(state, []);
  assert.deepEqual([state.round, state.step, state.last.shown, state.shown], [0, 'fact', true, [0]]);
});

test('verify turns away bad puzzles', () => {
  const withRound = (change) => ({ ...sample, rounds: sample.rounds.map((round, i) => (i === 1 ? { ...round, ...change } : round)) });
  const { each } = sample.rounds[1];
  assert.equal(verify(withRound({ frogs: 7 })).ok, false);                 // 7 frogs isn't in level 1
  assert.equal(verify(withRound({ frogs: 10, each: 9 })).ok, false);      // 90 berries
  assert.equal(verify(withRound({ each: 1 })).ok, false);
  assert.equal(verify(withRound({ ask: 'frogs' })).ok, false);            // turned around is level 3 only
  assert.equal(verify(withRound({ choices: [each + 1, each + 2, each + 3] })).ok, false);
  assert.equal(verify(withRound({ choices: [each, each, each + 1] })).ok, false);
  assert.equal(verify({ ...sample, rounds: sample.rounds.slice(1) }).ok, false);
});
