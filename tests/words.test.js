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

const level2 = loadList('level-2.json');
const allLevel2Words = Object.values(level2.words).flat();

test('level 2 has a level number and some words', () => {
  assert.equal(level2.level, 2);
  assert.ok(allLevel2Words.length >= 50, `only ${allLevel2Words.length} words`);
});

test('every level 2 word is four lowercase letters', () => {
  for (const word of allLevel2Words) {
    assert.match(word, /^[a-z]{4}$/, `"${word}" is not four lowercase letters`);
  }
});

test('no level 2 word appears twice', () => {
  const seen = new Set();
  for (const word of allLevel2Words) {
    assert.ok(!seen.has(word), `"${word}" appears more than once`);
    seen.add(word);
  }
});

test('every level 2 word has exactly one vowel, filed under that vowel', () => {
  for (const [vowel, words] of Object.entries(level2.words)) {
    for (const word of words) {
      const vowelsInWord = [...word].filter((letter) => 'aeiou'.includes(letter));
      assert.deepEqual(vowelsInWord, [vowel], `"${word}" is filed under "${vowel}"`);
    }
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

const level3 = loadList('level-3.json');
const allLevel3Words = Object.values(level3.words).flat();

test('level 3 has a level number and plenty of words', () => {
  assert.equal(level3.level, 3);
  assert.ok(allLevel3Words.length >= 100, `only ${allLevel3Words.length} words`);
});

test('every level 3 word is five lowercase letters', () => {
  for (const word of allLevel3Words) {
    assert.match(word, /^[a-z]{5}$/, `"${word}" is not five lowercase letters`);
  }
});

test('no level 3 word appears twice', () => {
  const seen = new Set();
  for (const word of allLevel3Words) {
    assert.ok(!seen.has(word), `"${word}" appears more than once`);
    seen.add(word);
  }
});

test('every level 3 word has the spelling pattern of its group', () => {
  for (const [pattern, words] of Object.entries(level3.words)) {
    // "a_e" means a, one consonant, then a final e (plate). Others are letters in a row (ai, sh).
    const rule = pattern.includes('_')
      ? new RegExp(`${pattern[0]}[^aeiou]e$`)
      : new RegExp(pattern);
    for (const word of words) {
      assert.match(word, rule, `"${word}" is filed under "${pattern}"`);
    }
  }
});
