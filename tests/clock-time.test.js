// Tests for src/games/clock-time.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import { generate, verify, start, check, hint, timeText, CLOCKS, MINUTES } from '../src/games/clock-time.js';

const seedForDay = (key) => seedFor(key, 'clock-time');
const sample = generate(seedForDay('2026-11-13'));

test('timeText writes minutes with two digits', () => {
  assert.equal(timeText(3, 0), '3:00');
  assert.equal(timeText(12, 5), '12:05');
});

test('every day for two years, at every level, makes 5 valid clocks', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seedForDay(key), level);
      const result = verify(puzzle);
      assert.ok(result.ok, `level ${level}, ${key}: ${result.problems.join('; ')}`);
      for (const { minute } of puzzle.rounds) assert.ok(MINUTES[level - 1].includes(minute));
    });
  }
});

test('the same day and level always make the same clocks', () => {
  assert.deepEqual(generate(seedForDay('2026-11-13'), 1), sample);
});

test('one wrong choice is the time with the hands mixed up, when that is a different time', () => {
  let mixed = 0;
  everyDay((key) => {
    for (const { hour, minute, choices } of generate(seedForDay(key), 3).rounds) {
      const swapped = timeText(minute === 0 ? 12 : minute / 5, (hour % 12) * 5);
      if (swapped !== timeText(hour, minute)) { assert.ok(choices.includes(swapped)); mixed++; }
    }
  }, 60);
  assert.ok(mixed > 200);
});

test('the right times win; a miss stays put and the hint names the hand', () => {
  let state = start(sample);
  const first = sample.rounds[0];
  const wrongHour = timeText((first.hour % 12) + 1, first.minute);
  state = check(state, wrongHour);
  assert.equal(state.round, 0);
  assert.match(hint(first, wrongHour), /short hand shows the hour/);
  assert.match(hint({ hour: 3, minute: 30 }, '3:00'), /long hand shows the minutes/);
  for (const { hour, minute } of sample.rounds) state = check(state, timeText(hour, minute));
  assert.equal(state.status, 'won');
  assert.equal(state.round, CLOCKS);
});

test('verify catches a missing right answer', () => {
  const broken = structuredClone(sample);
  broken.rounds[0].choices = ['1:00', '2:00', '13:00'];
  assert.equal(verify(broken).ok, broken.rounds[0].choices.includes(timeText(broken.rounds[0].hour, broken.rounds[0].minute)));
});
