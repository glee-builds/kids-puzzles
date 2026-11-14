// Tests for src/games/end-marks.js and data/end-marks.json. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, check, hint, unpunctuate, uncapitalize, uncomma, dataProblems, MARKS, MAX_TRIES, KINDS,
} from '../src/games/end-marks.js';

const DATA = JSON.parse(readFileSync(new URL('../data/end-marks.json', import.meta.url), 'utf8'));
const seedForDay = (key) => seedFor(key, 'end-marks');
const sample = generate(seedForDay('2026-11-13'), DATA, 0);
const rightAnswer = (round) => (round.kind === 'mark' ? round.mark : round.kind === 'breaks' ? round.ends : round.marks);

// --- the data ---

test('the sentences and runs check out', () => {
  assert.deepEqual(dataProblems(DATA), []);
  for (const mark of MARKS) {
    assert.ok(DATA.sentences.filter((s) => s.mark === mark).length >= 50, `${mark} sentences`);
  }
  assert.ok(DATA.runs.length >= 50);
  assert.equal(new Set(DATA.sentences.map((s) => s.text)).size, DATA.sentences.length);
});

test('unpunctuate lowercases each start (but not I) and finds the ends', () => {
  assert.deepEqual(unpunctuate(['The frog sat.', 'I see it.', 'Did you?']), {
    words: ['the', 'frog', 'sat', 'I', 'see', 'it', 'did', 'you'],
    ends: [2, 5],
  });
});

// --- making puzzles ---

test('every day for two years makes 5 valid rounds', () => {
  everyDay((key, day) => {
    const result = verify(generate(seedForDay(key), DATA, day));
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
  });
});

test('no run repeats for 60 days', () => {
  const firsts = Array.from({ length: 60 }, (_, day) => generate(seedForDay('x'), DATA, day).rounds[4].sentences[0]);
  assert.equal(new Set(firsts).size, 60);
});

// --- playing ---

test('the right answers win all 5 rounds', () => {
  let state = start(sample);
  for (const round of sample.rounds) state = check(state, rightAnswer(round));
  assert.equal(state.status, 'won');
  assert.deepEqual(state.shown, []);
});

test('a wrong mark stays on the round with a hint', () => {
  const round = sample.rounds[0];
  const wrong = MARKS.find((m) => m !== round.mark);
  const state = check(start(sample), wrong);
  assert.equal(state.round, 0);
  assert.ok(hint(round, wrong).length > 10);
});

test('the breaks: a stop mid-sentence or a missing stop get different hints; 3 misses show it', () => {
  const round = sample.rounds[3];
  assert.match(hint(round, [round.ends[0]]), /still stuck together/);
  assert.match(hint(round, [0]), /middle of a sentence/);
  let state = { ...start(sample), round: 3 };
  for (let i = 0; i < MAX_TRIES; i++) state = check(state, [0]);
  assert.equal(state.last.shown, true);
  assert.equal(state.round, 4);
});

// --- levels: capitals and commas ---

test('uncapitalize lowercases each first word (not I) and lists the ones to fix', () => {
  assert.deepEqual(uncapitalize(['The frog sat.', 'I see it.', 'Did you?']), {
    words: ['the', 'frog', 'sat.', 'I', 'see', 'it.', 'did', 'you?'],
    needs: [0, 6],
  });
});

test('uncomma takes the commas out and remembers where they go', () => {
  assert.deepEqual(uncomma('We saw ducks, frogs, and turtles.'), {
    words: ['We', 'saw', 'ducks', 'frogs', 'and', 'turtles.'],
    commas: [2, 3],
  });
});

test('levels 2 and 3 make 5 valid rounds every day for two years', () => {
  for (const level of [2, 3]) {
    everyDay((key, day) => {
      const puzzle = generate(seedForDay(key), DATA, day, level);
      const result = verify(puzzle);
      assert.ok(result.ok, `level ${level}, ${key}: ${result.problems.join('; ')}`);
      assert.deepEqual(puzzle.rounds.map((r) => r.kind), KINDS[level - 1]);
    });
  }
});

test('level 1 is the same as no level', () => {
  assert.deepEqual(generate(seedForDay('2026-11-13'), DATA, 0, 1).rounds, sample.rounds);
});

test('capitals and commas: the right spots win, and misses get fitting hints', () => {
  const puzzle = generate(seedForDay('2026-11-13'), DATA, 0, 3);
  const [capitals, commas] = puzzle.rounds.slice(3);
  let state = { ...start(puzzle), round: 3 };
  const notFirst = capitals.words.findIndex((_, i) => !capitals.needs.includes(i));
  state = check(state, [notFirst]);
  assert.equal(state.last.correct, false);
  assert.match(hint(capitals, [notFirst]), /first word/);
  assert.match(hint(capitals, [capitals.needs[0]]), /after each end mark/);
  state = check(state, [...capitals.needs].reverse()); // any order
  assert.equal(state.round, 4);
  assert.match(hint(commas, [commas.commas[0]]), /first and the second/);
  state = check(state, commas.commas);
  assert.equal(state.status, 'won');
});

test('the comma lists check out and none repeats for 57 days', () => {
  assert.ok(DATA.lists.length >= 50);
  const firsts = Array.from({ length: DATA.lists.length }, (_, day) => generate(seedForDay('x'), DATA, day, 3).rounds[4].words.join(' '));
  assert.equal(new Set(firsts).size, DATA.lists.length);
});
