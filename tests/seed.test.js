// Tests for src/seed.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, hashString, seedFor, createRandom } from '../src/seed.js';

test('dateKey formats a date as YYYY-MM-DD with leading zeros', () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dateKey(new Date(2026, 10, 28)), '2026-11-28');
});

test('dateKey uses local time, so late evening is still the same day', () => {
  assert.equal(dateKey(new Date(2026, 10, 8, 23, 59)), '2026-11-08');
  assert.equal(dateKey(new Date(2026, 10, 9, 0, 0)), '2026-11-09');
});

test('hashString gives the same number for the same text', () => {
  assert.equal(hashString('2026-11-08'), hashString('2026-11-08'));
});

test('hashString gives different numbers for different text', () => {
  assert.notEqual(hashString('2026-11-08'), hashString('2026-11-09'));
});

test('seedFor gives each game its own seed on the same day', () => {
  assert.notEqual(seedFor('2026-11-08', 'word-guess'), seedFor('2026-11-08', 'maze'));
});

test('every day of a year gets a different seed', () => {
  const seeds = new Set();
  for (let day = 0; day < 366; day++) {
    seeds.add(seedFor(dateKey(new Date(2026, 0, 1 + day)), 'word-guess'));
  }
  assert.equal(seeds.size, 366);
});

test('createRandom repeats the same sequence for the same seed', () => {
  const a = createRandom(42);
  const b = createRandom(42);
  for (let i = 0; i < 20; i++) {
    assert.equal(a.next(), b.next());
  }
});

test('createRandom gives a different sequence for a different seed', () => {
  const a = createRandom(1);
  const b = createRandom(2);
  const first = Array.from({ length: 5 }, () => a.next());
  const second = Array.from({ length: 5 }, () => b.next());
  assert.notDeepEqual(first, second);
});

test('next() stays between 0 and 1', () => {
  const random = createRandom(7);
  for (let i = 0; i < 1000; i++) {
    const n = random.next();
    assert.ok(n >= 0 && n < 1, `got ${n}`);
  }
});

test('int(min, max) stays in range and can reach both ends', () => {
  const random = createRandom(7);
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const n = random.int(1, 6);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= 6, `got ${n}`);
    seen.add(n);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
});

test('pick() returns an item from the list', () => {
  const random = createRandom(7);
  const list = ['cat', 'dog', 'sun'];
  for (let i = 0; i < 50; i++) {
    assert.ok(list.includes(random.pick(list)));
  }
});

test('shuffle() keeps every item and leaves the original list alone', () => {
  const random = createRandom(7);
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled = random.shuffle(list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...shuffled].sort(), list);
});
