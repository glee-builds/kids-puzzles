// Tests for src/games/garden-rows.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import { stageFor } from '../src/times.js';
import {
  generate, verify, start, check, hint, total, ROUNDS, SPLIT_AT, BIG_ROWS,
} from '../src/games/garden-rows.js';

const seedForDay = (key) => seedFor(key, 'garden-rows');
const sample = generate(seedForDay('2026-11-13'), 1);

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

test('the split round always has more than 5 rows to split', () => {
  everyDay((key) => {
    const split = generate(seedForDay(key), 3).rounds[2];
    assert.ok(split.rows > SPLIT_AT && split.rows <= BIG_ROWS[1]);
  });
});

test('the harder facts show up once the 6s to 9s start', () => {
  const sizes = new Set();
  everyDay((key) => { for (const r of generate(seedForDay(key), 3).rounds) sizes.add(r.size); }, 60);
  for (const n of [6, 7, 8, 9]) assert.ok(sizes.has(n), `${n}s`);
});

test('the same day and stage always make the same rounds', () => {
  assert.deepEqual(generate(seedForDay('2026-11-13'), 1), sample);
});

test('verify catches a missing right answer', () => {
  const broken = structuredClone(sample);
  broken.rounds[0].choices = [1, 2, 3];
  assert.equal(verify(broken).ok, false);
});

test('the right totals win all 3 rounds; a miss stays put', () => {
  let state = start(sample);
  state = check(state, total(sample.rounds[0]) + 1);
  assert.equal(state.round, 0);
  assert.equal(state.last.correct, false);
  for (const round of sample.rounds) state = check(state, total(round));
  assert.equal(state.status, 'won');
  assert.equal(state.round, ROUNDS.length);
});

test('hints point at the rows, the turn, or the two parts', () => {
  const [add, turn, split] = sample.rounds;
  assert.match(hint(add, total(add) - add.size), /Count the rows/);
  assert.match(hint(add, total(add) + add.size), /too many/);
  assert.match(hint(turn, 0), /Turning/);
  assert.match(hint(split, 0), new RegExp(`${SPLIT_AT * split.size} \\+ ${(split.rows - SPLIT_AT) * split.size}`));
});

// --- facts that come back ---

test('a small missed fact comes back in the first round, a big one in the split round', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key), 1, ['4x7', '8x6']);
    assert.ok(verify(puzzle).ok, `${key}: ${verify(puzzle).problems.join('; ')}`);
    assert.deepEqual([puzzle.rounds[0].rows, puzzle.rounds[0].size], [4, 7]);
    assert.deepEqual([puzzle.rounds[2].rows, puzzle.rounds[2].size], [8, 6]);
  }, 60);
});

// --- level 4: sharing ---

test('level 4 has a sharing round in the middle, every day for two years', () => {
  everyDay((key) => {
    const puzzle = generate(seedForDay(key), 4);
    assert.ok(verify(puzzle).ok, `${key}: ${verify(puzzle).problems.join('; ')}`);
    assert.deepEqual(puzzle.rounds.map((r) => r.kind), ['add', 'share', 'split']);
    const share = puzzle.rounds[1];
    assert.ok(share.choices.includes(share.size));
  });
});

test('sharing is answered with how many are in each row', () => {
  const puzzle = { stage: 2, level: 4, rounds: [
    { kind: 'add', rows: 2, size: 3, choices: [3, 6, 9] },
    { kind: 'share', rows: 3, size: 4, choices: [3, 4, 5] },
    { kind: 'split', rows: 7, size: 6, choices: [36, 42, 48] },
  ] };
  let state = check(start(puzzle), 6);
  state = check(state, 12); // all the seeds: not what sharing asks
  assert.equal(state.last.correct, false);
  assert.match(hint(puzzle.rounds[1], 12), /one row/);
  state = check(state, 4);
  assert.equal(state.round, 2);
});
