// Tests for src/games/end-marks.js and data/end-marks.json. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, check, hint, unpunctuate, dataProblems, MARKS, MAX_TRIES,
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
