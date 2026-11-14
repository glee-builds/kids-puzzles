// Tests for src/games/math-mix-ups.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedFor } from '../src/seed.js';
import { everyDay } from './helpers.js';
import { generate, verify, start, check, hint, kindsForDay, KINDS, HEATS } from '../src/games/math-mix-ups.js';

const seedForDay = (key) => seedFor(key, 'math-mix-ups');
const sample = generate(seedForDay('2026-11-14'), 1, 0);

/** Every round of one kind over `days` days at a level (1 mild, 2 spicy). */
function roundsOf(kind, level, days = 400) {
  const found = [];
  let day = 0;
  everyDay((key) => {
    found.push(...generate(seedForDay(key), level, day).rounds.filter((round) => round.kind === kind));
    day += 1;
  }, days);
  return found;
}

test('every day for two years, mild and spicy, makes 3 valid rounds', () => {
  for (const level of [1, 2]) {
    let day = 0;
    everyDay((key) => {
      const puzzle = generate(seedForDay(key), level, day);
      const result = verify(puzzle);
      assert.ok(result.ok, `${HEATS[level - 1]}, ${key}: ${result.problems.join('; ')}`);
      assert.deepEqual(puzzle.rounds.map((r) => r.kind), kindsForDay(day));
      day += 1;
    });
  }
});

test('the same day and level always make the same rounds', () => {
  assert.deepEqual(generate(seedForDay('2026-11-14'), 1, 0), sample);
});

test('each day has 3 different kinds, and all 8 kinds come around within 3 days', () => {
  for (let day = 0; day < 40; day++) {
    assert.equal(new Set(kindsForDay(day)).size, 3);
    const seen = new Set([day, day + 1, day + 2].flatMap((d) => kindsForDay(d)));
    assert.equal(seen.size, KINDS.length, `days ${day} to ${day + 2}`);
  }
});

test('there are two heats, and a level above 2 is still spicy', () => {
  assert.equal(generate(1, 1, 0).heat, 'Mild');
  assert.equal(generate(1, 2, 0).heat, 'Spicy');
  assert.deepEqual(generate(1, 5, 0), generate(1, 2, 0));
});

test('the sums stay small: times facts to 9 × 9, everything else below 100', () => {
  for (const level of [1, 2]) {
    for (const kind of KINDS) {
      for (const round of roundsOf(kind, level, 200)) {
        assert.ok(round.answer <= 99 && Math.max(...round.choices) <= 99, `${kind}: ${round.answer}`);
      }
    }
  }
  for (const round of roundsOf('missing', 2).filter((r) => r.sentence.includes('×'))) {
    const [a, product] = round.sentence.match(/\d+/g).map(Number);
    assert.ok(a <= 9 && round.answer <= 9 && product <= 81, round.sentence);
  }
});

test('mild rounds take one step', () => {
  for (const round of roundsOf('shapes', 1)) assert.equal(round.lines.length, 2);
  for (const round of roundsOf('scale', 1)) assert.equal(round.extra, 0);
  for (const round of roundsOf('machine', 1)) { assert.equal(round.backwards, false); assert.match(round.rule, /^(add|take away) \d$/); }
  for (const round of roundsOf('missing', 1)) assert.match(round.sentence, /^\d \+ □ = \d+$/);
  for (const round of roundsOf('equal', 1)) assert.match(round.sentence, /^\d \+ \d = \d+ \+ □$/);
  for (const round of roundsOf('area', 1)) { assert.equal(round.cut, null); assert.equal(round.around, false); }
  for (const round of roundsOf('sides', 1)) assert.equal(round.backwards, false);
});

test('spicy rounds bring harder thinking, in more than one form each', () => {
  const forms = (kind, name) => new Set(roundsOf(kind, 2).map(name));
  assert.deepEqual([...forms('shapes', (r) => r.ask)].sort(), ['square', 'triangle']);
  for (const round of roundsOf('scale', 2)) assert.ok(round.extra >= 1);
  assert.deepEqual([...forms('machine', (r) => (r.backwards ? 'backwards' : r.rule.replace(/\d+$/, 'N')))].sort(), ['backwards', 'double it, then add N', 'times N']);
  assert.equal(forms('pattern', (r) => r.why).size >= 3, true);
  assert.deepEqual([...forms('missing', (r) => r.sentence.replace(/\d+/g, 'N'))].sort(), ['N × □ = N', 'N − □ = N', '□ − N = N']);
  assert.deepEqual([...forms('equal', (r) => r.sentence.replace(/\d+/g, 'N'))].sort(), ['N + N = N + □', 'N × N = N × □']);
  assert.deepEqual([...forms('area', (r) => (r.around ? 'around' : r.cut ? 'L' : 'rectangle'))].sort(), ['L', 'around']);
  assert.deepEqual([...forms('sides', (r) => r.backwards)].sort(), [false, true]);
});

test('a spicy scale has the same answer once the extra squares come off both sides', () => {
  for (const round of roundsOf('scale', 2)) {
    assert.equal((round.right - round.extra) / round.left, round.answer);
    assert.notEqual(round.answer, round.right);
  }
});

test('the right answers win; a miss stays put and hints get stronger', () => {
  let state = start(sample);
  const first = sample.rounds[0];
  const wrong = first.choices.find((n) => n !== first.answer);
  state = check(state, wrong);
  assert.equal(state.round, 0);
  assert.equal(state.tries, 1);
  assert.equal(hint(first, 1), first.hints[0]);
  assert.equal(hint(first, 2), first.hints[1]);
  for (const round of sample.rounds) state = check(state, round.answer);
  assert.equal(state.status, 'won');
  assert.throws(() => check(state, 1));
});

test('verify catches a wrong answer and a number that is too big', () => {
  const broken = structuredClone(sample);
  broken.rounds[0].choices = [1, 2, 300];
  assert.equal(verify(broken).ok, false);
  assert.equal(verify({ rounds: sample.rounds.slice(0, 2) }).ok, false);
});
