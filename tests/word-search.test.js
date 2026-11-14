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

// --- levels ---

const direction = (cells) => [Math.sign(cells[1][0] - cells[0][0]), Math.sign(cells[1][1] - cells[0][1])].join(',');

test('levels 2 and 3 make a valid grid every day for a year', () => {
  for (const level of [2, 3]) {
    everyDay((key, day) => {
      const puzzle = generate(seedForDay(key), THEMES, day, level);
      const result = verify(puzzle);
      assert.ok(result.ok, `level ${level}, ${key}: ${result.problems.join('; ')}`);
    }, 365);
  }
});

test('level 1 has only across and down; level 2 adds slants; level 3 adds backward and upward', () => {
  const seen = { 1: new Set(), 2: new Set(), 3: new Set() };
  for (const level of [1, 2, 3]) {
    everyDay((key, day) => {
      for (const { cells } of generate(seedForDay(key), THEMES, day, level).placed) seen[level].add(direction(cells));
    }, 30);
  }
  assert.deepEqual([...seen[1]].sort(), ['0,1', '1,0']);
  assert.deepEqual([...seen[2]].sort(), ['0,1', '1,0', '1,1']);
  assert.deepEqual([...seen[3]].sort(), ['-1,0', '0,-1', '0,1', '1,0', '1,1']);
});

test('level 1 is the same as no level', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08'), THEMES, 0, 1).grid, sample.grid);
});

test('lineBetween snaps to a slant only when asked, and stays in the grid', () => {
  assert.deepEqual(lineBetween([2, 2], [5, 5], true), [[2, 2], [3, 3], [4, 4], [5, 5]]);
  assert.deepEqual(lineBetween([2, 2], [5, 4], true), [[2, 2], [3, 3], [4, 4], [5, 5]]); // nearly a slant
  assert.deepEqual(lineBetween([2, 2], [5, 5]), [[2, 2], [2, 3], [2, 4], [2, 5]]);         // level 1: across
  assert.deepEqual(lineBetween([2, 2], [2, 6], true), [[2, 2], [2, 3], [2, 4], [2, 5], [2, 6]]);
  assert.deepEqual(lineBetween([13, 13], [14, 14], true), [[13, 13], [14, 14]]);
});

test('a backward word at level 3 is found by tracing from either end', () => {
  let puzzle;
  let backward;
  everyDay((key, day) => {
    if (backward) return;
    puzzle = generate(seedForDay(key), THEMES, day, 3);
    backward = puzzle.placed.find(({ cells }) => ['0,-1', '-1,0'].includes(direction(cells)));
  }, 30);
  assert.ok(backward);
  assert.equal(check(start(puzzle), backward.cells).last.result, 'found');
  assert.equal(check(start(puzzle), [...backward.cells].reverse()).last.result, 'found');
});

// --- level 4: clues ---

const CLUES = JSON.parse(readFileSync(new URL('../data/search-clues.json', import.meta.url), 'utf8')).clues;

test('every word of every theme has a short clue that does not give it away', () => {
  for (const theme of THEMES) {
    for (const word of theme.words) {
      const clue = CLUES[theme.name]?.[word];
      assert.ok(clue, `${theme.name}: ${word} has no clue`);
      assert.ok(clue.length <= 44, `${theme.name}: the clue for ${word} is ${clue.length} characters`);
      assert.ok(!clue.toLowerCase().includes(word), `${theme.name}: the clue for ${word} gives it away`);
    }
    assert.equal(new Set(theme.words.map((w) => CLUES[theme.name][w])).size, theme.words.length, `${theme.name}: two words share a clue`);
  }
});

test('level 4 has the level 3 directions and a clue for each of the 10 words, every day for a year', () => {
  everyDay((key, day) => {
    const puzzle = generate(seedForDay(key), THEMES, day, 4, CLUES);
    const result = verify(puzzle);
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
    assert.deepEqual(Object.keys(puzzle.clues).sort(), [...puzzle.words].sort());
    assert.deepEqual(puzzle.grid, generate(seedForDay(key), THEMES, day, 3).grid);
  }, 365);
  assert.equal(generate(seedForDay('2026-11-08'), THEMES, 0, 3, CLUES).clues, undefined); // only level 4
});

test('a hint can be asked for the word whose clue is showing', () => {
  const puzzle = generate(seedForDay('2026-11-08'), THEMES, 0, 4, CLUES);
  const wanted = puzzle.words[5];
  assert.equal(hint(start(puzzle), wanted).word, wanted);
  assert.equal(hint(start(puzzle)).word, puzzle.words[0]);
  const found = check(start(puzzle), placedCells(puzzle, wanted));
  assert.equal(hint(found, wanted).word, puzzle.words[0]); // already found: the next one instead
});
