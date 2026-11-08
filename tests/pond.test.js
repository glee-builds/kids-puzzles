// Tests for src/pond.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pondPads, PADS_SHOWN } from '../src/pond.js';

const kinds = (pads) => pads.map((p) => p.kind).join(' ');

test('a new player: the frog on the bank, the first pad is next', () => {
  const pads = pondPads(0, false);
  assert.equal(pads.length, PADS_SHOWN);
  assert.equal(kinds(pads), 'frog next ahead ahead ahead ahead ahead');
});

test('after two days, with today still to play', () => {
  assert.equal(kinds(pondPads(2, false)), 'bank visited frog next ahead ahead ahead');
});

test('once today is done, no pad is marked next', () => {
  assert.equal(kinds(pondPads(2, true)), 'bank visited frog ahead ahead ahead ahead');
});

test('far along, the pond slides so the frog keeps 4 pads behind it', () => {
  const pads = pondPads(30, false);
  assert.equal(pads[0].number, 26);
  assert.equal(kinds(pads), 'visited visited visited visited frog next ahead');
});
