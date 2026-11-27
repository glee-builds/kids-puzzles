// Tests for src/games/number-detective.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, fits, clueText, whyNot, solvedText, LEVELS, SUSPECTS } from '../src/games/number-detective.js';

const seed = (key) => seedFor(key, 'number-detective');
const sample = generate(seed('2026-11-26'));

test('every day for two years, at every level, makes 3 valid mysteries', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => assertValid(verify(generate(seed(key), level)), `level ${level}, ${key}`));
  }
});

test('the same day and level always make the same mysteries', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 1), sample);
  assert.deepEqual(generate(seed('2026-11-26'), 3), generate(seed('2026-11-26'), 3));
});

test('only the answer fits every clue, and every clue has a suspect that breaks only it', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      for (const { clues, suspects, answer } of generate(seed(key), level).rounds) {
        assert.equal(suspects.length, SUSPECTS);
        assert.deepEqual(suspects.filter((n) => clues.every((clue) => fits(clue, n))), [answer]);
        for (const clue of clues) {
          const others = clues.filter((other) => other !== clue);
          assert.ok(suspects.some((n) => !fits(clue, n) && others.every((other) => fits(other, n))), `${key}: ${clueText(clue)}`);
        }
      }
    }, 200);
  }
});

test('the puzzles vary: many different mysteries over two years, and each level uses its new clues', () => {
  for (const level of [1, 2, 3]) {
    const mysteries = new Set();
    const kinds = new Set();
    everyDay((key) => {
      for (const round of generate(seed(key), level).rounds) {
        mysteries.add(JSON.stringify(round));
        for (const clue of round.clues) kinds.add(clue.kind);
      }
    });
    assert.ok(mysteries.size > 2000, `level ${level}: only ${mysteries.size} different mysteries`);
    assert.deepEqual([...kinds].sort(), [...LEVELS[level - 1].kinds].sort());
  }
});

test('fits and clueText follow each kind of clue', () => {
  const cases = [
    [{ kind: 'even' }, 46, 37, 'I am even.'],
    [{ kind: 'odd' }, 37, 46, 'I am odd.'],
    [{ kind: 'more', than: 30 }, 31, 30, 'I am more than 30.'],
    [{ kind: 'less', than: 30 }, 29, 30, 'I am less than 30.'],
    [{ kind: 'between', low: 40, high: 60 }, 46, 64, 'I am between 40 and 60.'],
    [{ kind: 'tens', digit: 4 }, 146, 64, 'My tens digit is 4.'],
    [{ kind: 'ones', digit: 6 }, 46, 64, 'My ones digit is 6.'],
    [{ kind: 'digitSum', sum: 10 }, 46, 48, 'My digits add up to 10.'],
    [{ kind: 'countBy', step: 5 }, 45, 46, 'You say me when you count by 5s.'],
    [{ kind: 'tensBigger' }, 152, 125, 'My tens digit is bigger than my ones digit.'],
    [{ kind: 'plusTen', over: 90 }, 81, 80, 'Add 10 to me and you get more than 90.'],
    [{ kind: 'minusTen', under: 50 }, 59, 60, 'Take 10 from me and you get less than 50.'],
  ];
  for (const [clue, yes, no, text] of cases) {
    assert.equal(fits(clue, yes), true, text);
    assert.equal(fits(clue, no), false, text);
    assert.equal(clueText(clue), text);
  }
});

