// Tests for src/games/spell-it.js and data/spelling.json. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, check, fill, entryProblems, wordsForDay, hasSound, WORDS_PER_DAY, MAX_TRIES,
} from '../src/games/spell-it.js';

const WORDS = JSON.parse(readFileSync(new URL('../data/spelling.json', import.meta.url), 'utf8')).words;
const LEVEL3 = Object.values(JSON.parse(readFileSync(new URL('../data/words/level-3.json', import.meta.url), 'utf8')).words).flat();
const seedForDay = (key) => seedFor(key, 'spell-it');
const sample = generate(seedForDay('2026-11-13'), WORDS, 0);

// --- the word list ---

test('every word in the list is complete and checks out', () => {
  assert.ok(WORDS.length >= 120, `only ${WORDS.length} words`);
  const problems = WORDS.flatMap(entryProblems);
  assert.deepEqual(problems, []);
});

test('the words come from the 5-letter list and none repeats', () => {
  for (const { word, ending } of WORDS) {
    if (ending) assert.ok(word.length >= 5 && word.length <= 8, word); // words with endings are their own list
    else assert.ok(LEVEL3.includes(word), word);
  }
  assert.equal(new Set(WORDS.map((w) => w.word)).size, WORDS.length);
});

test('no word repeats until the whole list has been used', () => {
  const days = Math.floor(WORDS.filter((w) => !w.ending).length / WORDS_PER_DAY);
  const seen = Array.from({ length: days }, (_, day) => wordsForDay(WORDS, day)).flat().map((w) => w.word);
  assert.equal(new Set(seen).size, seen.length);
});

test('fill puts letters into the blanks in order', () => {
  assert.equal(fill('tr__n', 'ai'), 'train');
  assert.equal(fill('sn_k_', 'ae'), 'snake');
});

// --- making puzzles ---

test('every day for two years makes 3 valid rounds', () => {
  everyDay((key, day) => {
    const result = verify(generate(seedForDay(key), WORDS, day));
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
  });
});

test('most days have a sound round in the middle', () => {
  let withSound = 0;
  everyDay((key, day) => { if (generate(seedForDay(key), WORDS, day).rounds[1].kind === 'sound') withSound++; });
  assert.ok(withSound > 700, `${withSound} of 730 days`);
  assert.ok(WORDS.filter(hasSound).length > WORDS.length * 0.9);
  assert.ok(generate(seedForDay('2026-11-13'), WORDS, 0).rounds.every((r) => !WORDS.find((w) => w.word === r.word).ending)); // level 1: no endings
});

// --- playing ---

const rightAnswer = (round) => (round.kind === 'sound' ? round.correct : round.word);

test('the right answers win', () => {
  let state = start(sample);
  for (const round of sample.rounds) state = check(state, rightAnswer(round));
  assert.equal(state.status, 'won');
  assert.deepEqual(state.shown, []);
});

test('a wrong spelling marks the right letters and stays; the third shows the word', () => {
  let state = start(sample);
  state = check(state, rightAnswer(sample.rounds[0]));
  state = check(state, rightAnswer(sample.rounds[1]));
  const { word } = sample.rounds[2];
  const wrong = word.slice(0, 2) + 'zzz'.slice(0, word.length - 2);
  state = check(state, wrong);
  assert.equal(state.round, 2);
  assert.deepEqual(state.last.marks.slice(0, 2), [true, true]);
  for (let i = 1; i < MAX_TRIES; i++) state = check(state, wrong);
  assert.equal(state.last.shown, true);
  assert.equal(state.status, 'won');
  assert.deepEqual(state.shown, [2]);
});

test('a wrong pick or sound stays on the round (no limit, no penalty)', () => {
  let state = start(sample);
  const wrong = sample.rounds[0].choices.find((c) => c !== sample.rounds[0].word);
  for (let i = 0; i < 5; i++) state = check(state, wrong);
  assert.equal(state.round, 0);
});

// --- words that come back ---

test('a missed word comes back, as the word to spell', () => {
  const usual = generate(seedForDay('2026-11-13'), WORDS, 0);
  const missed = WORDS.find((w) => !usual.rounds.some((r) => r.word === w.word)).word;
  const puzzle = generate(seedForDay('2026-11-13'), WORDS, 0, [missed]);
  assert.equal(verify(puzzle).ok, true);
  assert.equal(puzzle.rounds[2].word, missed);
  assert.equal(puzzle.rounds[2].kind, 'spell');
  // A word that isn't in the list is ignored.
  assert.deepEqual(generate(seedForDay('2026-11-13'), WORDS, 0, ['zzzzz']), usual);
});

// --- words with endings (levels 2 and 3) ---

const isEnding = (word) => Boolean(WORDS.find((w) => w.word === word).ending);

test('level 2 asks which ending is right; level 3 has that word spelled in full', () => {
  everyDay((key, day) => {
    const two = generate(seedForDay(key), WORDS, day, [], 2);
    assert.ok(verify(two).ok, `${key}: ${verify(two).problems.join('; ')}`);
    assert.equal(two.rounds[1].kind, 'sound');
    assert.ok(isEnding(two.rounds[1].word) && two.rounds[1].shape.endsWith('+ ?'));
    assert.equal(two.rounds.filter((r) => isEnding(r.word)).length, 1);

    const three = generate(seedForDay(key), WORDS, day, [], 3);
    assert.ok(verify(three).ok, `${key}: ${verify(three).problems.join('; ')}`);
    assert.equal(three.rounds[2].kind, 'spell');
    assert.ok(isEnding(three.rounds[2].word));
  }, 365);
});

test('every ending word comes around, and the list has all four rules', () => {
  const endings = WORDS.filter((w) => w.ending);
  const seen = new Set(Array.from({ length: endings.length }, (_, day) => generate(seedForDay('x'), WORDS, day, [], 2).rounds[1].word));
  assert.equal(seen.size, endings.length);
  assert.deepEqual([...new Set(endings.map((w) => w.pattern))].sort(), ['double', 'drop-e', 'just-add', 'y-to-i']);
});
