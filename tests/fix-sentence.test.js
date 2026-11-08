// Tests for src/games/fix-sentence.js and data/fix-sentences.json.
// Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import {
  generate, verify, start, check, next, hint, current, itemProblems, sentencesForDay, fixedSentence,
  PER_DAY, FIND_TRIES,
} from '../src/games/fix-sentence.js';

const ITEMS = JSON.parse(readFileSync(new URL('../data/fix-sentences.json', import.meta.url), 'utf8')).sentences;
const seedForDay = (key) => seedFor(key, 'fix-sentence');

const ran = { sentence: 'Yesterday the robot run to the park.', wrong: 3, fix: 'ran', options: ['ran', 'runs', 'running'], why: 'It already happened, so it is ran.' };
const fixed = { items: [ran, ran, ran, ran].map((item, i) => ({ ...item, sentence: item.sentence.replace('park', ['park', 'pond', 'lake', 'zoo'][i]) })) };

// --- the sentence list ---

test('every sentence has one letters-only wrong word, a fix, 3 options, and a reason', () => {
  for (const item of ITEMS) assert.deepEqual(itemProblems(item), [], item.sentence);
});

test('the list has at least 40 different sentences', () => {
  assert.ok(ITEMS.length >= 40, `only ${ITEMS.length} sentences`);
  assert.equal(new Set(ITEMS.map((i) => i.sentence)).size, ITEMS.length);
});

test('itemProblems catches a fix that is not one of the options', () => {
  assert.notDeepEqual(itemProblems({ ...ran, options: ['runs', 'running', 'runner'] }), []);
});

test('fixedSentence puts the fix in place', () => {
  assert.equal(fixedSentence(ran), 'Yesterday the robot ran to the park.');
});

// --- dealing sentences ---

test('no sentence repeats until the whole list has been used', () => {
  const seen = new Set();
  for (let day = 0; day < Math.floor(ITEMS.length / PER_DAY); day++) {
    for (const { sentence } of sentencesForDay(ITEMS, day)) {
      assert.ok(!seen.has(sentence), `"${sentence}" came back on day ${day}`);
      seen.add(sentence);
    }
  }
});

test('every day for two years is valid', () => {
  everyDay((key, day) => {
    const result = verify(generate(seedForDay(key), ITEMS, day));
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
  });
});

// --- playing ---

test('tapping a fine word marks it; tapping the wrong word moves to fixing', () => {
  let state = start(fixed);
  state = check(state, { tap: 0 });
  assert.equal(state.last.correct, false);
  assert.deepEqual(state.fine, [0]);
  assert.match(hint(state), /fine ✓/);
  state = check(state, { tap: 3 });
  assert.equal(state.phase, 'fix');
});

test(`the wrong word is shown after ${FIND_TRIES} wrong taps`, () => {
  let state = start(fixed);
  for (let i = 0; i < FIND_TRIES; i++) state = check(state, { tap: i });
  assert.equal(state.phase, 'fix');
  assert.equal(state.shown, true);
});

test('a wrong pick is crossed off; the right one fixes the sentence', () => {
  let state = check(start(fixed), { tap: 3 });
  state = check(state, { pick: 'runs' });
  assert.deepEqual(state.tried, ['runs']);
  assert.throws(() => check(state, { pick: 'runs' }), /not a choice/);
  state = check(state, { pick: 'ran' });
  assert.equal(state.phase, 'fixed');
});

test('can\'t pick before finding, or move on before fixing', () => {
  assert.throws(() => check(start(fixed), { pick: 'ran' }));
  assert.throws(() => next(start(fixed)));
});

test('fixing all four wins', () => {
  let state = start(fixed);
  for (let i = 0; i < PER_DAY; i++) {
    const item = current(state);
    state = next(check(check(state, { tap: item.wrong }), { pick: item.fix }));
  }
  assert.equal(state.status, 'won');
});
