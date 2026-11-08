// Tests for src/games/word-guess.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { generate, start, check, markGuess, verify, MAX_GUESSES } from '../src/games/word-guess.js';

const level1 = JSON.parse(
  readFileSync(new URL('../data/words/level-1.json', import.meta.url), 'utf8'),
);
const words = Object.values(level1.words).flat();

// --- generate ---

test('generate picks a word from the list', () => {
  const puzzle = generate(seedFor('2026-11-08', 'word-guess'), words);
  assert.ok(words.includes(puzzle.answer));
  assert.equal(puzzle.length, 3);
  assert.equal(puzzle.maxGuesses, MAX_GUESSES);
});

test('generate gives the same word for the same day', () => {
  const a = generate(seedFor('2026-11-08', 'word-guess'), words);
  const b = generate(seedFor('2026-11-08', 'word-guess'), words);
  assert.equal(a.answer, b.answer);
});

test('generate gives a variety of words across a month', () => {
  const answers = new Set();
  for (let day = 1; day <= 30; day++) {
    const key = `2026-11-${String(day).padStart(2, '0')}`;
    answers.add(generate(seedFor(key, 'word-guess'), words).answer);
  }
  assert.ok(answers.size >= 20, `only ${answers.size} different words in 30 days`);
});

// --- markGuess ---

test('markGuess: all letters right', () => {
  assert.deepEqual(markGuess('cat', 'cat'), ['here', 'here', 'here']);
});

test('markGuess: no letters in the word', () => {
  assert.deepEqual(markGuess('dog', 'cat'), ['none', 'none', 'none']);
});

test('markGuess: right letters in the wrong spots', () => {
  assert.deepEqual(markGuess('tac', 'cat'), ['elsewhere', 'here', 'elsewhere']);
});

test('markGuess: a repeated letter only counts as often as it appears in the answer', () => {
  // "mom" has one o; "pop" guesses o once and p twice. p is not in "mom".
  assert.deepEqual(markGuess('pop', 'mom'), ['none', 'here', 'none']);
  // "mud" has one m; the guess "mom" has two. The first m is right; the last gets nothing.
  assert.deepEqual(markGuess('mom', 'mud'), ['here', 'none', 'none']);
  // "dad" has two d's; the guess "add" finds one in the right spot and one elsewhere.
  assert.deepEqual(markGuess('add', 'dad'), ['elsewhere', 'elsewhere', 'here']);
});

// --- check ---

const catPuzzle = { answer: 'cat', length: 3, maxGuesses: MAX_GUESSES };

test('check: guessing the word wins', () => {
  const state = check(start(catPuzzle), 'cat');
  assert.equal(state.status, 'won');
  assert.equal(state.guesses.length, 1);
});

test('check: a wrong guess keeps playing and records the marks', () => {
  const state = check(start(catPuzzle), 'cap');
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.guesses[0], { word: 'cap', marks: ['here', 'here', 'none'] });
});

test('check: capital letters are accepted', () => {
  assert.equal(check(start(catPuzzle), 'CAT').status, 'won');
});

test('check: any three letters count as a guess, even if not a real word', () => {
  assert.equal(check(start(catPuzzle), 'zzz').status, 'playing');
});

test('check: after the last try the word is revealed', () => {
  let state = start(catPuzzle);
  for (let i = 0; i < MAX_GUESSES; i++) {
    state = check(state, 'dog');
  }
  assert.equal(state.status, 'revealed');
  assert.equal(state.guesses.length, MAX_GUESSES);
});

test('check: winning on the last try counts as a win', () => {
  let state = start(catPuzzle);
  for (let i = 0; i < MAX_GUESSES - 1; i++) {
    state = check(state, 'dog');
  }
  assert.equal(check(state, 'cat').status, 'won');
});

test('check: does not change the old state', () => {
  const before = start(catPuzzle);
  check(before, 'dog');
  assert.equal(before.guesses.length, 0);
});

test('check: refuses a guess of the wrong length or with non-letters', () => {
  assert.throws(() => check(start(catPuzzle), 'ca'));
  assert.throws(() => check(start(catPuzzle), 'cats'));
  assert.throws(() => check(start(catPuzzle), 'c4t'));
});

test('check: refuses a guess after the puzzle is finished', () => {
  const won = check(start(catPuzzle), 'cat');
  assert.throws(() => check(won, 'dog'));
});

// --- verify ---

test('verify: every word in the level 1 list makes a valid puzzle', () => {
  for (const answer of words) {
    const result = verify({ answer, length: answer.length, maxGuesses: MAX_GUESSES });
    assert.ok(result.ok, `${answer}: ${result.problems.join('; ')}`);
  }
});

test('verify: catches broken puzzles', () => {
  assert.equal(verify({ answer: 'ca', length: 2, maxGuesses: 6 }).ok, false);
  assert.equal(verify({ answer: 'Cat', length: 3, maxGuesses: 6 }).ok, false);
  assert.equal(verify({ answer: 'cat', length: 4, maxGuesses: 6 }).ok, false);
  assert.equal(verify({ answer: 'cat', length: 3, maxGuesses: 99 }).ok, false);
});