test('a miss says which clue the number breaks; a right answer restates the clues', () => {
  assert.equal(whyNot({ kind: 'even' }, 37), '37 is not even.');
  assert.equal(whyNot({ kind: 'between', low: 40, high: 60 }, 64), '64 is not between 40 and 60.');
  assert.equal(whyNot({ kind: 'countBy', step: 5 }, 37), '37 is not a count-by-5s number.');
  assert.equal(whyNot({ kind: 'digitSum', sum: 10 }, 48), '4 + 8 = 12, not 10.');
  assert.equal(whyNot({ kind: 'tens', digit: 4 }, 64), 'The tens digit of 64 is 6, not 4.');
  assert.equal(whyNot({ kind: 'plusTen', over: 90 }, 37), '37 + 10 = 47. That is not more than 90.');
  const clues = [{ kind: 'between', low: 40, high: 60 }, { kind: 'even' }, { kind: 'digitSum', sum: 10 }];
  assert.equal(solvedText({ clues, answer: 46 }), '✓ 46! Between 40 and 60, even, and 4 + 6 = 10.');
});

test('check: a wrong suspect is crossed out and names a broken clue; right ones solve all 3', () => {
  const [first] = sample.rounds;
  const wrong = first.suspects.find((n) => n !== first.answer);
  let state = check(start(sample), wrong);
  assert.deepEqual([state.round, state.status, state.last.correct, state.crossed], [0, 'playing', false, [wrong]]);
  assert.equal(fits(state.last.broken, wrong), false);
  // No penalty and nothing shown: every wrong suspect can be tried.
  for (const n of first.suspects) if (n !== first.answer && n !== wrong) state = check(state, n);
  assert.deepEqual([state.round, state.shown, state.crossed.length], [0, [], SUSPECTS - 1]);
  for (const round of sample.rounds) {
    state = check(state, round.answer);
    assert.deepEqual([state.last.correct, state.crossed], [true, []]);
  }
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 1));
});

test('verify turns away bad puzzles', () => {
  const withRound = (change) => ({ ...sample, rounds: sample.rounds.map((round, i) => (i === 0 ? { ...round, ...change(round) } : round)) });
  const bad = (puzzle) => assert.equal(verify(puzzle).ok, false);
  bad({ ...sample, rounds: sample.rounds.slice(1) }); // only 2 mysteries
  bad({ ...sample, rounds: [sample.rounds[0], sample.rounds[0], sample.rounds[2]] }); // the same answer twice
  bad(withRound(({ clues }) => ({ clues: clues.slice(1) }))); // a clue gone: another suspect fits (or too few clues)
  bad(withRound(({ clues }) => ({ clues: [...clues.slice(0, 3), { kind: 'more', than: 0 }] }))); // a clue nobody breaks
  bad(withRound(({ clues }) => ({ clues: [...clues.slice(0, 2), { kind: 'plusTen', over: 20 }] }))); // a level 3 clue at level 1
  bad(withRound(({ suspects }) => ({ suspects: [...suspects].reverse() }))); // not smallest first
  bad(withRound(({ suspects }) => ({ suspects: suspects.slice(1) }))); // 11 suspects
  bad(withRound(({ suspects, answer }) => ({ suspects: suspects.map((n) => (n === answer ? 500 : n)).sort((a, b) => a - b) }))); // out of range, no answer
  bad(withRound(({ suspects, answer }) => ({ answer: suspects.find((n) => n !== answer) }))); // the wrong answer
  // Two suspects fit every clue.
  const clues = [{ kind: 'even' }, { kind: 'more', than: 20 }, { kind: 'less', than: 40 }];
  const suspects = [11, 13, 15, 17, 18, 21, 23, 30, 32, 42, 44, 46];
  bad(withRound(() => ({ clues, suspects, answer: 30 })));
  assert.equal(verify(withRound(() => ({ clues, suspects: suspects.map((n) => (n === 32 ? 33 : n)), answer: 30 }))).ok, true);
  // A suspect on the edge of "between".
  const edge = [{ kind: 'between', low: 20, high: 40 }, { kind: 'even' }, { kind: 'ones', digit: 0 }];
  bad({ level: 2, rounds: [{ clues: edge, suspects: [11, 12, 20, 22, 24, 25, 30, 35, 42, 50, 60, 70], answer: 30 }, ...sample.rounds.slice(1)] });
});
