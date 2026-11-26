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
  assert.equal(nextSticker(owned).tier, 'shiny'); // a full book: shiny copies come next
});

test('with a full book, each sticker comes once more as a shiny copy, then once as a rainbow copy, then nothing', () => {
  const owned = STICKERS.map((s) => s.id);
  const copies = { shiny: [], rainbow: [] };
  for (const tier of ['shiny', 'rainbow']) {
    for (let i = 0; i < STICKERS.length; i++) {
      const sticker = nextSticker(owned, copies);
      assert.equal(sticker.tier, tier);
      assert.ok(owned.includes(sticker.id) && !copies[tier].includes(sticker.id));
      copies[tier].push(sticker.id);
    }
  }
  assert.equal(nextSticker(owned, copies), null);
  assert.equal(nextSticker(owned.slice(1), copies).tier, undefined); // a sticker still missing comes first
  assert.equal(nextSticker(owned, { shiny: copies.shiny }).tier, 'rainbow'); // saved before rainbow existed
});

test('the first gifts come from different pages', () => {
  const owned = [];
  for (let i = 0; i < 8; i++) owned.push(nextSticker(owned).id);
  assert.ok(new Set(owned.map((id) => stickerById(id).page)).size >= 4);
});

test('the first 16 pages never change, so the stickers a player already has stay theirs', () => {
  // A sticker is saved by its page and place. New pages go at the end.
  assert.equal(PAGES.slice(0, 8).map((page) => page.stickers.map(([picture]) => picture).join('')).join(' '),
    '🐸🦆🐢🐟🦢🐌🦎🌸🌾🦦🐿️🦝🐊🦩🌿 🐶🐱🐰🦊🐻🐼🐨🦁🐯🐘🦒🦓🐵🦘🦔 🐳🐬🦈🐙🦀🦞🐠🐡🦑🐚🦐🐧🐋⚓⛵ 🦋🐝🐞🐛🐜🦗🕷️🦉🦜🦅🐦🦚🐥🥚🐓 '
    + '🍎🍌🍓🍉🍇🍊🍍🥕🌽🍕🥞🧁🍪🍦🥨 ☀️🌙⭐🌈☁️⚡❄️🌍🪐🚀🛰️☄️🔭🌋🌊 🚲🛴🚗🚌🚂🚜🚒🚁✈️🎈🛶🚤🛷🚠🛹 ⚽🏀🪁🎨🎸🥁🎺🧩🪀🎲🧸🎪🏰👑🏆');
  assert.equal(PAGES.slice(8, 16).map((page) => page.stickers.map(([picture]) => picture).join('')).join(' '),
    '🐮🐷🐑🐐🐴🦃🐭🦙🐂🐔🥛🧀🍯🍞🧺 🦕🦖🐉🦄🧚🧜🧙🧞🦇🐍🗝️💎🔮🛡️🧪 🌷🌹🌺🌼🌻🌳🌲🌴🌵🍀🍁🍂🍄🌱💐 🔨🔧🧰✂️🖍️✏️📏🧵🧶🧲🔦💡🧱📎🖌️ ⚾🏈🎾🏐🏓🏸🥅⛳🎳🥋⛸️🎿🏹🥇🎯 🍩🍰🎂🍫🍬🍭🍿🥧🧇🌮🍔🍟🥪🍝🍒 🎉🎁🎀🎊🎃⛄🎆🎇🕯️🎭🎟️🎠🎡🎢🎩 🏔️🏝️🏜️🏕️🏠🏫🗼🗽🌉⛲🧭🗺️🎒🧳🏖️');
  assert.equal(stickerById('0-0').name, 'frog');
  assert.equal(stickerById('7-14').name, 'trophy');
});

test('a player with every sticker from the first 16 pages gets new ones from the newer pages', () => {
  const owned = STICKERS.filter((s) => s.page < 16).map((s) => s.id);
  const next = nextSticker(owned);
  assert.ok(next && next.page >= 16 && !next.tier);
});
