// helpers.js: small helpers the test files share. (Not a test file itself:
// node --test only runs files named *.test.js.)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateKey } from '../src/seed.js';

/** The date key ("2026-11-03") for `day` days after 2026-11-01. */
export const dayKey = (day) => dateKey(new Date(2026, 10, 1 + day));

/** Run `check(key, day)` for every day of two years, starting 2026-11-01. */
export function everyDay(check, days = 730) {
  for (let day = 0; day < days; day++) check(dayKey(day), day);
}

/** Read a JSON file from data/, for example loadData('words/level-1.json'). */
export const loadData = (path) => JSON.parse(readFileSync(new URL(`../data/${path}`, import.meta.url), 'utf8'));

/** Fail with verify's problems, labelled, unless the puzzle is valid. */
export function assertValid({ ok, problems }, label) {
  assert.ok(ok, `${label}: ${problems.join('; ')}`);
}
