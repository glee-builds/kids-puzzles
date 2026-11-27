// Tests for src/games/word-kinds.js and data/word-kinds.json. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay, loadData, assertValid } from './helpers.js';
import { generate, verify, start, check, hint, isRight, KINDS, ROUNDS, MAX_TRIES } from '../src/games/word-kinds.js';

const { items } = loadData('word-kinds.json');
const seedForDay = (key) => seedFor(key, 'word-kinds');
const sample = generate(seedForDay('2026-11-26'), items, 0);
const count = (item, kind) => item.kinds.filter((k) => k === kind).length;
const isBe = (word) => ['is', 'are', 'was'].includes(word.toLowerCase());
const spots = (round) => round.tags.flatMap((tag, i) => (tag === round.want ? [i] : []));
const rightAnswer = (round) => (round.kind === 'name' ? round.tags[round.target] : spots(round));

// --- the data ---

test('every sentence is 5 to 9 words, each with one of the 4 kinds, and has a noun and a verb', () => {
  for (const item of items) {
    const text = item.words.join(' ');
    assert.equal(item.words.length, item.kinds.length, text);
    assert.ok(item.words.length >= 5 && item.words.length <= 9, text);
    for (const kind of item.kinds) assert.ok(['', ...KINDS].includes(kind), `${text}: ${kind}`);
    assert.ok(count(item, 'noun') >= 1 && count(item, 'verb') >= 1, text);
    assert.match(text, /^[A-Z][A-Za-z ]*$/, 'a capital first, and only letters (the screen adds the period)');
  }
});

test('there are at least 30 sentences for each level, 90 in all, and none twice', () => {
  for (const level of [1, 2, 3]) assert.ok(items.filter((item) => item.level === level).length >= 30, `level ${level}`);
  assert.ok(items.length >= 90);
  assert.ok(items.every((item) => [1, 2, 3].includes(item.level)));
  assert.equal(new Set(items.map((item) => item.words.join(' ').toLowerCase())).size, items.length);
});

test('each level has the sentences it should', () => {
  for (const item of items) {
    const text = item.words.join(' ');
    const be = item.words.filter(isBe);
    if (item.level === 1) assert.deepEqual(KINDS.map((kind) => count(item, kind)), [1, 1, 1], text);
    if (item.level === 2) assert.ok(count(item, 'noun') >= 2 || count(item, 'describing') >= 2, text);
    if (item.level < 3) assert.deepEqual(be, [], `${text}: is, are, and was wait for level 3`);
    else assert.ok(be.length >= 1 && count(item, 'describing') >= 1, text);
    // is, are, and was are always verbs; "the", "a", and "and" never have a kind.
    item.words.forEach((word, i) => {
      if (isBe(word)) assert.equal(item.kinds[i], 'verb', text);
      if (/^(the|a|and|very)$/i.test(word)) assert.equal(item.kinds[i], '', text);
    });
  }
});

test('a word keeps the same kind in every sentence', () => {
  const seen = new Map();
  for (const item of items) {
    item.words.forEach((word, i) => {
      const key = word.toLowerCase();
      if (seen.has(key)) assert.equal(item.kinds[i], seen.get(key), `"${key}" in ${item.words.join(' ')}`);
      seen.set(key, item.kinds[i]);
    });
  }
});

test('the data file has none of the words this public repo never uses', () => {
  // Spelled backwards, so this file passes the same scan.
  const banned = ['eh', 'mih', 'sih', 'ehs', 'reh', 'nos', 'rethguad', 'dlo-raey'].map((word) => [...word].reverse().join(''));
  const file = readFileSync(new URL('../data/word-kinds.json', import.meta.url), 'utf8');
  for (const word of banned) assert.doesNotMatch(file, new RegExp(`\\b${word}\\b`, 'i'), word);
});

// --- making puzzles ---

test('every day for two years, at every level, makes 5 valid rounds of the right kinds', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key, day) => {
      const puzzle = generate(seedForDay(key), items, day, level);
      assertValid(verify(puzzle), `level ${level}, ${key}`);
      assert.deepEqual(puzzle.rounds.map((round) => round.kind), ROUNDS[level - 1]);
      for (const round of puzzle.rounds) assert.ok(isRight(round, rightAnswer(round)));
    });
  }
});

test('the same day and level always make the same puzzle; level 1 is the same as no level', () => {
  assert.deepEqual(generate(seedForDay('2026-11-26'), items, 0, 1), sample);
  assert.deepEqual(generate(seedForDay('2026-11-26'), items, 0, 3), generate(seedForDay('2026-11-26'), items, 0, 3));
  assert.equal(generate(seedForDay('2026-11-26'), items, 0, 9).level, 3); // a level past the top is the top
});

