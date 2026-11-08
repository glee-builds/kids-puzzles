// Tests for src/games/letter-wheel.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateKey, seedFor } from '../src/seed.js';
import {
  generate, verify, start, check, useHint, canMake, wordsFor, LETTER_COUNT, MIN_WORDS, MAX_WORDS,
} from '../src/games/letter-wheel.js';

const load = (file) => Object.values(
  JSON.parse(readFileSync(new URL(`../data/words/${file}`, import.meta.url), 'utf8')).words,
).flat();
const words = [...load('level-1.json'), ...load('level-2.json')];
const seedForDay = (key) => seedFor(key, 'letter-wheel');

// A fixed wheel for the play tests: G in the middle, F L B I O around it.
const fixed = { center: 'g', outside: ['f', 'l', 'b', 'i', 'o'], answers: ['big', 'fig', 'fog', 'log', 'golf'] };

// --- canMake and wordsFor ---

test('canMake: needs the center letter and enough of each letter', () => {
  const letters = ['g', 'f', 'l', 'b', 'i', 'o'];
  assert.equal(canMake('golf', letters, 'g'), true);
  assert.equal(canMake('fib', letters, 'g'), false); // no g
  assert.equal(canMake('glob', letters, 'g'), true);
  assert.equal(canMake('blog', letters, 'g'), true);
  assert.equal(canMake('bigg', letters, 'g'), false); // only one g
});

test('wordsFor finds every list word the wheel can make', () => {
  assert.deepEqual(wordsFor(['g', 'f', 'l', 'b', 'i', 'o'], 'g', words).sort(), fixed.answers.slice().sort());
});

// --- generate ---

test('generate gives the same wheel for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08'), words), generate(seedForDay('2026-11-08'), words));
});

test('every day for two years makes a valid wheel', () => {
  for (let day = 0; day < 730; day++) {
    const key = dateKey(new Date(2026, 10, 1 + day));
    const puzzle = generate(seedForDay(key), words);
    const result = verify(puzzle, words);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.outside.length + 1, LETTER_COUNT);
    assert.ok(puzzle.answers.some((a) => a.length === 4), `${key}: no four-letter word`);
  }
});

test('answers are listed shortest first, then in ABC order', () => {
  const { answers } = generate(seedForDay('2026-11-08'), words);
  const sorted = [...answers].sort((a, b) => a.length - b.length || a.localeCompare(b));
  assert.deepEqual(answers, sorted);
});

// --- check ---

test('check: an answer is found', () => {
  const state = check(start(fixed), 'golf');
  assert.deepEqual(state.found, ['golf']);
  assert.equal(state.last.result, 'found');
});

test('check: capital letters are accepted', () => {
  assert.equal(check(start(fixed), 'FIG').last.result, 'found');
});

test('check: a word without the center letter is turned back kindly', () => {
  assert.equal(check(start(fixed), 'boil').last.result, 'no-center');
});

test('check: short words, repeats, and real words not on today\'s list', () => {
  assert.equal(check(start(fixed), 'go').last.result, 'too-short');
  assert.equal(check(check(start(fixed), 'big'), 'big').last.result, 'already');
  assert.equal(check(start(fixed), 'bog').last.result, 'not-today');
});

test('check: finding every word wins', () => {
  let state = start(fixed);
  for (const word of fixed.answers) state = check(state, word);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 'big'));
});

// --- hints ---

test('useHint shows letters of the shortest unfound word first', () => {
  let state = start(fixed);
  state = useHint(state);
  assert.deepEqual(state.hints, { big: 1 });
  state = useHint(state);
  assert.deepEqual(state.hints, { big: 2 });
  // Never the whole word: after two letters of "big", the next hint moves on.
  state = useHint(state);
  assert.deepEqual(state.hints, { big: 2, fig: 1 });
});

test('useHint skips words already found', () => {
  const state = useHint(check(start(fixed), 'big'));
  assert.deepEqual(state.hints, { fig: 1 });
});

// --- verify ---

test('verify: catches broken wheels', () => {
  assert.equal(verify(fixed, words).ok, true);
  assert.equal(verify({ ...fixed, answers: ['big', 'fig', 'fog', 'log'] }, words).ok, false); // golf missing
  assert.equal(verify({ ...fixed, answers: [...fixed.answers, 'zzz'] }, words).ok, false);
  assert.equal(verify({ ...fixed, outside: ['f', 'l'] }, words).ok, false);
  assert.ok(MIN_WORDS <= MAX_WORDS);
});
