// Tests for src/games/place-value.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { generate, verify, start, check, isRight, hint, places, roundTo, inWords, LEVELS } from '../src/games/place-value.js';

const seed = (key) => seedFor(key, 'place-value');
const sample = generate(seed('2026-11-26'));
const numbersIn = (puzzle) => puzzle.rounds.flatMap((round) => (round.kind === 'compare' ? [round.left, round.right] : [round.number]));
// The right answer to any round.
const rightFor = (round) => (round.kind === 'build' ? places(round.number) : round.answer ?? round.number);

test('every day for two years, at every level, makes 4 valid rounds of that level\'s kinds', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seed(key), level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      assert.deepEqual(puzzle.rounds.map((round) => round.kind), LEVELS[level - 1].kinds);
      for (const round of puzzle.rounds) assert.ok(isRight(round, rightFor(round)), `level ${level}, ${key}: ${round.kind}`);
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
    assert.ok(seen.size > 700, `level ${level}: only ${seen.size} different puzzles`);
  }
});

test('level 1 is two digits, level 2 is three digits with no zero, level 3 has a zero in some numbers', () => {
  let withZero = 0;
  let without = 0;
  everyDay((key) => {
    for (const n of numbersIn(generate(seed(key), 1))) assert.ok(n >= 11 && n <= 99, `${key}: ${n}`);
    for (const n of numbersIn(generate(seed(key), 2))) assert.ok(n >= 111 && n <= 999 && !String(n).includes('0'), `${key}: ${n}`);
    for (const n of numbersIn(generate(seed(key), 3))) {
      assert.ok(n >= 101 && n <= 999, `${key}: ${n}`);
      String(n).includes('0') ? withZero++ : without++;
    }
  });
  assert.ok(withZero > 500 && without > 500);
});

test('compare rounds are close (the same first digit, or the same digits swapped); rounding has both neighbours as choices', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      for (const round of generate(seed(key), level).rounds) {
        if (round.kind === 'compare') {
          const sorted = (n) => [...String(n)].sort().join('');
          assert.ok(String(round.left)[0] === String(round.right)[0] || sorted(round.left) === sorted(round.right), `${key}: ${round.left} and ${round.right}`);
        }
        if (round.kind === 'round') {
          const below = Math.floor(round.number / round.to) * round.to;
          assert.ok(round.choices.includes(below) && round.choices.includes(below + round.to), `${key}: ${round.number}`);
          assert.ok(!round.choices.includes(round.number));
        }
      }
    });
  }
});

test('places, roundTo, and inWords', () => {
  assert.deepEqual(places(247), { hundreds: 2, tens: 4, ones: 7 });
  assert.deepEqual(places(305), { hundreds: 3, tens: 0, ones: 5 });
  assert.deepEqual([roundTo(247, 10), roundTo(245, 10), roundTo(247, 100), roundTo(250, 100)], [250, 250, 200, 300]);
  assert.equal(inWords(places(247)), '2 hundreds, 4 tens, and 7 ones');
  assert.equal(inWords(places(41), false), '4 tens and 1 one');
});

test('isRight: blocks must match place by place; choices must be the number', () => {
  const build = { kind: 'build', number: 247 };
  assert.ok(isRight(build, { hundreds: 2, tens: 4, ones: 7 }));
  assert.ok(!isRight(build, { hundreds: 2, tens: 7, ones: 4 }));
  assert.ok(isRight({ kind: 'read', number: 305 }, 305));
  assert.ok(!isRight({ kind: 'read', number: 305 }, 350));
  assert.ok(isRight({ kind: 'compare', left: 247, right: 274, answer: 274 }, 274));
  assert.ok(!isRight({ kind: 'round', number: 247, to: 10, answer: 250 }, 240));
});

test('check: a miss stays on the round, the third miss at building shows it, right answers finish', () => {
  const none = { hundreds: 0, tens: 0, ones: 0 };
  let state = check(start(sample), none); // level 1 starts with a build round
  assert.deepEqual([state.round, state.tries, state.last.correct, state.last.shown], [0, 1, false, false]);
  state = check(check(state, none), none);
  assert.deepEqual([state.round, state.shown, state.last.shown], [1, [0], true]);
  for (let i = 0; i < 5; i++) state = check(state, -1); // a read round is never shown: there are only 3 choices
  assert.equal(state.round, 1);
  for (const round of sample.rounds.slice(1)) state = check(state, rightFor(round));
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 1));
});

test('hints say what the digits mean', () => {
  assert.equal(hint({ kind: 'build', number: 247 }, { hundreds: 2, tens: 3, ones: 7 }), '247 has 2 hundreds, 4 tens, and 7 ones. You have 2 hundreds, 3 tens, and 7 ones.');
  assert.equal(hint({ kind: 'build', number: 47 }, { hundreds: 0, tens: 7, ones: 4 }), '47 has 4 tens and 7 ones. You have 7 tens and 4 ones.');
  assert.match(hint({ kind: 'read', number: 305 }, 350), /3 hundreds, 0 tens, and 5 ones/);
  assert.equal(hint({ kind: 'compare', left: 247, right: 274, answer: 274 }, 247), 'Both have 2 hundreds, so look at the tens: 4 tens or 7 tens?');
  assert.equal(hint({ kind: 'compare', left: 47, right: 74, answer: 74 }, 47), 'Look at the tens: 4 tens or 7 tens?');
  assert.match(hint({ kind: 'round', number: 247, to: 10, answer: 250 }, 240), /between 240 and 250. It has 7 ones/);
  assert.match(hint({ kind: 'round', number: 247, to: 100, answer: 200 }, 300), /between 200 and 300. It has 4 tens/);
});

test('verify turns away wrong kinds, numbers from another level, bad choices, and wrong answers', () => {
  const swap = (puzzle, i, change) => ({ ...puzzle, rounds: puzzle.rounds.map((round, n) => (n === i ? { ...round, ...change } : round)) });
  const two = generate(seed('2026-11-26'), 2); // build, read, compare, round
  assertValid(verify(two), 'level 2');
  assert.equal(verify({ ...sample, rounds: sample.rounds.slice(1) }).ok, false);
  assert.equal(verify(swap(sample, 0, { kind: 'read' })).ok, false);
  assert.equal(verify(swap(sample, 0, { number: 247 })).ok, false); // three digits at level 1
  assert.equal(verify(swap(two, 0, { number: 305 })).ok, false); // a zero at level 2
  assert.equal(verify(swap(two, 1, { choices: [1, 2, 3] })).ok, false);
  assert.equal(verify(swap(two, 1, { choices: [two.rounds[1].number, 222, 222] })).ok, false);
  assert.equal(verify(swap(two, 2, { answer: Math.min(two.rounds[2].left, two.rounds[2].right) })).ok, false);
  assert.equal(verify(swap(two, 2, { right: two.rounds[2].left })).ok, false);
  assert.equal(verify(swap(two, 3, { answer: two.rounds[3].answer + 10 })).ok, false);
  assert.equal(verify(swap(two, 3, { to: 100 })).ok, false);
});
