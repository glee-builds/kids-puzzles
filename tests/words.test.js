// Checks for the word lists in data/words/. Run all tests with: node --test
//
// These catch typos when a list is edited by hand: a misspelled word,
// a capital letter, a duplicate, or a word filed under the wrong vowel.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function loadList(fileName) {
  const url = new URL(`../data/words/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

const level1 = loadList('level-1.json');
const allLevel1Words = Object.values(level1.words).flat();

test('level 1 has a level number and some words', () => {
  assert.equal(level1.level, 1);
  assert.ok(allLevel1Words.length >= 50, `only ${allLevel1Words.length} words`);
});

test('every level 1 word is three lowercase letters', () => {
  for (const word of allLevel1Words) {
    assert.match(word, /^[a-z]{3}$/, `"${word}" is not three lowercase letters`);
  }
});

test('no level 1 word appears twice', () => {
  const seen = new Set();
  for (const word of allLevel1Words) {
    assert.ok(!seen.has(word), `"${word}" appears more than once`);
    seen.add(word);
  }
});

test('every level 1 word is consonant, vowel, consonant, filed under its vowel', () => {
  const vowels = 'aeiou';
  for (const [vowel, words] of Object.entries(level1.words)) {
    assert.ok(vowels.includes(vowel), `"${vowel}" is not a vowel group`);
    for (const word of words) {
      const [first, middle, last] = word;
      assert.equal(middle, vowel, `"${word}" is filed under "${vowel}"`);
      assert.ok(!vowels.includes(first) && !vowels.includes(last), `"${word}" should start and end with a consonant`);
    }
  }
});
