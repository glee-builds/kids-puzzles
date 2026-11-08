// Tests for src/games/word-ladder.js and data/words/ladder.json. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, change, back, hint, current, stepsLeft,
  shortestLadder, acceptedWords,
} from '../src/games/word-ladder.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../data/words/${name}`, import.meta.url), 'utf8'));
const LADDER = Object.values(load('ladder.json').words).flat();
const PHONICS = ['level-1.json', 'level-2.json'].flatMap((f) => Object.values(load(f).words).flat());
const seedForDay = (key) => seedFor(key, 'word-ladder');

// A small hand-made puzzle: CAT to DOG (cat, cot, cog, dog), then a 4-letter one.
const fixed = {
  ladders: [
    { start: 'cat', end: 'dog', best: 3 },
    { start: 'wind', end: 'back', best: 4 },
  ],
  ladderWords: LADDER,
  phonicsWords: PHONICS,
};

// --- the word list ---

test('ladder.json has 3- and 4-letter lowercase words, no repeats', () => {
  const lists = load('ladder.json').words;
  for (const [length, words] of Object.entries(lists)) {
    assert.ok(words.length >= 200, `only ${words.length} ${length}-letter words`);
    assert.equal(new Set(words).size, words.length, `a ${length}-letter word repeats`);
    for (const word of words) assert.match(word, new RegExp(`^[a-z]{${length}}$`), word);
  }
});

test('plurals of 3-letter words are accepted, but not used to start or end', () => {
  const accepted = acceptedWords(LADDER, PHONICS);
  assert.ok(accepted.has('cats'));
  assert.ok(!LADDER.includes('cats'));
});

// --- making puzzles ---

test('every day for two years makes a 3-step and a 4-step ladder from phonics words', () => {
  everyDay((key) => {
    const result = verify(generate(seedForDay(key), LADDER, PHONICS));
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
  });
});

test('verify catches a ladder that is too short', () => {
  assert.equal(verify(fixed).ok, true, verify(fixed).problems.join('; '));
  const short = { ...fixed, ladders: [{ start: 'cat', end: 'cot', best: 1 }, fixed.ladders[1]] };
  assert.equal(verify(short).ok, false);
  const shared = { ...fixed, ladders: [{ start: 'cat', end: 'bag', best: 2 }, fixed.ladders[1]] };
  assert.equal(verify(shared).ok, false); // the a stays: not every letter changes
});

test('shortestLadder finds a way, one letter at a time', () => {
  const path = shortestLadder('cat', 'dog', acceptedWords(LADDER, PHONICS));
  assert.equal(path.length, 4);
  assert.equal(path[0], 'cat');
  assert.equal(path[3], 'dog');
});

// --- playing ---

test('change: real words grow the ladder; others are turned away', () => {
  let state = start(fixed);
  state = change(state, 1, 'o'); // cot
  assert.equal(state.last.result, 'step');
  assert.equal(current(state), 'cot');
  assert.equal(stepsLeft(state), 2);
  assert.equal(change(state, 0, 'x').last.result, 'unknown'); // xot
  assert.equal(change(state, 1, 'a').last.result, 'used');    // cat again
  assert.equal(change(state, 0, 'c').last.result, 'same');
});

test('change: reaching the end word moves to the next ladder, then wins', () => {
  let state = start(fixed);
  for (const [pos, letter] of [[1, 'o'], [2, 'g'], [0, 'd']]) state = change(state, pos, letter);
  assert.equal(state.last.result, 'solved');
  assert.deepEqual(state.solved[0], ['cat', 'cot', 'cog', 'dog']);
  assert.equal(current(state), 'wind');

  const path = shortestLadder('wind', 'back', state.accepted);
  for (const word of path.slice(1)) {
    const pos = [...current(state)].findIndex((ch, i) => ch !== word[i]);
    state = change(state, pos, word[pos]);
  }
  assert.equal(state.status, 'won');
});

test('back: undoes a step but never the start word', () => {
  let state = change(start(fixed), 1, 'o');
  state = back(state);
  assert.equal(current(state), 'cat');
  assert.equal(back(state).chain.length, 1);
});

// --- hints ---

test('hint: first the letter to change, then the move', () => {
  let result = hint(start(fixed));
  assert.equal(typeof result.position, 'number');
  assert.equal(result.word, null);
  result = hint(result.state);
  assert.equal(result.state.chain.length, 2);
  assert.equal(stepsLeft(result.state), 2);
});
