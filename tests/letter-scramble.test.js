// Tests for src/games/letter-scramble.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, check, hint, current, wordsWithLetters, PLAN,
} from '../src/games/letter-scramble.js';

const load = (path) => Object.values(JSON.parse(readFileSync(new URL(path, import.meta.url))).words).flat();
const WORDS = [...load('../data/words/level-1.json'), ...load('../data/words/level-2.json')];
const seedForDay = (key) => seedFor(key, 'letter-scramble');

// A fixed day: net, cup, frog, bell.
const fixed = {
  items: [
    { word: 'net', mixed: 'etn' },
    { word: 'cup', mixed: 'pcu' },
    { word: 'frog', mixed: 'gorf' },
    { word: 'bell', mixed: 'lebl' },
  ],
  words: WORDS,
};

// --- generate and verify ---

test('wordsWithLetters finds words that share letters', () => {
  assert.deepEqual(wordsWithLetters('net', WORDS).sort(), ['net', 'ten']);
  assert.deepEqual(wordsWithLetters('frog', WORDS), ['frog']);
});

test('generate gives the same words for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08'), WORDS).items, generate(seedForDay('2026-11-08'), WORDS).items);
});

test('every day for two years makes 4 valid scrambles', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key), WORDS);
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.deepEqual(puzzle.items.map((item) => item.word.length), PLAN);
  });
});

test('verify catches a scramble that is already a word, or the wrong letters', () => {
  assert.equal(verify(fixed).ok, true);
  const already = { ...fixed, items: [{ word: 'net', mixed: 'ten' }, ...fixed.items.slice(1)] };
  assert.equal(verify(already).ok, false);
  const wrongLetters = { ...fixed, items: [{ word: 'net', mixed: 'nat' }, ...fixed.items.slice(1)] };
  assert.equal(verify(wrongLetters).ok, false);
});

// --- check ---

test('check: the right spelling moves to the next word', () => {
  const state = check(start(fixed), 'net');
  assert.equal(state.last.result, 'right');
  assert.equal(current(state).word, 'cup');
  assert.deepEqual(state.solved, ['net']);
});

test('check: another real word with the same letters counts too', () => {
  const state = check(start(fixed), 'ten');
  assert.equal(state.last.result, 'right');
  assert.deepEqual(state.solved, ['ten']);
});

test('check: a wrong order locks the letters that are in the right place', () => {
  const state = check(start(fixed), 'nte'); // n is right, t and e are not
  assert.equal(state.last.result, 'wrong');
  assert.deepEqual(state.last.marks, [true, false, false]);
  assert.deepEqual(state.locked, [true, false, false]);
});

test('check: repeated letters are judged by position', () => {
  let state = start(fixed);
  for (const word of ['net', 'cup', 'frog']) state = check(state, word);
  state = check(state, 'lebl');
  assert.deepEqual(state.last.marks, [false, true, false, true]);
});

test('check: letters that are not this word\'s letters are a mistake in the screen code', () => {
  assert.throws(() => check(start(fixed), 'cat'));
});

test('check: spelling all 4 words wins', () => {
  let state = start(fixed);
  for (const { word } of fixed.items) state = check(state, word);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 'net'));
});

// --- hints ---

test('hint: locks the first letter not yet locked, then the next', () => {
  let state = check(start(fixed), 'nte'); // n locked
  let result = hint(state);
  assert.equal(result.position, 1);
  result = hint(result.state);
  assert.equal(result.position, 2);
  assert.equal(hint(result.state).position, null);
});
