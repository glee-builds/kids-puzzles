// sticker-book.js: how stickers and the sticker book are drawn.
//
// Which stickers there are, and which gift comes next, is in stickers.js.
// This file draws them: a sticker's picture (plain, shiny, or rainbow), the
// book's covers (a tile for each page), and one page of stickers.

import { make, button } from './ui.js';
import { PAGES, STICKERS } from './stickers.js';

// The mark beside each kind of copy, so it isn't told apart by color alone.
export const TIER_MARKS = { shiny: '✨', rainbow: '🌈' };

// How far each sticker in a row is turned, so they look stuck on by hand.
const TILTS = [-7, 4, -3, 6, -5, 3, -6, 5, -2, 7];

/**
 * A sticker's picture. A shiny one gets a gold edge (styles.css). A rainbow
 * one is drawn as a small SVG picture, so its edge can follow the sticker's
 * shape in rainbow colors: the shape is made 6 units fatter all round (and
 * its corners rounded off), filled with the colors, and the sticker is
 * drawn on top.
 */
export function stickerArt(picture, tier, extraClass = '') {
  const art = make('span', `${extraClass} sticker-art${tier ? ` sticker-${tier}` : ''}`.trim(), tier === 'rainbow' ? '' : picture);
  if (tier !== 'rainbow') return art;
  const color = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const stops = ['--go', '--star', '--pad', '--here', '--elsewhere', '--blush']
    .map((name, i, all) => `<stop offset="${i / (all.length - 1)}" stop-color="${color(name)}"/>`).join('');
  const text = `<text x="50" y="50" font-size="62" text-anchor="middle" dominant-baseline="central">${picture}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>
    <linearGradient id="colors" x1="0.15" y1="0.15" x2="0.85" y2="0.85">${stops}</linearGradient>
    <filter id="fatter" x="-30%" y="-30%" width="160%" height="160%"><feMorphology operator="dilate" radius="6"/><feGaussianBlur stdDeviation="1.5"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 9 -4"/></filter>
    <mask id="edge"><g filter="url(#fatter)">${text}</g></mask></defs>
    <rect width="100" height="100" fill="url(#colors)" mask="url(#edge)"/>${text}</svg>`;
  art.classList.add('rainbow-art');
  art.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return art;
}

/**
 * Draw the sticker book inside `area`, for the stickers in `progress`.
 * With no `page` it shows the covers; with a page number, that page.
 */
export function drawStickerBook(area, progress, page = null) {
  area.replaceChildren();
  const owned = progress.stickers;
  const { shiny, rainbow } = progress;
  const all = STICKERS.length;
  const newest = [rainbow, shiny, owned].find((list) => list.length)?.at(-1);
  // With a full book, gifts are shiny copies, then rainbow ones (see src/stickers.js).
  let count = `${owned.length} of ${all} stickers. Finish a puzzle to open a gift!`;
  if (owned.length === all) count = `Your sticker book is full! ✨ ${shiny.length} of ${all} are shiny. Finish a puzzle to make one shine!`;
  if (shiny.length === all) count = `✨ Every sticker is shiny! 🌈 ${rainbow.length} of ${all} are rainbow. Finish a puzzle for another!`;
  if (rainbow.length === all) count = '🌈 Every sticker is rainbow. Wow!';
  area.append(make('p', 'sb-count', count));
  const onPage = (p) => STICKERS.filter((s) => s.page === p);
  const haveOn = (p) => onPage(p).filter((s) => owned.includes(s.id)).length;
  const haveText = (p) => (haveOn(p) === onPage(p).length ? '★ All 15' : `${haveOn(p)} of ${onPage(p).length}`);
  const haveNode = (p) => make('span', `sb-have${haveOn(p) === onPage(p).length ? ' sb-have-all' : ''}`, haveText(p));

  // The covers: one tile for each page, so the book fits on a screen or two
  // however many pages it has. Tap a tile to open its page.
  if (page === null) {
    const covers = make('div', 'sb-covers');
    PAGES.forEach((page, p) => {
      const isNew = onPage(p).some((s) => s.id === newest);
      const cover = button(`sb-cover sb-album-${p % 8}${isNew ? ' sb-cover-new' : ''}`, '', () => {
        drawStickerBook(area, progress, p);
        window.scrollTo(0, 0);
      });
      // A taste of the page: its first 3 stickers (pale if not collected yet).
      const taste = make('span', 'sb-taste');
      for (const sticker of onPage(p).slice(0, 3)) {
        taste.append(make('span', `sticker-art${owned.includes(sticker.id) ? '' : ' sb-pale'}`, sticker.picture));
      }
      cover.append(make('span', 'sb-cover-name', page.name), taste, haveNode(p));
      cover.setAttribute('aria-label', `${page.name}: ${haveText(p)}${isNew ? ', with your newest sticker' : ''}`);
      covers.append(cover);
    });
    area.append(covers);
    return;
  }

  // One page of the album: a card in its own soft color, with the stickers
  // stuck on at slightly different angles.
  const p = page;
  area.append(button('lw-button sb-back', '← All pages', () => drawStickerBook(area, progress)));
  const album = make('section', `sb-album sb-album-${p % 8}`); // 8 page colors, used in turn
  const heading = make('h2', 'sb-page', PAGES[p].name);
  heading.append(haveNode(p));
  const grid = make('div', 'sb-grid');
  onPage(p).forEach((sticker, i) => {
    const got = owned.includes(sticker.id);
    const tier = rainbow.includes(sticker.id) ? 'rainbow' : shiny.includes(sticker.id) ? 'shiny' : '';
    const spot = make('span', 'sb-sticker' + (got ? '' : ' sb-empty') + (tier ? ` sb-${tier}` : '') + (sticker.id === newest ? ' sb-new' : ''));
    // A sticker not collected yet shows as a pale outline of what's coming.
    const art = stickerArt(sticker.picture, tier);
    art.style.setProperty('--tilt', `${TILTS[i % TILTS.length]}deg`);
    spot.append(art);
    spot.setAttribute('role', 'img');
    spot.setAttribute('aria-label', tier ? `${sticker.name}, ${tier}` : got ? sticker.name : 'A sticker you don\'t have yet');
    grid.append(spot);
  });
  album.append(heading, grid);
  area.append(album);
}