test('the puzzles vary, and no sentence repeats for 6 days', () => {
  for (const level of [1, 2, 3]) {
    const puzzles = new Set();
    everyDay((key, day) => puzzles.add(JSON.stringify(generate(seedForDay(key), items, day, level).rounds)));
    assert.ok(puzzles.size > 100, `level ${level}: ${puzzles.size} different puzzles`);
    const week = Array.from({ length: 6 }, (_, day) => generate(1, items, day, level).rounds.map((round) => round.words.join(' '))).flat();
    assert.equal(new Set(week).size, 30);
  }
});

test('a day at level 1 asks about every kind of word', () => {
  everyDay((key, day) => {
    const asked = generate(seedForDay(key), items, day).rounds.map(rightAnswer);
    assert.equal(new Set(asked).size, 3, key);
  });
});

// --- playing ---

test('the right answers win all 5 rounds at every level', () => {
  for (const level of [1, 2, 3]) {
    const puzzle = generate(seedForDay('2026-11-26'), items, 0, level);
    let state = start(puzzle);
    for (const round of puzzle.rounds) state = check(state, rightAnswer(round));
    assert.equal(state.status, 'won');
    assert.deepEqual(state.shown, []);
    assert.throws(() => check(state, 'noun'));
  }
});

test('a name round: a wrong kind stays on the round, however many times, with a hint that explains', () => {
  const round = sample.rounds[0];
  const wrong = KINDS.find((kind) => kind !== rightAnswer(round));
  let state = start(sample);
  for (let i = 0; i < 5; i++) state = check(state, wrong);
  assert.deepEqual([state.round, state.last.correct, state.last.shown], [0, false, false]);
  assert.ok(hint(round).includes(round.words[round.target].toLowerCase()));
});

test('hints say what each kind of word means', () => {
  const words = ['The', 'green', 'frog', 'jumps', 'high'];
  const tags = ['', 'describing', 'noun', 'verb', ''];
  assert.match(hint({ kind: 'name', words, tags, target: 3 }), /^A verb is an action\. .*jumps is a verb\.$/);
  assert.match(hint({ kind: 'name', words, tags, target: 2 }), /person, animal, place, or thing.*frog is a noun\.$/);
  assert.match(hint({ kind: 'name', words, tags, target: 1 }), /what something is like.*green is a describing word\.$/);
  assert.equal(hint({ kind: 'find', words, tags, want: 'noun' }), 'There is 1 noun. A noun is a person, animal, place, or thing.');
  const soup = { words: ['The', 'soup', 'in', 'the', 'bowl', 'is', 'hot'], tags: ['', 'noun', '', '', 'noun', 'verb', 'describing'] };
  assert.equal(hint({ kind: 'find', ...soup, want: 'noun' }), 'There are 2 nouns. A noun is a person, animal, place, or thing.');
  assert.match(hint({ kind: 'find', ...soup, want: 'verb' }), /^There is 1 verb\..*Is, are, and was are verbs too\.$/);
  assert.match(hint({ kind: 'name', ...soup, target: 5 }), /not actions.*is is a verb\.$/);
});

test('a find round: only exactly the right words win, in any order; the third miss shows them', () => {
  const puzzle = generate(seedForDay('2026-11-26'), items, 0, 3);
  const round = puzzle.rounds[0];
  const right = spots(round);
  const other = round.tags.findIndex((tag) => tag !== round.want);
  assert.equal(isRight(round, [...right].reverse()), true);
  assert.equal(isRight(round, [...right, other]), false);
  assert.equal(isRight(round, right.slice(1)), false);
  let state = start(puzzle);
  for (let i = 0; i < MAX_TRIES - 1; i++) state = check(state, [other]);
  assert.deepEqual([state.round, state.tries], [0, MAX_TRIES - 1]);
  state = check(state, [other]);
  assert.deepEqual([state.round, state.last.shown, state.shown], [1, true, [0]]);
});

// --- verify ---

test('verify turns away bad puzzles', () => {
  const change = (i, changes) => ({ ...sample, rounds: sample.rounds.map((round, j) => (j === i ? { ...round, ...changes } : round)) });
  const filler = sample.rounds[0].tags.indexOf('');
  assert.equal(verify({ level: 1, rounds: sample.rounds.slice(1) }).ok, false, '4 rounds');
  assert.equal(verify({ level: 2, rounds: sample.rounds }).ok, false, 'level 2 needs find rounds');
  assert.equal(verify(change(0, { target: filler })).ok, false, 'the underlined word has no kind');
  assert.equal(verify(change(0, { tags: sample.rounds[0].tags.slice(1) })).ok, false, 'a word without a kind');
  assert.equal(verify(change(0, { tags: sample.rounds[0].tags.map((tag) => tag && 'adverb') })).ok, false, 'a kind that is not one of the 3');
  assert.equal(verify(change(1, sample.rounds[0])).ok, false, 'the same sentence twice');
  const top = generate(seedForDay('2026-11-26'), items, 0, 3);
  const none = { ...top, rounds: top.rounds.map((round, j) => (j === 0 ? { ...round, tags: round.tags.map(() => '') } : round)) };
  assert.equal(verify(none).ok, false, 'nothing to find');
});
