// Tests for src/today.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todaysSet, SET_SIZE, FUN_EVERY } from '../src/today.js';

const GROUPS = {
  spelling: ['s1', 's2', 's3', 's4', 's5'],
  reading: ['r1', 'r2', 'r3', 'r4'],
  numbers: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'],
  everyday: ['e1', 'e2', 'e3'],
  fun: ['f1'],
};
const ALL = Object.values(GROUPS).flat();
const kinds = (set) => set.map((name) => name[0]).join('');

test('every day has 5 different puzzles: one from each group, and a second number puzzle or the fun one', () => {
  for (let day = 0; day < 400; day++) {
    const set = todaysSet(GROUPS, day);
    assert.equal(set.length, SET_SIZE);
    assert.equal(new Set(set).size, SET_SIZE, `day ${day}: ${set}`);
    assert.equal(kinds(set), day % FUN_EVERY === FUN_EVERY - 1 ? 'snref' : 'snren', `day ${day}`);
  }
});

test('every puzzle comes around within 5 days', () => {
  for (let day = 0; day < 100; day++) {
    const seen = new Set([0, 1, 2, 3, 4].flatMap((k) => todaysSet(GROUPS, day + k)));
    assert.equal(seen.size, ALL.length, `from day ${day}`);
  }
});

test('number puzzles take turns evenly', () => {
  const counts = {};
  for (let day = 0; day < 210; day++) {
    for (const name of todaysSet(GROUPS, day)) counts[name] = (counts[name] || 0) + 1;
  }
  const numbers = GROUPS.numbers.map((name) => counts[name]);
  assert.ok(Math.max(...numbers) - Math.min(...numbers) <= 1, String(numbers));
});

test('the same day always gives the same set', () => {
  assert.deepEqual(todaysSet(GROUPS, 317), todaysSet(GROUPS, 317));
});
