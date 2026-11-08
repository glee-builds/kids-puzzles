// Tests for src/games/word-problems.js and data/word-problems.json.
// Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateKey, seedFor } from '../src/seed.js';
import {
  generate, verify, start, check, next, hint, current, pieces, worked, answerFor, textProblems,
  KINDS, PER_DAY, MAX_TRIES, PICK_TRIES,
} from '../src/games/word-problems.js';

const ITEMS = JSON.parse(readFileSync(new URL('../data/word-problems.json', import.meta.url), 'utf8')).problems;
const seedForDay = (key) => seedFor(key, 'word-problems');
const dayKey = (day) => dateKey(new Date(2026, 10, 1 + day));

const fixed = {
  problems: [
    { kind: 'extra-sub', text: 'A pond had {a} frogs and {c} lily pads. Then {b} frogs hopped away. How many frogs are still in the pond?', numbers: { a: 42, b: 15, c: 7 } },
    { kind: 'two-add-sub', text: 'Robo had {a} bolts. Robo found {b} more. Then Robo used {c} bolts to fix a wheel. How many bolts does Robo have now?', numbers: { a: 23, b: 15, c: 8 } },
    { kind: 'two-sub-sub', text: 'A farmer had {a} eggs. The farmer sold {b} eggs and cooked {c} eggs. How many eggs are left?', numbers: { a: 50, b: 12, c: 9 } },
  ],
};

// --- the story bank ---

test('every story has {a}, {b}, {c} once each and ends with a question', () => {
  for (const item of ITEMS) assert.deepEqual(textProblems(item), [], item.text);
});

test('the bank has at least 5 stories of every kind, and no repeats', () => {
  for (const kind of Object.keys(KINDS)) {
    assert.ok(ITEMS.filter((i) => i.kind === kind).length >= 5, kind);
  }
  assert.equal(new Set(ITEMS.map((i) => i.text)).size, ITEMS.length);
});

test('textProblems catches a number written into the text', () => {
  assert.notDeepEqual(textProblems({ kind: 'extra-add', text: 'A has {a} and {b} and {c} and 3 more?' }), []);
});

// --- generate ---

test('generate gives the same problems for the same day', () => {
  assert.deepEqual(generate(seedForDay('2026-11-08'), ITEMS), generate(seedForDay('2026-11-08'), ITEMS));
});

test('every day for two years: 3 valid problems, extra first, two-step second', () => {
  for (let day = 0; day < 730; day++) {
    const puzzle = generate(seedForDay(dayKey(day)), ITEMS);
    const result = verify(puzzle);
    assert.ok(result.ok, `${dayKey(day)}: ${result.problems.join('; ')}`);
    assert.equal(puzzle.problems.length, PER_DAY);
    assert.ok(puzzle.problems[0].kind.startsWith('extra'));
    assert.ok(puzzle.problems[1].kind.startsWith('two'));
    assert.equal(new Set(puzzle.problems.map((p) => p.text)).size, PER_DAY, 'a story repeated in one day');
  }
});

test('verify catches an answer below 1', () => {
  const bad = { problems: [{ ...fixed.problems[0], numbers: { a: 10, b: 10, c: 7 } }, ...fixed.problems.slice(1)] };
  assert.equal(verify(bad).ok, false);
});

// --- the story and answers ---

test('pieces split the story into text and numbers', () => {
  const parts = pieces(fixed.problems[0]);
  assert.equal(parts[0], 'A pond had ');
  assert.deepEqual(parts[1], { slot: 'a', value: 42 });
  assert.equal(parts.filter((p) => typeof p !== 'string').length, 3);
});

test('answers and worked number sentences', () => {
  assert.equal(answerFor(fixed.problems[0]), 27);
  assert.equal(worked(fixed.problems[1]), '23 + 15 − 8 = 30');
  assert.equal(worked(fixed.problems[2]), '50 − 12 − 9 = 29');
});

// --- playing ---

test('an extra-number problem: tap the extra number, then answer', () => {
  let state = start(fixed);
  assert.equal(state.phase, 'pick');
  state = check(state, { pick: 'a' });
  assert.equal(state.last.correct, false);
  assert.deepEqual(state.tapped, ['a']);
  state = check(state, { pick: 'c' });
  assert.equal(state.phase, 'answer');
  state = check(state, { answer: 27 });
  assert.equal(state.phase, 'done');
});

test(`the extra number is shown after ${PICK_TRIES} wrong taps`, () => {
  let state = start(fixed);
  for (let i = 0; i < PICK_TRIES; i++) state = check(state, { pick: i === 0 ? 'a' : 'b' });
  assert.equal(state.phase, 'answer');
  assert.equal(state.last.shown, true);
});

test('two-step hints: first the first step, then the number sentences', () => {
  let state = start(fixed, 1);
  assert.equal(state.phase, 'answer');
  state = check(state, { answer: 38 });
  assert.equal(hint(state), 'Two steps! First work out 23 + 15.');
  state = check(state, { answer: 40 });
  assert.equal(hint(state), '23 + 15 = 38. Now 38 − 8 = ?');
  state = check(state, { answer: 31 });
  assert.equal(state.misses, MAX_TRIES);
  assert.equal(state.revealed, true);
  assert.equal(state.phase, 'done');
});

test('a take-away two-step hint uses minus first', () => {
  const state = check(start(fixed, 2), { answer: 1 });
  assert.equal(hint(state), 'Two steps! First work out 50 − 12.');
});

test('can\'t answer before picking, or move on before answering', () => {
  assert.throws(() => check(start(fixed), { answer: 27 }));
  assert.throws(() => next(start(fixed)));
});

test('answering all three wins', () => {
  let state = start(fixed);
  for (let i = 0; i < PER_DAY; i++) {
    const problem = current(state);
    if (state.phase === 'pick') state = check(state, { pick: KINDS[problem.kind].extra });
    state = check(state, { answer: answerFor(problem) });
    state = next(state);
  }
  assert.equal(state.status, 'won');
});
