// Tests for src/games/word-builder.js and data/word-builder.json.
// Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay, loadData, assertValid } from './helpers.js';
import {
  generate, verify, start, check, hint, explain, itemProblems, partLabel, PARTS, LEVELS, KINDS, ROUNDS,
} from '../src/games/word-builder.js';

const ITEMS = loadData('word-builder.json').items;
const seed = (key) => seedFor(key, 'word-builder');
const sample = generate(seed('2026-11-26'), ITEMS, 329);
const unkind = { base: 'kind', part: 'un', where: 'start', word: 'unkind', means: 'not kind', wrong: ['very kind', 'kind again'], level: 1 };

// --- the word list ---

test('every item has all its fields, and its word is the base with the part at the right end', () => {
  for (const item of ITEMS) assert.deepEqual(itemProblems(item), [], item.word);
});

test('itemProblems catches a missing field, a part at the wrong end, a word not built from its base, and a wrong level', () => {
  assert.deepEqual(itemProblems(unkind), []);
  assert.match(itemProblems({ ...unkind, means: '' }).join(), /missing/);
  assert.match(itemProblems({ ...unkind, word: 'kindun' }).join(), /needs "un" at its start/);
  assert.match(itemProblems({ ...unkind, word: 'unsafe' }).join(), /not built from/);
  assert.match(itemProblems({ ...unkind, wrong: ['not kind', 'kind again'] }).join(), /two different wrong meanings/);
  assert.match(itemProblems({ ...unkind, level: 2 }).join(), /another level/);
});

test('there are at least 90 items and no word comes twice', () => {
  assert.ok(ITEMS.length >= 90, `only ${ITEMS.length} items`);
  assert.equal(new Set(ITEMS.map((item) => item.word)).size, ITEMS.length);
});

test('each level has at least 25 items, and each part is used at least 6 times', () => {
  for (const level of [1, 2, 3]) {
    const count = ITEMS.filter((item) => item.level === level).length;
    assert.ok(count >= 25, `level ${level} has only ${count} items`);
  }
  for (const part of Object.keys(PARTS)) {
    const count = ITEMS.filter((item) => item.part === part).length;
    assert.ok(count >= 6, `${part} is used only ${count} times`);
  }
});

test('none of the words the privacy rule bans is anywhere in the data file', () => {
  // The words are written in two pieces here so this file doesn't hold them either.
  const banned = ['h-e', 'h-im', 'h-is', 'sh-e', 'h-er', 's-on', 'd-aughter', 'y-ear-old'].map((word) => word.replace('-', ''));
  const text = readFileSync(new URL('../data/word-builder.json', import.meta.url), 'utf8');
  for (const word of banned) assert.doesNotMatch(text, new RegExp(`\\b${word}\\b`, 'i'), word);
});

// --- making a day ---

test('every day for two years, at every level, makes 4 valid rounds that take turns: meaning, part', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key, day) => {
      const puzzle = generate(seed(key), ITEMS, day, level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      assert.deepEqual(puzzle.rounds.map((round) => round.kind), ['meaning', 'part', 'meaning', 'part']);
      for (const round of puzzle.rounds) assert.ok(LEVELS[level - 1].includes(round.part));
    });
  }
});

test('the same day and level always make the same rounds', () => {
  assert.deepEqual(generate(seed('2026-11-26'), ITEMS, 329, 1), sample);
});

test('the puzzles vary: hundreds of different days in two years', () => {
  const seen = new Set();
  everyDay((key, day) => seen.add(JSON.stringify(generate(seed(key), ITEMS, day))));
  assert.ok(seen.size > 500, `only ${seen.size} different days`);
});

test('no word repeats until every word of the level has been used', () => {
  for (const level of [1, 2, 3]) {
    const deck = ITEMS.filter((item) => item.level <= level).length;
    const seen = new Set();
    for (let day = 0; day < Math.floor(deck / ROUNDS); day++) {
      for (const { word } of generate(1, ITEMS, day, level).rounds) {
        assert.ok(!seen.has(word), `${word} came back on day ${day} at level ${level}`);
        seen.add(word);
      }
    }
  }
});

test('higher levels bring in their new parts', () => {
  const partsSeen = (level) => {
    const seen = new Set();
    everyDay((key, day) => generate(seed(key), ITEMS, day, level).rounds.forEach((round) => seen.add(round.part)), 60);
    return seen;
  };
  assert.ok(!partsSeen(1).has('er'));
  assert.ok(partsSeen(2).has('ly'));
  assert.ok(partsSeen(3).has('mis'));
});

test('in a part round, when the answer is un- or dis- (which both mean not), the other one is never a choice', () => {
  everyDay((key, day) => {
    for (const { kind, answer, choices } of generate(seed(key), ITEMS, day, 3).rounds) {
      if (kind === 'part' && ['un', 'dis'].includes(answer)) assert.ok(!(choices.includes('un') && choices.includes('dis')), key);
    }
  });
});

// --- playing ---

test('check: a wrong pick stays on the round; right picks finish all 4', () => {
  let state = check(start(sample), 'nope');
  assert.deepEqual([state.round, state.tries, state.last.correct], [0, 1, false]);
  for (let i = 0; i < 5; i++) state = check(state, 'nope'); // never shown: there are only 3 choices
  assert.equal(state.round, 0);
  for (const round of sample.rounds) state = check(state, round.answer);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 'un'));
});

test('hints explain the part, and a finished round explains the word', () => {
  assert.equal(partLabel('un'), 'un-');
  assert.equal(partLabel('ful'), '-ful');
  assert.equal(hint({ ...unkind, kind: 'meaning' }, 'very kind'), 'un- means not.');
  assert.equal(hint({ ...unkind, kind: 'part' }, 're'), 're- means again. Try another one.');
  assert.equal(explain(unkind), 'un- means not. Unkind means not kind.');
});

test('verify turns away bad puzzles', () => {
  const withRound = (at, change) => ({ ...sample, rounds: sample.rounds.map((round, i) => (i === at ? { ...round, ...change } : round)) });
  const [first, second] = sample.rounds;
  assert.equal(KINDS[1], second.kind);
  assert.equal(verify(sample).ok, true);
  assert.equal(verify({ ...sample, rounds: sample.rounds.slice(1) }).ok, false); // too few rounds
  assert.equal(verify(withRound(1, first)).ok, false); // the same word twice
  assert.equal(verify(withRound(0, { answer: first.wrong[0] })).ok, false); // a wrong meaning as the answer
  assert.equal(verify(withRound(0, { choices: [first.means, first.wrong[0], first.wrong[0]] })).ok, false); // a choice twice
  assert.equal(verify(withRound(1, { choices: [second.part, second.part, 're'] })).ok, false); // a wrong part the same as the right one
  assert.equal(verify(withRound(1, { choices: ['pre', 'mis', second.part] })).ok, false); // parts from a higher level
  assert.equal(verify(withRound(1, { choices: second.choices.filter((choice) => choice !== second.part).concat('nope') })).ok, false); // no right part
  assert.equal(verify(withRound(0, { word: 'kindun' })).ok, false); // a word that isn't its base and part
  const twins = { level: 3, rounds: sample.rounds.map((round, i) => (i === 1 ? { ...unkind, kind: 'part', answer: 'un', choices: ['un', 'dis', 're'] } : round)) };
  assert.match(verify(twins).problems.join(), /means the same/); // un- and dis- together
});
