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
const sample = generate(seedForDay('2026-11-13'), 1);
const rightPicture = (round) => round.pictures.findIndex((pads) => shows(pads, round.groups, round.size));
const rightAnswers = (puzzle) => [
  rightPicture(puzzle.rounds[0]),
  puzzle.rounds[1].groups,
  { pads: puzzle.rounds[2].groups, bugs: puzzle.rounds[2].size },
];

// --- times.js ---

test('levels 1 to 3 pick stages 0 to 2, and anything else is kept in range', () => {
  assert.equal(stageFor(1), 0);
  assert.equal(stageFor(2), 1);
  assert.equal(stageFor(3), 2);
  assert.equal(stageFor(9), 2);
  assert.equal(stageFor(), 0);
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

test('every day for two years, at every level, makes valid rounds', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seedForDay(key), level);
      const result = verify(puzzle);
      assert.ok(result.ok, `${key}, level ${level}: ${result.problems.join('; ')}`);
      assert.equal(puzzle.stage, stageFor(level));
    });
  }
});

test('the same day and stage always make the same rounds', () => {
  assert.deepEqual(generate(seedForDay('2026-11-13'), 1), sample);
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

// --- facts that come back ---

test('missed facts come back in the add and build rounds, even from another level', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key), 1, ['4x7', '3x9']);
    assert.ok(verify(puzzle).ok, `${key}: ${verify(puzzle).problems.join('; ')}`);
    assert.deepEqual([puzzle.rounds[1].groups, puzzle.rounds[1].size], [4, 7]);
    assert.deepEqual([puzzle.rounds[2].groups, puzzle.rounds[2].size], [3, 9]);
  }, 60);
});

test('facts that do not fit the lily pads are ignored', () => {
  assert.deepEqual(generate(seedForDay('2026-11-13'), 1, ['9x9', '8x3', 'junk']), sample);
});

// --- level 4: quick recall ---

test('level 4 asks two facts from memory, then a build, every day for two years', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key), 4);
    assert.ok(verify(puzzle).ok, `${key}: ${verify(puzzle).problems.join('; ')}`);
    assert.deepEqual(puzzle.rounds.map((r) => r.kind), ['recall', 'recall', 'build']);
    assert.equal(puzzle.stage, 2); // the hardest facts
  });
});

test('recall: the product is right, and a miss gets skip-counting as a hint', () => {
  const round = { kind: 'recall', groups: 4, size: 3, choices: [9, 12, 15] };
  assert.equal(isRight(round, 12), true);
  assert.equal(isRight(round, 9), false);
  assert.match(hint(round, 9), /Count by 3s: 3, 6, 9, …/);
});
