// Tests for src/progress.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProgress, daysBetween, recordFinish, currentStreak, isFinished, load, save, STORAGE_KEY, KEEP_DAYS,
} from '../src/progress.js';

// A stand-in for the browser's localStorage, so tests run in Node.
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    data,
  };
}

test('daysBetween counts whole days, across months and years', () => {
  assert.equal(daysBetween('2026-11-08', '2026-11-09'), 1);
  assert.equal(daysBetween('2026-11-30', '2026-12-01'), 1);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-11-08', '2026-11-08'), 0);
});

test('the first finished puzzle starts a streak of 1', () => {
  const p = recordFinish(emptyProgress(), '2026-11-08', 'mystery-word');
  assert.equal(p.streak, 1);
  assert.equal(p.lastDay, '2026-11-08');
});

test('finishing again the same day does not count twice', () => {
  let p = recordFinish(emptyProgress(), '2026-11-08', 'mystery-word');
  p = recordFinish(p, '2026-11-08', 'mystery-word');
  p = recordFinish(p, '2026-11-08', 'another-game');
  assert.equal(p.streak, 1);
});

test('finishing on the next day adds one', () => {
  let p = recordFinish(emptyProgress(), '2026-11-08', 'mystery-word');
  p = recordFinish(p, '2026-11-09', 'mystery-word');
  p = recordFinish(p, '2026-11-10', 'mystery-word');
  assert.equal(p.streak, 3);
});

test('missing a day starts over at 1', () => {
  let p = recordFinish(emptyProgress(), '2026-11-08', 'mystery-word');
  p = recordFinish(p, '2026-11-09', 'mystery-word');
  p = recordFinish(p, '2026-11-11', 'mystery-word');
  assert.equal(p.streak, 1);
});

test('currentStreak still shows yesterday\'s streak before today is played', () => {
  let p = recordFinish(emptyProgress(), '2026-11-08', 'mystery-word');
  p = recordFinish(p, '2026-11-09', 'mystery-word');
  assert.equal(currentStreak(p, '2026-11-09'), 2);
  assert.equal(currentStreak(p, '2026-11-10'), 2);
  assert.equal(currentStreak(p, '2026-11-11'), 0);
  assert.equal(currentStreak(emptyProgress(), '2026-11-11'), 0);
});

test('isFinished knows which games are done on which day', () => {
  const p = recordFinish(emptyProgress(), '2026-11-08', 'mystery-word');
  assert.equal(isFinished(p, '2026-11-08', 'mystery-word'), true);
  assert.equal(isFinished(p, '2026-11-08', 'another-game'), false);
  assert.equal(isFinished(p, '2026-11-09', 'mystery-word'), false);
});

test('old days are dropped so saved data stays small', () => {
  let p = recordFinish(emptyProgress(), '2026-10-01', 'mystery-word');
  p = recordFinish(p, '2026-11-08', 'mystery-word');
  assert.deepEqual(Object.keys(p.finished), ['2026-11-08']);
});

test('save then load gives back the same progress', () => {
  const storage = fakeStorage();
  const p = recordFinish(emptyProgress(), '2026-11-08', 'mystery-word');
  save(p, storage);
  assert.deepEqual(load(storage), p);
});

test('load starts fresh when nothing is saved or the data is damaged', () => {
  assert.deepEqual(load(fakeStorage()), emptyProgress());
  assert.deepEqual(load(fakeStorage({ [STORAGE_KEY]: 'not json' })), emptyProgress());
  assert.deepEqual(load(fakeStorage({ [STORAGE_KEY]: '{"streak":"lots"}' })), emptyProgress());
});

test('save and load keep working when storage is blocked', () => {
  const blocked = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.doesNotThrow(() => save(emptyProgress(), blocked));
  assert.deepEqual(load(blocked), emptyProgress());
});

// --- total days (the lily pads) ---

test('totalDays counts every puzzle day and never goes down', () => {
  let p = recordFinish(emptyProgress(), '2026-11-08', 'maze');
  p = recordFinish(p, '2026-11-08', 'maze-again');
  p = recordFinish(p, '2026-11-09', 'maze');
  p = recordFinish(p, '2026-11-20', 'maze'); // a gap: the streak starts over, totalDays doesn't
  assert.equal(p.totalDays, 3);
  assert.equal(p.streak, 1);
});

