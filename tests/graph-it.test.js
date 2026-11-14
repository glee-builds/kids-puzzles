// Tests for src/games/graph-it.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import { generate, verify, start, check, hint, isRight, ROUNDS, MAX_TRIES } from '../src/games/graph-it.js';

const seedForDay = (key) => seedFor(key, 'graph-it');
const sample = generate(seedForDay('2026-11-14'));
const rightAnswer = (round) => (round.kind === 'build' ? round.values : round.kind === 'spot' ? [round.across, round.up] : round.answer);

test('every day for two years, at every level, makes 4 valid rounds', () => {
  for (const level of [1, 2, 3]) {
    everyDay((key) => {
      const puzzle = generate(seedForDay(key), level);
      const result = verify(puzzle);
      assert.ok(result.ok, `level ${level}, ${key}: ${result.problems.join('; ')}`);
      assert.deepEqual(puzzle.rounds.map((r) => r.kind), ROUNDS);
    });
  }
});

test('the same day and level always make the same rounds', () => {
  assert.deepEqual(generate(seedForDay('2026-11-14'), 1), sample);
});

test('level 1 reads one bar and states the numbers; level 2 has to be worked out', () => {
  everyDay((key) => {
    const [read, build] = generate(seedForDay(key), 1).rounds;
    assert.equal(read.graph, 'bars');
    assert.equal(read.asks, 'one');
    for (const value of build.values) assert.ok(build.story.includes(String(value)));
    const worked = generate(seedForDay(key), 2).rounds[1];
    assert.match(worked.story, /more .* than/);
    assert.match(worked.story, /fewer .* than/);
    const [first, second, third] = worked.values;
    assert.ok(second > first && third < first && third >= 1);
  }, 60);
});

test('picture graphs come up from level 2, and their answers count by the key', () => {
  let pictures = 0;
  everyDay((key) => {
    const read = generate(seedForDay(key), 2).rounds[0];
    if (read.graph !== 'pictures') return;
    pictures++;
    assert.ok([2, 5].includes(read.each));
    assert.equal(read.answer % read.each, 0);
  }, 80);
  assert.ok(pictures > 20, `${pictures} of 80 days`);
});

test('the plant on the line graph never shrinks', () => {
  everyDay((key) => {
    for (const level of [1, 2, 3]) {
      const { values } = generate(seedForDay(key), level).rounds[2];
      for (let i = 1; i < values.length; i++) assert.ok(values[i] >= values[i - 1]);
    }
  }, 100);
});

test('answers: a number, the bars, or across then up', () => {
  const [read, build, line, spot] = sample.rounds;
  assert.equal(isRight(read, read.answer), true);
  assert.equal(isRight(build, build.values), true);
  assert.equal(isRight(build, [...build.values].reverse()), false);
  assert.equal(isRight(line, line.answer), true);
  assert.equal(isRight(spot, [spot.across, spot.up]), true);
  assert.equal(isRight(spot, [spot.up, spot.across]), false); // across comes first
  assert.match(hint(spot, [spot.up, spot.across]), /Go across first/);
  assert.match(hint(build, build.values.map((n, i) => (i === 1 ? n + 1 : n))), new RegExp(`Look at the ${build.names[1]}\\.`));
});

test('the right answers win; three misses at building the graph show it', () => {
  let state = start(sample);
  for (const round of sample.rounds) state = check(state, rightAnswer(round));
  assert.equal(state.status, 'won');
  assert.deepEqual(state.shown, []);

  state = check(start(sample), rightAnswer(sample.rounds[0]));
  for (let i = 0; i < MAX_TRIES; i++) state = check(state, [0, 0, 0]);
  assert.equal(state.last.shown, true);
  assert.equal(state.round, 2);
});
