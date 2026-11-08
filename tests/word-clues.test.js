// Tests for src/games/word-clues.js and data/rich-words.json.
// Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, check, next, hint, currentStep, answerFor, entryProblems, wordsForDay,
  WORDS_PER_DAY,
} from '../src/games/word-clues.js';

const WORDS = JSON.parse(readFileSync(new URL('../data/rich-words.json', import.meta.url), 'utf8')).words;
const ALL = WORDS.map((w) => w.word);
const seedForDay = (key) => seedFor(key, 'word-clues');

const furious = {
  word: 'furious',
  story: ['Zip spilled paint on the new rug.', 'Pip stomped and turned red.', 'Pip was furious!'],
  meaning: 'very, very angry',
  wrong: ['very sleepy', 'a little bit happy'],
  use: 'Coach was ___ when someone popped all the balls.',
  notFit: ['drowsy', 'soggy'],
};
const enormous = {
  word: 'enormous',
  story: ['The whale swam past the boat.', 'It was longer than a school bus.', 'It was enormous!'],
  meaning: 'very, very big',
  wrong: ['very, very fast', 'very, very loud'],
  use: 'The ___ elephant could not fit through the door.',
  notFit: ['drowsy', 'furious'],
};
const fixed = generate(1, [furious, enormous], 0);

// --- the word list ---

test('every word in the list has a 3-sentence story that uses it once, and a fill-in sentence', () => {
  for (const entry of WORDS) assert.deepEqual(entryProblems(entry, ALL), [], entry.word);
});

test('the list has at least 30 different words', () => {
  assert.ok(WORDS.length >= 30, `only ${WORDS.length} words`);
  assert.equal(new Set(ALL).size, ALL.length);
});

test('entryProblems catches a story that never uses the word', () => {
  const bad = { ...furious, story: ['A.', 'B.', 'C.'] };
  assert.match(entryProblems(bad).join(), /0 times/);
});

// --- dealing words ---

test('no word repeats until the whole list has been used', () => {
  const seen = new Set();
  for (let day = 0; day < Math.floor(WORDS.length / WORDS_PER_DAY); day++) {
    for (const { word } of wordsForDay(WORDS, day)) {
      assert.ok(!seen.has(word), `${word} came back on day ${day}`);
      seen.add(word);
    }
  }
});

test('every day for two years is valid', () => {
  everyDay((key, day) => {
    const result = verify(generate(seedForDay(key), WORDS, day));
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
  });
});

test('a day is: both stories, then use each word', () => {
  assert.deepEqual(fixed.steps.map((s) => `${s.type}${s.word}`), ['meaning0', 'meaning1', 'use0', 'use1']);
  assert.ok(fixed.steps[2].options.includes(fixed.entries[0].word));
});

// --- playing ---

test('a wrong choice is crossed off with a hint; the right one finishes the step', () => {
  let state = start(fixed);
  const entry = fixed.entries[currentStep(state).word];
  const wrong = entry.wrong[0];
  state = check(state, wrong);
  assert.equal(state.last.correct, false);
  assert.deepEqual(state.tried, [wrong]);
  assert.match(hint(state), /clues/);
  assert.throws(() => check(state, wrong), /not a choice/);
  state = check(state, entry.meaning);
  assert.equal(state.done, true);
});

test('the use step hint says to try each word', () => {
  const state = { ...start(fixed), index: 2 };
  assert.match(hint(state), /makes sense/);
});

test('can\'t move on before the right choice', () => {
  assert.throws(() => next(start(fixed)));
});

test('getting every step right wins', () => {
  let state = start(fixed);
  for (let i = 0; i < fixed.steps.length; i++) {
    state = next(check(state, answerFor(fixed, currentStep(state))));
  }
  assert.equal(state.status, 'won');
});
