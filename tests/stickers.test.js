// Tests for src/stickers.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, STICKERS, nextSticker, stickerById } from '../src/stickers.js';

test('every page has 15 stickers, and no picture or name repeats', () => {
  for (const page of PAGES) assert.equal(page.stickers.length, 15, page.name);
  assert.equal(new Set(STICKERS.map((s) => s.picture)).size, STICKERS.length);
  assert.equal(new Set(STICKERS.map((s) => s.name)).size, STICKERS.length);
  assert.equal(new Set(STICKERS.map((s) => s.id)).size, STICKERS.length);
});

test('gifts never repeat until the book is full', () => {
  const owned = [];
  for (let i = 0; i < STICKERS.length; i++) {
    const sticker = nextSticker(owned);
    assert.ok(sticker && !owned.includes(sticker.id));
    owned.push(sticker.id);
  }
  assert.equal(nextSticker(owned), null);
});

test('the first gifts come from different pages', () => {
  const owned = [];
  for (let i = 0; i < 8; i++) owned.push(nextSticker(owned).id);
  assert.ok(new Set(owned.map((id) => stickerById(id).page)).size >= 4);
});
