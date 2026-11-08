// Tests for src/games/story-order.js and data/stories.json. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateKey, seedFor } from '../src/seed.js';
import {
  generate, verify, start, check, hint, current, storiesForDay, storyProblems, STORIES_PER_DAY,
} from '../src/games/story-order.js';

const STORIES = JSON.parse(readFileSync(new URL('../data/stories.json', import.meta.url), 'utf8')).stories;
const seedForDay = (key) => seedFor(key, 'story-order');

const fixed = {
  items: [
    { title: 'Snow Day', sentences: ['A.', 'B.', 'C.', 'D.'], mixed: [2, 0, 3, 1] },
    { title: 'Sled Hill', sentences: ['E.', 'F.', 'G.', 'H.'], mixed: [1, 0, 2, 3] },
  ],
};

// --- the story bank ---

test('every story in the bank has a title and 4 short, tidy sentences', () => {
  assert.ok(STORIES.length >= 30, `only ${STORIES.length} stories`);
  for (const story of STORIES) {
    assert.deepEqual(storyProblems(story), [], story.title);
  }
});

test('no two stories share a title', () => {
  const titles = STORIES.map((s) => s.title);
  assert.equal(new Set(titles).size, titles.length);
});

// --- dealing stories ---

test('no story repeats until the whole bank has been used', () => {
  const days = Math.floor(STORIES.length / STORIES_PER_DAY);
  const seen = new Set();
  for (let day = 0; day < days; day++) {
    for (const story of storiesForDay(STORIES, day)) {
      assert.ok(!seen.has(story.title), `${story.title} came back on day ${day}`);
      seen.add(story.title);
    }
  }
});

test('every day for two years makes 2 valid, mixed-up stories', () => {
  for (let day = 0; day < 730; day++) {
    const key = dateKey(new Date(2026, 10, 1 + day));
    const result = verify(generate(seedForDay(key), STORIES, day));
    assert.ok(result.ok, `${key}: ${result.problems.join('; ')}`);
  }
});

test('verify catches a story already in order', () => {
  assert.equal(verify(fixed).ok, true);
  const inOrder = { items: [{ ...fixed.items[0], mixed: [0, 1, 2, 3] }, fixed.items[1]] };
  assert.equal(verify(inOrder).ok, false);
});

// --- check ---

test('check: the right order moves to the next story', () => {
  const state = check(start(fixed), [0, 1, 2, 3]);
  assert.equal(state.last.result, 'right');
  assert.equal(current(state).title, 'Sled Hill');
});

test('check: a wrong order locks the sentences in the right spot', () => {
  const state = check(start(fixed), [0, 2, 1, 3]);
  assert.equal(state.last.result, 'wrong');
  assert.deepEqual(state.last.marks, [true, false, false, true]);
  assert.deepEqual(state.locked, [true, false, false, true]);
});

test('check: an order must use each sentence once', () => {
  assert.throws(() => check(start(fixed), [0, 0, 1, 2]));
});

test('check: both stories in order wins', () => {
  const state = check(check(start(fixed), [0, 1, 2, 3]), [0, 1, 2, 3]);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, [0, 1, 2, 3]));
});

// --- hints ---

test('hint: locks the first open slot, then the next', () => {
  let state = check(start(fixed), [0, 2, 1, 3]); // slots 0 and 3 locked
  let result = hint(state);
  assert.equal(result.slot, 1);
  result = hint(result.state);
  assert.equal(result.slot, 2);
  assert.equal(hint(result.state).slot, null);
});
