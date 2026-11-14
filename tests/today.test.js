// Tests for src/today.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todaysSet, SET_SIZE } from '../src/today.js';

const WORDS = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9'];
const NUMBERS = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9'];

test('every day has 5 different puzzles, 2 or 3 of each kind', () => {
  for (let day = 0; day < 400; day++) {
    const set = todaysSet(WORDS, NUMBERS, day);
    assert.equal(set.length, SET_SIZE);
    assert.equal(new Set(set).size, SET_SIZE, `day ${day}: ${set}`);
    const words = set.filter((name) => WORDS.includes(name)).length;
    assert.ok(words === 2 || words === 3, `day ${day}: ${words} word puzzles`);
  }
});

test('the kinds take turns, and swap which has 3 each day', () => {
  const kind = (name) => name[0];
  assert.equal(todaysSet(WORDS, NUMBERS, 10).map(kind).join(''), 'nwnwn');
  assert.equal(todaysSet(WORDS, NUMBERS, 11).map(kind).join(''), 'wnwnw');
});

test('every puzzle comes around within 4 days', () => {
  for (let day = 0; day < 100; day++) {
    const seen = new Set([0, 1, 2, 3].flatMap((k) => todaysSet(WORDS, NUMBERS, day + k)));
    assert.equal(seen.size, WORDS.length + NUMBERS.length, `from day ${day}`);
  }
});

test('the same day always gives the same set', () => {
  assert.deepEqual(todaysSet(WORDS, NUMBERS, 317), todaysSet(WORDS, NUMBERS, 317));
});
