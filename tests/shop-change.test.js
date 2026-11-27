// Tests for src/games/shop-change.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay, assertValid } from './helpers.js';
import { COINS, totalOf } from '../src/games/coin-count.js';
import { generate, verify, start, check, hint, countUp, countSteps, countingUp, money, LEVELS, HAND_FULL } from '../src/games/shop-change.js';

const seed = (key) => seedFor(key, 'shop-change');
const sample = generate(seed('2026-11-26'));
const apple = { kind: 'make', items: [{ emoji: '🍎', name: 'apple', price: 35 }], price: 35, paid: 100, answer: 65 };

test('every day for two years, at every level, makes 4 valid rounds of that level\'s kinds', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seed(key), level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      const { kinds } = LEVELS[level - 1];
      assert.deepEqual(puzzle.rounds.map((round) => round.kind), [0, 1, 2, 3].map((i) => kinds[i % kinds.length]));
    });
  }
});

test('the same day and level always make the same rounds', () => {
  assert.deepEqual(generate(seed('2026-11-26'), 1), sample);
  assert.deepEqual(generate(seed('2026-11-26'), 3), generate(seed('2026-11-26'), 3));
});

test('the rounds vary from day to day', () => {
  for (const level of [1, 2, 3]) {
    const seen = new Set();
    everyDay((key) => seen.add(JSON.stringify(generate(seed(key), level))));
    assert.ok(seen.size > 700, `level ${level}: only ${seen.size} different days`);
  }
});

test('level 1 prices count by 5s and gives the change just picked in coins; level 3 makes the change for the two things just added up', () => {
  everyDay((key) => {
    const [change, coins, change2, coins2] = generate(seed(key), 1).rounds;
    for (const round of [change, coins, change2, coins2]) assert.equal(round.price % 5, 0);
    assert.deepEqual([coins.items, coins2.items, coins.answer, coins2.answer], [change.items, change2.items, change.answer, change2.answer]);
    const [total, make, total2, make2] = generate(seed(key), 3).rounds;
    assert.deepEqual([make.items, make2.items], [total.items, total2.items]);
    assert.ok(total.price < 100 && total2.price < 100);
    assert.notEqual(total.price, total2.price);
  });
});

test('countUp reaches what was paid from every price, with no more coins than a hand holds', () => {
  assert.deepEqual(countUp(35, 100), [{ coin: 'nickel', at: 40 }, { coin: 'dime', at: 50 }, { coin: 'quarter', at: 75 }, { coin: 'quarter', at: 100 }]);
  assert.deepEqual(countUp(60, 100).map((step) => step.at), [65, 75, 100]);
  assert.deepEqual(countUp(48, 50).map((step) => step.coin), ['penny', 'penny']);
  for (const paid of [50, 100]) {
    for (let price = 1; price < paid; price++) {
      const steps = countUp(price, paid);
      assert.equal(totalOf(steps.map((step) => step.coin)), paid - price);
      assert.ok(steps.length <= HAND_FULL);
      steps.reduce((before, step) => (assert.equal(step.at - before, COINS[step.coin]), step.at), price);
    }
  }
});

test('money is written as 35¢ and $1.00', () => {
  assert.deepEqual([money(5), money(35), money(100), money(120)], ['5¢', '35¢', '$1.00', '$1.20']);
});

test('check: a wrong pick stays on the round and is never shown; right picks finish', () => {
  let state = start(sample);
  const wrong = sample.rounds[0].choices.find((cents) => cents !== sample.rounds[0].answer);
  for (let i = 0; i < 5; i++) state = check(state, wrong);
  assert.deepEqual([state.round, state.last.correct, state.shown], [0, false, []]);
  for (const round of sample.rounds) state = check(state, round.answer);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 5));
});

test('check: any coins with the right total are right; the third miss shows the answer', () => {
  const puzzle = { level: 2, rounds: [apple, apple, apple, apple] };
  let state = check(start(puzzle), ['quarter', 'quarter', 'dime', 'nickel']);
  assert.deepEqual([state.round, state.last.correct], [1, true]);
  state = check(state, Array(6).fill('dime').concat(Array(5).fill('penny'))); // another way to make 65¢
  assert.equal(state.round, 2);
  state = check(check(state, ['quarter']), ['dime']);
  assert.deepEqual([state.round, state.tries], [2, 2]);
  state = check(state, []);
  assert.deepEqual([state.round, state.last.shown, state.shown], [3, true, [2]]);
});

test('hints teach counting up, and adding tens then ones', () => {
  assert.equal(hint(apple, 1), 'Start at 35¢ and count up to $1.00.');
  assert.equal(hint(apple, 2), 'The apple is 35¢. Count up to $1.00: 40, 50, 75, $1.00. That is 5¢ + 10¢ + 25¢ + 25¢.');
  assert.equal(countSteps({ price: 30, paid: 50 }), '40, 50¢');
  const both = { kind: 'total', items: [{ name: 'pear', price: 35 }, { name: 'egg', price: 47 }], price: 82, paid: 100, answer: 82 };
  assert.match(hint(both, 1), /tens first/);
  assert.equal(hint(both, 2), 'Tens: 30 + 40 = 70. Ones: 5 + 7 = 12. Put them together.');
  assert.match(countingUp({ ...both, kind: 'make' }), /^Both cost 82¢\. Count up to \$1\.00: 83, 84, 85, 90, \$1\.00\./);
});

test('verify turns away wrong answers, bad choices, bad prices, and a missing round', () => {
  const withFirst = (change) => ({ ...sample, rounds: sample.rounds.map((round, i) => (i === 0 ? { ...round, ...change } : round)) });
  const first = sample.rounds[0];
  assert.equal(verify(sample).ok, true);
  assert.equal(verify(withFirst({ answer: first.answer + 5 })).ok, false);
  assert.equal(verify(withFirst({ choices: [first.price, first.answer + 10, first.answer - 10] })).ok, false);
  assert.equal(verify(withFirst({ choices: [first.answer, first.answer, first.price] })).ok, false);
  assert.equal(verify(withFirst({ price: first.price + 1, items: [{ ...first.items[0], price: first.price + 1 }], answer: first.answer - 1 })).ok, false);
  assert.equal(verify(withFirst({ paid: 200 })).ok, false);
  assert.equal(verify(withFirst({ kind: 'make' })).ok, false);
  assert.equal(verify({ ...sample, rounds: sample.rounds.slice(1) }).ok, false);
});
