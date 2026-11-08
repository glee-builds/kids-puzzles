// Tests for src/games/word-search.js and data/search-themes.json. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, check, hint, lineBetween, themeForDay,
  SIZE, WORDS_PER_DAY, MIN_WORD, MAX_WORD,
} from '../src/games/word-search.js';

const THEMES = JSON.parse(readFileSync(new URL('../data/search-themes.json', import.meta.url), 'utf8')).themes;
const seedForDay = (key) => seedFor(key, 'word-search');
const sample = generate(seedForDay('2026-11-08'), THEMES, 0);
const placedCells = (puzzle, word) => puzzle.placed.find((p) => p.word === word).cells;

// --- the theme lists ---

test('every theme has a name and 16 different words of 3 to 8 letters', () => {
  assert.ok(THEMES.length >= 20, `only ${THEMES.length} themes`);
  for (const theme of THEMES) {
    assert.ok(theme.name, 'missing name');
    assert.equal(theme.words.length, 16, theme.name);
    assert.equal(new Set(theme.words).size, theme.words.length, `${theme.name} repeats a word`);
    for (const word of theme.words) {
      assert.match(word, /^[a-z]+$/, `${theme.name}: ${word}`);
      assert.ok(word.length >= MIN_WORD && word.length <= MAX_WORD, `${theme.name}: ${word}`);
    }
  }
});

test('no theme repeats until every theme has been used', () => {
  const names = THEMES.map((_, day) => themeForDay(THEMES, day).name);
  assert.equal(new Set(names).size, THEMES.length);
});

// --- making puzzles ---

test('every day for two years makes a valid 15x15 grid with 10 words', () => {
  everyDay((key, day) => {
    const puzzle = generate(seedForDay(key), THEMES, day);
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
  });
});

test('the same day always makes the same grid', () => {
  const again = generate(seedForDay('2026-11-08'), THEMES, 0);
  assert.deepEqual(again.grid, sample.grid);
});

test('verify catches a word hidden twice', () => {
  assert.equal(verify(sample).ok, true);
  const word = sample.words.find((w) => w.length <= 5);
  const grid = sample.grid.map((row) => [...row]);
  // Write the word somewhere else as well, across the top or bottom row.
  const row = placedCells(sample, word).some(([r]) => r === 0) ? SIZE - 1 : 0;
  [...word].forEach((ch, i) => { grid[row][i] = ch; });
  assert.equal(verify({ ...sample, grid }).ok, false);
});

// --- tracing ---

test('lineBetween snaps a trace to across or down', () => {
  assert.deepEqual(lineBetween([2, 2], [2, 5]), [[2, 2], [2, 3], [2, 4], [2, 5]]);
  assert.deepEqual(lineBetween([4, 1], [2, 1]), [[4, 1], [3, 1], [2, 1]]);
  assert.deepEqual(lineBetween([0, 0], [1, 3]), [[0, 0], [0, 1], [0, 2], [0, 3]]); // mostly across
});

test('check: tracing a word finds it, forward or backward', () => {
  const [first, second] = sample.words;
  let state = check(start(sample), placedCells(sample, first));
  assert.equal(state.last.result, 'found');
  state = check(state, [...placedCells(sample, second)].reverse());
  assert.equal(state.last.result, 'found');
  assert.deepEqual(state.found, [first, second]);
});

test('check: a word found twice, and letters that are not a word', () => {
  const word = sample.words[0];
  let state = check(start(sample), placedCells(sample, word));
  state = check(state, placedCells(sample, word));
  assert.equal(state.last.result, 'again');
  state = check(state, placedCells(sample, word).slice(0, 2));
  assert.equal(state.last.result, 'miss');
});

test('check: finding every word wins', () => {
  let state = start(sample);
  for (const word of sample.words) state = check(state, placedCells(sample, word));
  assert.equal(state.status, 'won');
  assert.equal(state.found.length, WORDS_PER_DAY);
});

// --- hints ---

test('hint: first letter of the next word, then the whole word', () => {
  const word = sample.words[0];
  let result = hint(start(sample));
  assert.equal(result.word, word);
  assert.deepEqual(result.cells, [placedCells(sample, word)[0]]);
  result = hint(result.state);
  assert.deepEqual(result.cells, placedCells(sample, word));
  const state = check(result.state, placedCells(sample, word));
  assert.equal(hint(state).word, sample.words[1]);
});