test('progress saved before totalDays starts from the days in its history', () => {
  const old = { streak: 2, lastDay: '2026-11-08', finished: { '2026-11-07': ['maze'], '2026-11-08': ['maze'] } };
  assert.equal(load(fakeStorage({ [STORAGE_KEY]: JSON.stringify(old) })).totalDays, 2);
});

// --- for the grown-up page ---

test('plays counts each game once per day, ever', () => {
  let p = recordFinish(emptyProgress(), '2026-11-08', 'maze');
  p = recordFinish(p, '2026-11-08', 'maze');         // same day again: no change
  p = recordFinish(p, '2026-11-08', 'word-search');
  p = recordFinish(p, '2026-11-09', 'maze');
  assert.deepEqual(p.plays, { maze: 2, 'word-search': 1 });
});

test('the history keeps the last 4 weeks', () => {
  assert.equal(KEEP_DAYS, 28);
  let p = recordFinish(emptyProgress(), '2026-10-12', 'maze'); // 27 days before Nov 8
  p = recordFinish(p, '2026-11-08', 'maze');
  assert.deepEqual(Object.keys(p.finished), ['2026-10-12', '2026-11-08']);
  assert.equal(p.plays.maze, 2);
});

test('progress saved before plays existed counts them from its history', () => {
  const old = { streak: 2, totalDays: 2, lastDay: '2026-11-08', finished: { '2026-11-07': ['maze'], '2026-11-08': ['maze', 'word-search'] } };
  const p = load(fakeStorage({ [STORAGE_KEY]: JSON.stringify(old) }));
  assert.deepEqual(p.plays, { maze: 2, 'word-search': 1 });
});

// --- catching up on yesterday's puzzles ---

test('catching up after today joins the days back into one run', () => {
  let p = recordFinish(emptyProgress(), '2026-11-06', 'maze');
  p = recordFinish(p, '2026-11-07', 'maze');
  // 2026-11-08 is missed.
  p = recordFinish(p, '2026-11-09', 'maze');
  assert.equal(p.streak, 1);
  p = recordFinish(p, '2026-11-08', 'maze'); // yesterday's puzzle, played on the 9th
  assert.equal(p.streak, 4);
  assert.equal(p.totalDays, 4);
  assert.equal(p.lastDay, '2026-11-09');
  assert.equal(currentStreak(p, '2026-11-09'), 4);
});

test('catching up before today, then playing today', () => {
  let p = recordFinish(emptyProgress(), '2026-11-06', 'maze');
  p = recordFinish(p, '2026-11-07', 'maze');
  p = recordFinish(p, '2026-11-08', 'maze'); // missed on the 8th, played on the 9th
  assert.equal(p.streak, 3);
  p = recordFinish(p, '2026-11-09', 'maze');
  assert.equal(p.streak, 4);
  assert.equal(p.totalDays, 4);
});

test('catching up with no run before it makes 2 days in a row', () => {
  let p = recordFinish(emptyProgress(), '2026-11-01', 'maze');
  p = recordFinish(p, '2026-11-09', 'maze');
  p = recordFinish(p, '2026-11-08', 'maze');
  assert.equal(p.streak, 2);
  assert.equal(p.totalDays, 3);
});

test('more of yesterday\'s puzzles do not count the day twice', () => {
  let p = recordFinish(emptyProgress(), '2026-11-09', 'maze');
  p = recordFinish(p, '2026-11-08', 'maze');
  p = recordFinish(p, '2026-11-08', 'word-search');
  p = recordFinish(p, '2026-11-08', 'maze');
  assert.equal(p.totalDays, 2);
  assert.equal(p.streak, 2);
  assert.deepEqual(p.finished['2026-11-08'], ['maze', 'word-search']);
  assert.equal(p.lastDay, '2026-11-09');
});

test('progress saved before catching up existed still loads', () => {
  const old = { streak: 3, totalDays: 5, lastDay: '2026-11-07', finished: { '2026-11-07': ['maze'] }, plays: { maze: 5 } };
  const storage = { getItem: () => JSON.stringify(old) };
  let p = load(storage);
  assert.equal(p.previous, null);
  p = recordFinish(p, '2026-11-09', 'maze');
  p = recordFinish(p, '2026-11-08', 'maze');
  assert.equal(p.streak, 5); // 3 days up to the 7th, then the 8th and 9th
});
