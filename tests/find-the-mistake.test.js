// Tests for src/games/find-the-mistake.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, seedFor } from '../src/seed.js';
import {
  generate, verify, start, check, next, hint, lines, questionAnswer, current,
  PROBLEMS, MAX_TRIES, ORDER,
} from '../src/games/find-the-mistake.js';

const seedForDay = (key) => seedFor(key, 'find-the-mistake');
const dayKey = (day) => dateKey(new Date(2026, 10, 1 + day));

// 34 + 28 with the ones step wrong: 4 + 8 = 11, so the answer shows 61.
const fixed = {
  problems: [
    { kind: 'addTensOnes', question: [34, '+', 28], steps: [[30, '+', 20], [4, '+', 8], [{ step: 0 }, '+', { step: 1 }]], mistake: 1, delta: -1 },
    { kind: 'makeTen', question: [8, '+', 7], steps: [[8, '+', 2], [7, '−', 2], [{ step: 0 }, '+', { step: 1 }]], mistake: 0, delta: 1 },
    { kind: 'hopTens', question: [46, '+', 20], steps: [[46, '+', 10], [{ step: 0 }, '+', 10]], mistake: 1, delta: 1 },
    { kind: 'subtractTensOnes', question: [75, '−', 32], steps: [[70, '−', 30], [5, '−', 2], [{ step: 0 }, '+', { step: 1 }]], mistake: 0, delta: 10 },
  ],
};

// --- the steps ---

test('a mistake carries forward into the later steps', () => {
  const shown = lines(fixed.problems[0]);
  assert.deepEqual(shown.map((l) => l.result), [50, 11, 61]);
  assert.deepEqual(lines(fixed.problems[0], true).map((l) => l.result), [50, 12, 62]);
  assert.equal(questionAnswer(fixed.problems[0]), 62);
});

test('the fixed example is valid', () => {
  const result = verify(fixed);
  assert.ok(result.ok, result.problems.join('; '));
});

test('verify catches a problem with no mistake', () => {
  const noMistake = { problems: fixed.problems.map((p, i) => (i === 0 ? { ...p, delta: 0 } : p)) };
  assert.equal(verify(noMistake).ok, false);
});

// --- generate ---

test('generate gives the same problems for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08')), generate(seedForDay('2026-11-08')));
});

test('every day for two years has exactly one mistake per problem, numbers 0 to 100', () => {
  for (let day = 0; day < 730; day++) {
    const puzzle = generate(seedForDay(dayKey(day)));
    const result = verify(puzzle);
    assert.ok(result.ok, `${dayKey(day)}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.problems.length, PROBLEMS);
    assert.deepEqual(puzzle.problems.map((p) => p.kind), ORDER);
  }
});

test('mistakes land on every step, not always the last one', () => {
  const places = new Set();
  for (let day = 0; day < 60; day++) {
    for (const p of generate(seedForDay(dayKey(day))).problems) places.add(`${p.kind}:${p.mistake}`);
  }
  assert.ok(places.has('addTensOnes:0') && places.has('addTensOnes:1') && places.has('addTensOnes:2'));
});

test('different days give different problems', () => {
  const days = new Set();
  for (let day = 0; day < 30; day++) days.add(JSON.stringify(generate(seedForDay(dayKey(day)))));
  assert.equal(days.size, 30);
});

// --- playing ---

test('tapping a right step marks it checked; tapping the mistake moves to fixing', () => {
  let state = start(fixed);
  state = check(state, { pick: 0 });
  assert.equal(state.last.correct, false);
  assert.deepEqual(state.checked, [0]);
  assert.equal(state.phase, 'find');
  assert.match(hint(state), /right ✓/);

  state = check(state, { pick: 1 });
  assert.equal(state.last.correct, true);
  assert.equal(state.phase, 'fix');
});

test('typing the right number fixes the step', () => {
  let state = check(start(fixed), { pick: 1 });
  state = check(state, { fix: 12 });
  assert.equal(state.phase, 'fixed');
  assert.equal(state.revealed, false);
});

test('hints get stronger, and the fix fills itself in after 3 misses', () => {
  let state = check(start(fixed), { pick: 1 });
  assert.equal(hint(state), 'What is 4 + 8?');
  state = check(state, { fix: 11 });
  assert.equal(hint(state), 'Count on 8 from 4.');
  for (let i = 1; i < MAX_TRIES; i++) state = check(state, { fix: 99 });
  assert.equal(state.phase, 'fixed');
  assert.equal(state.revealed, true);
});

test('a tens step hints in tens', () => {
  const state = check(check({ ...start(fixed), index: 3 }, { pick: 0 }), { fix: 50 });
  assert.equal(hint(state), 'Think in tens: 7 tens − 3 tens.');
});

test('can\'t fix before finding, or move on before fixing', () => {
  assert.throws(() => check(start(fixed), { fix: 12 }));
  assert.throws(() => next(start(fixed)));
});

test('fixing all four problems wins', () => {
  let state = start(fixed);
  for (let i = 0; i < PROBLEMS; i++) {
    const problem = current(state);
    state = check(state, { pick: problem.mistake });
    state = check(state, { fix: lines(problem, true)[problem.mistake].answer });
    state = next(state);
  }
  assert.equal(state.status, 'won');
});
