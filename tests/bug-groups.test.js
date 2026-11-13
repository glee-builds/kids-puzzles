// Tests for src/games/bug-groups.js and src/times.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import { stageFor, STAGES, choicesFor } from '../src/times.js';
import {
  generate, verify, start, check, hint, isRight, shows, ROUNDS,
} from '../src/games/bug-groups.js';

const seedForDay = (key) => seedFor(key, 'bug-groups');
const sample = generate(seedForDay('2026-11-13'), 0);
const rightPicture = (round) => round.pictures.findIndex((pads) => shows(pads, round.groups, round.size));
const rightAnswers = (puzzle) => [
  rightPicture(puzzle.rounds[0]),
  puzzle.rounds[1].groups,
  { pads: puzzle.rounds[2].groups, bugs: puzzle.rounds[2].size },
];

// --- times.js ---

test('stages move on after 7 and 14 days of play', () => {
  assert.equal(stageFor(0), 0);
  assert.equal(stageFor(6), 0);
  assert.equal(stageFor(7), 1);
  assert.equal(stageFor(14), 2);
  assert.equal(stageFor(500), 2);
});

test('every size from 2 to 10 is practiced at some stage', () => {
  const all = new Set(STAGES.flatMap((s) => s.sizes));
  for (let n = 2; n <= 10; n++) assert.ok(all.has(n), `${n}`);
});

test('choicesFor gives 3 different answers in order, one right', () => {
  assert.deepEqual(choicesFor(4, [3, 12]), [3, 4, 12]);
  assert.deepEqual(choicesFor(2, [2, 0]), [2, 3, 4]); // skips a repeat and a zero
});

// --- making puzzles ---

test('every day for two years, at every stage, makes valid rounds', () => {
  for (const plays of [0, 7, 14]) {
    everyDay((key) => {
      const puzzle = generate(seedForDay(key), plays);
      const result = verify(puzzle);
      assert.ok(result.ok, `${key}, ${plays} plays: ${result.problems.join('; ')}`);
      assert.equal(puzzle.stage, stageFor(plays));
    });
  }
});

test('the same day and stage always make the same rounds', () => {
  assert.deepEqual(generate(seedForDay('2026-11-13'), 0), sample);
});

test('verify catches two right pictures and groups the same as the size', () => {
  const twoRight = structuredClone(sample);
  const match = twoRight.rounds[0];
  match.pictures = [Array(match.groups).fill(match.size), Array(match.groups).fill(match.size), [1]];
  assert.equal(verify(twoRight).ok, false);
  const square = structuredClone(sample);
  square.rounds[2].groups = square.rounds[2].size;
  assert.equal(verify(square).ok, false);
});

// --- playing ---

test('the right answers win all 3 rounds', () => {
  let state = start(sample);
  for (const answer of rightAnswers(sample)) state = check(state, answer);
  assert.equal(state.status, 'won');
  assert.equal(state.round, ROUNDS.length);
});

test('a miss stays on the round and gives a helpful hint', () => {
  const add = sample.rounds[1];
  const total = add.groups * add.size;
  let state = check(start(sample), rightPicture(sample.rounds[0]));
  state = check(state, total);
  assert.equal(state.round, 1);
  assert.equal(state.last.correct, false);
  assert.match(hint(add, total), /all the bugs/);

  const build = sample.rounds[2];
  assert.match(hint(build, { pads: build.groups + 1, bugs: build.size }), /Pads are the groups/);
  assert.match(hint(build, { pads: build.groups, bugs: build.size + 1 }), /bugs on each pad/);
});

test('the turned-around picture is wrong, and the hint says why', () => {
  const match = sample.rounds[0];
  const turned = match.pictures.findIndex((pads) => shows(pads, match.size, match.groups));
  assert.notEqual(turned, -1);
  assert.equal(isRight(match, turned), false);
  assert.match(hint(match, turned), new RegExp(`${match.size} groups of ${match.groups}`));
});
