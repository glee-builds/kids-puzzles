// app.js: the home screen, moving between screens, starting games,
// the streak, and the end-of-puzzle celebration.
//
// Each screen has its own address after the #, like #mystery-word.
// An empty address shows the home screen. Using the address means the
// phone's back gesture returns to the home screen too.

import { dateKey, seedFor, hashString } from './seed.js';
import * as progressStore from './progress.js';
import { pondPads } from './pond.js';
import { make, button } from './ui.js';
import { PAGES, STICKERS, nextSticker } from './stickers.js';
import { todaysSet, SET_SIZE } from './today.js';

const today = dateKey();
let progress = progressStore.load();

// Earlier days: the home screen has a row of the 7 days before today. Each
// opens ?day=2026-11-20 (for example), which plays that day's puzzles
// instead of today's. Finishing one fills in that day (see progress.js).
// ?day=yesterday works too. Older days aren't offered.
const now = new Date();
const PAST_DAYS = [1, 2, 3, 4, 5, 6, 7].map((ago) => dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago)));
const yesterday = PAST_DAYS[0];
const askedDay = new URLSearchParams(location.search).get('day');
const playDay = askedDay === 'yesterday' ? yesterday : PAST_DAYS.includes(askedDay) ? askedDay : today; // the day whose puzzles are shown
const playingPast = playDay !== today;
/** "yesterday", or the day of the week ("Thursday"). */
const dayName = (key, style = 'long') => (key === yesterday && style === 'long' ? 'yesterday' : new Date(`${key}T12:00`).toLocaleDateString('en-US', { weekday: style }));
const capital = (text) => text[0].toUpperCase() + text.slice(1);

// Games are started the first time they are opened, then kept, so
// leaving a game halfway and coming back keeps the guesses.
const started = new Set();

// ---------- The pond (streak) and card status ----------

// Set when the frog hops while the app is open, so the home screen can
// show the hop when the player comes back to it.
let justHopped = false;

function drawPond() {
  const at = progress.totalDays;
  const doneToday = progress.lastDay === today;
  const pond = document.getElementById('pond');
  pond.replaceChildren();
  for (const { number, kind } of pondPads(at, doneToday)) {
    const spot = make('span', `pad pad-${kind}`);
    if (kind === 'frog') {
      const frog = make('img', 'pond-frog' + (justHopped ? ' pond-frog-hop' : ''));
      frog.src = 'assets/frog.svg';
      frog.alt = '';
      spot.append(frog);
    }
    if (number > 0) spot.append(make('span', 'pad-number', String(number)));
    pond.append(spot);
  }
  justHopped = false;
  pond.setAttribute('aria-label', at === 0
    ? 'The frog is on the bank of the pond.'
    : `The frog is on lily pad ${at}.`);

  // The words under the pond: where the frog is, and days in a row.
  const days = progressStore.currentStreak(progress, today);
  let caption;
  if (at === 0) caption = 'Finish a puzzle and the frog hops onto a lily pad!';
  else if (!doneToday) caption = 'Finish a puzzle to hop to the next lily pad!';
  else caption = `The frog is on lily pad ${at}!`;
  if (playingPast && !progressStore.isFinished(progress, playDay)) {
    caption = `Finish one of ${dayName(playDay)}'s puzzles to fill in that day!`;
  }
  const captionNode = document.getElementById('pond-caption');
  captionNode.textContent = caption;
  if (days >= 2) captionNode.append(make('span', 'pond-streak', `★ ${days} days in a row`));
  drawCatchUp();
  drawPastDays();
  drawStickerLink();
  drawWeek();
}

/** The link between today's and yesterday's puzzles, when it's needed. */
function drawCatchUp() {
  const link = document.getElementById('catch-up');
  const missedYesterday = progress.totalDays > 0 && !progressStore.isFinished(progress, yesterday);
  link.hidden = !playingPast && !missedYesterday;
  if (playingPast) {
    link.textContent = '← Back to today\'s puzzles';
    link.href = './';
  } else {
    link.textContent = 'Missed yesterday? Play it now →';
    link.href = '?day=yesterday';
  }
}

/** The row of the last 7 days: tap one to play its puzzles. ✓ means a puzzle was finished that day. */
function drawPastDays() {
  const row = document.getElementById('past-days');
  row.replaceChildren(...PAST_DAYS.map((key) => {
    const day = make('a', 'past-day', dayName(key, 'short'));
    day.href = `?day=${key}`;
    day.setAttribute('aria-label', capital(dayName(key)));
    if (key === playDay) day.setAttribute('aria-current', 'page');
    if (progressStore.isFinished(progress, key)) day.append(make('span', 'past-day-done', '✓'));
    return day;
  }));
}

// ---------- Today's set ----------

/** The 5 puzzles picked for the day being played (see src/today.js). */
function todaysPuzzles() {
  return todaysSet(Object.fromEntries(GROUPS.map(({ kind }) => [kind, gamesIn(kind)])), DAY);
}

const isDone = (game) => progressStore.isFinished(progress, playDay, game);
/** The names of the puzzles in a group. */
const gamesIn = (kind) => Object.keys(GAMES).filter((name) => GAMES[name].kind === kind);
/** Whether a screen is one of the mazes (they share src/games/maze.js). */
const isMaze = (name) => (GAMES[name]?.file ?? name) === 'maze';

function drawToday() {
  const set = todaysPuzzles();
  const done = set.filter(isDone).length;
  const next = set.find((game) => !isDone(game));
  document.getElementById('today-title').textContent = `${capital(playingPast ? dayName(playDay) : 'today')}'s 5`;
  document.getElementById('today-count').textContent = done === SET_SIZE
    ? `★ All ${SET_SIZE} done! Great work.`
    : `${done} of ${SET_SIZE} done`;
  const list = document.getElementById('today-list');
  list.replaceChildren();
  set.forEach((game, i) => {
    const row = make('a', `today-row kind-${GAMES[game].kind}` + (isDone(game) ? ' today-done' : game === next ? ' today-next' : ''));
    row.href = `#${game}`;
    row.append(
      make('span', 'today-number', isDone(game) ? '✓' : String(i + 1)),
      make('span', 'today-name', GAMES[game].title),
      make('span', 'today-status', isDone(game) ? 'Done' : game === next ? 'Play →' : ''),
    );
    list.append(row);
  });
}

function updateHome() {
  drawPond();
  drawToday();
  for (const game of Object.keys(GAMES)) {
    if (isDone(game)) document.getElementById(`status-${game}`).textContent = 'Done ✓';
  }
}

/** A puzzle was finished. `result` is how it went: { misses, helped }. */
function finishGame(game, result) {
  const before = progress.totalDays;
  // A puzzle gives a gift, and counts toward its level, the first time
  // it's finished each day.
  const firstTime = !progressStore.isFinished(progress, playDay, game);
  progress = progressStore.recordFinish(progress, playDay, game);
  if (firstTime) {
    progress = progressStore.recordResult(progress, playDay, game, result, { maxLevel: GAMES[game].levels || 1 });
    if (result?.practiced) progress = progressStore.recordReview(progress, game, DAY, result);
  }
  progressStore.save(progress);
  const hopped = progress.totalDays > before;
  updateHome();
  justHopped = hopped; // show the hop when the home screen comes back

  const days = progress.streak;
  document.getElementById('done-streak').textContent = hopped
    ? `The frog hopped to lily pad ${progress.totalDays}!`
    : days >= 2 ? `★ Puzzles ${days} days in a row!` : `The frog is on lily pad ${progress.totalDays}!`;
  document.getElementById('done').hidden = false;
  // After a puzzle from today's set, the big button goes to the next one.
  const set = todaysPuzzles();
  const next = set.includes(game) ? set.find((name) => !isDone(name)) : null;
  const nextButton = document.getElementById('done-next');
  nextButton.textContent = next ? `Next: ${GAMES[next].title} →` : 'Pick another puzzle';
  nextButton.href = next ? `#${next}` : '#';
  document.getElementById('done-title').textContent =
    firstTime && set.includes(game) && set.every(isDone) ? 'You finished today\'s 5!' : 'You did it!';

  const sticker = firstTime ? nextSticker(progress.stickers, progress) : null;
  showGift(sticker);
  if (!sticker) celebrate(); // with a gift, the stars fall when it's opened
}

// ---------- Gifts and the sticker book ----------

// A gift that hasn't been opened yet. If the player leaves the card without
// opening it, the sticker still goes into the book (see show()).
let waitingGift = null;

function keepSticker(sticker) {
  progress = progressStore.addSticker(progress, sticker.id, sticker.tier);
  progressStore.save(progress);
  waitingGift = null;
}

/**
 * A sticker's picture. A shiny one gets a gold edge (styles.css). A rainbow
 * one is drawn as a small SVG picture, so its edge can follow the sticker's
 * shape in rainbow colors: the shape is made 6 units fatter all round (and
 * its corners rounded off), filled with the colors, and the sticker is
 * drawn on top.
 */
function stickerArt(picture, tier, extraClass = '') {
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

// The mark beside each kind of copy, so it isn't told apart by color alone.
const TIER_MARKS = { shiny: '✨', rainbow: '🌈' };

/** Show a wrapped gift on the celebration card, or no gift (a replay, or every sticker already rainbow). */
function showGift(sticker) {
  const gift = document.getElementById('gift');
  const shown = document.getElementById('gift-sticker');
  const buttons = [document.getElementById('done-next'), document.getElementById('done-close')];
  gift.hidden = !sticker;
  shown.hidden = true;
  // The gift comes first: the other buttons appear once it's open.
  for (const node of buttons) node.hidden = Boolean(sticker);
  waitingGift = sticker;
  if (!sticker) return;
  gift.onclick = () => {
    keepSticker(sticker);
    for (const node of buttons) node.hidden = false;
    gift.hidden = true;
    shown.replaceChildren(
      stickerArt(sticker.picture, sticker.tier, 'gift-picture'),
      make('span', 'gift-name', sticker.tier ? `${TIER_MARKS[sticker.tier]} A ${sticker.tier} sticker: ${sticker.name}!` : `A new sticker: ${sticker.name}!`));
    shown.hidden = false;
    drawStickerLink();
    celebrate();
  };
}

/** A look back on the home screen: puzzles finished in the last 7 days. */
function drawWeek() {
  const { puzzles, days } = progressStore.weekSummary(progress, today);
  const note = document.getElementById('week-note');
  note.hidden = puzzles < 2;
  // Spell It and the times puzzles say how many words and facts they practiced.
  const words = progressStore.itemsThisWeek(progress, today, ['spell-it']);
  const facts = progressStore.itemsThisWeek(progress, today, ['bug-groups', 'garden-rows']);
  const learned = [words ? `${words} words spelled` : '', facts ? `${facts} times facts` : ''].filter(Boolean);
  note.textContent = `This week: ${[`${puzzles} puzzles on ${days} day${days === 1 ? '' : 's'}`, ...learned].join(' · ')}. Nice work!`;
}

function drawStickerLink() {
  const count = progress.stickers.length;
  document.getElementById('sticker-link').textContent = count ? `My stickers (${count}) →` : 'My sticker book →';
}

// Which page of the sticker book is open (a number), or null for the covers.
let stickerPage = null;

function drawStickers() {
  const area = document.getElementById('game-stickers');
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
  if (stickerPage === null) {
    const covers = make('div', 'sb-covers');
    PAGES.forEach((page, p) => {
      const isNew = onPage(p).some((s) => s.id === newest);
      const cover = button(`sb-cover sb-album-${p % 8}${isNew ? ' sb-cover-new' : ''}`, '', () => {
        stickerPage = p;
        drawStickers();
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
  const p = stickerPage;
  area.append(button('lw-button sb-back', '← All pages', () => {
    stickerPage = null;
    drawStickers();
  }));
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

// How far each sticker in a row is turned, so they look stuck on by hand.
const TILTS = [-7, 4, -3, 6, -5, 3, -6, 5, -2, 7];

// ---------- Celebration: falling stars ----------

const CONFETTI_COLORS = ['var(--star)', 'var(--here)', 'var(--elsewhere)', 'var(--go)'];

function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.getElementById('confetti');
  layer.replaceChildren();
  for (let i = 0; i < 30; i++) {
    const piece = make('span', 'confetti-piece', i % 3 === 0 ? '★' : '●');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.fontSize = `${14 + Math.random() * 18}px`;
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.2}s`;
    layer.append(piece);
  }
  setTimeout(() => layer.replaceChildren(), 3500);
}

// ---------- Games ----------

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

/** The words in one or more lists from data/words/, as one list. */
async function words(...names) {
  const lists = await Promise.all(names.map((name) => loadJson(`data/words/${name}.json`)));
  return lists.flatMap((list) => Object.values(list.words).flat());
}

/** One part of a data file, e.g. part('stories', 'stories'). */
const part = async (name, key) => (await loadJson(`data/${name}.json`))[key];

/**
 * The space a maze has on this screen, { width, height }, so it can be
 * shaped to fill it: tall on a phone, wide on an iPad held sideways. The
 * numbers match `.mz-grid` and the tablet rule in styles.css.
 */
function mazeRoom() {
  // The page's own size: innerWidth and innerHeight shrink while the page is pinched bigger.
  const { clientWidth, clientHeight } = document.documentElement;
  const zoom = matchMedia('(min-width: 700px) and (min-height: 900px)').matches ? 1.3 : 1;
  const width = Math.round(clientWidth / zoom);
  // Space is left at the sides for a hand to rest on, and for the edge of the
  // screen's own swipes: a tenth of a phone's width (at least 40px). A tablet
  // has room to spare, so it keeps less: 6% at the sides, 240px above and below.
  const tablet = clientWidth >= 700;
  const sides = Math.max(40, Math.round(width * (tablet ? 0.06 : 0.1)));
  return { width: width - sides, height: Math.round(clientHeight / zoom) - (tablet ? 240 : 270) };
}

// Some puzzles have levels (`levels` in GAMES). Each one's level goes up
// after 3 easy days in a row and down after 2 hard ones (src/progress.js),
// starting the next day, so a puzzle never changes partway through a day.
const levelFor = (game) => progressStore.levelOf(progress, game, playDay);

// Spelling words and times facts that were missed come back a few days
// later (see recordReview in src/progress.js). These are the ones due now.
const reviewFor = (game) => progressStore.dueItems(progress, game, DAY);

// Stories, themes, words, and sentences are dealt from a deck counted from
// this date, so none repeats until the whole deck has been used.
const DAY = progressStore.daysBetween('2026-01-01', playDay);

// Every game, by the name used in its address (#maze) and in saved
// progress, in the order of the cards on the home screen. Each has:
//   title, legend  shown at the top of its screen
//   kind           which group it's in (see GROUPS)
//   levels         how many levels it has, if more than one
//   how            how to play, shown the first time the puzzle is opened
//   art            the little picture on its card (styled in styles.css)
//   file           its file in src/games/, if not the same as the name
//                  (also the name its daily seed uses)
//   data           what its generate() needs after the seed, if anything
// Adding a game: add its file in src/games/ and one entry here. Its card
// and its screen are built from the entry.
// The groups on the home screen, in order. Each has its own color and
// shape (styles.css, .kind-...). Today's 5 takes one puzzle from each of
// the first, second, and fourth, two from Numbers, and sometimes the fun
// one (src/today.js).
const GROUPS = [
  { kind: 'spelling', title: 'Spelling' },
  { kind: 'reading', title: 'Reading' },
  { kind: 'numbers', title: 'Numbers' },
  { kind: 'everyday', title: 'Everyday Math' },
  { kind: 'fun', title: 'Just for Fun' },
];

const GAMES = {
  'mystery-word': {
    title: 'Mystery Word', kind: 'spelling', file: 'word-guess', data: () => [words('level-3'), DAY, part('spelling', 'words')],
    how: ["Guess the hidden 5-letter word. You get 6 tries.", "Green letters are in the right spot. Purple letters are in the word, but somewhere else."],
    art: '<span class="mini mini-a">A</span><span class="mini mini-q">?</span>',
  },
  'letter-scramble': {
    title: 'Letter Scramble', kind: 'spelling', legend: 'Put the letters back in order', levels: 3, data: () => [words('level-1', 'level-2', 'level-3'), levelFor('letter-scramble')],
    how: ["The letters are mixed up.", "Drag or tap them into the boxes to spell a word."],
    art: '<span class="scramble-art"><span>t</span><span>a</span><span>c</span></span>',
  },
  'story-order': {
    title: 'Story Order', kind: 'reading', legend: 'Put the story in order', data: () => [part('stories', 'stories'), DAY],
    how: ["The story is out of order.", "Put the sentences back: what happens first, next, and last?"],
    art: '<span class="story-art"><span>1</span><span>2</span><span>3</span></span>',
  },
  'word-search': {
    title: 'Word Search', kind: 'spelling', legend: 'Find the hidden words', levels: 4, data: () => [part('search-themes', 'themes'), DAY, levelFor('word-search'), part('search-clues', 'clues')],
    how: ["Words are hiding in the letters.", "Slide your finger along a word to find it."],
    art: '<span class="search-art"><span>c</span><span class="search-art-hit">a</span><span>x</span><span>q</span><span class="search-art-hit">n</span><span>o</span><span>e</span><span class="search-art-hit">t</span><span>p</span></span>',
  },
  'word-ladder': {
    title: 'Word Ladder', kind: 'spelling', legend: 'Change one letter at a time', data: () => [words('ladder'), words('level-1', 'level-2')],
    how: ["Turn the top word into the bottom word.", "Tap one letter, then tap a new letter. Every step must be a real word."],
    art: '<span class="ladder-art"><span>c<b>a</b>t</span><span>c<b>o</b>t</span><span>c<b>o</b>g</span></span>',
  },
  'word-clues': {
    title: 'Word Clues', kind: 'reading', legend: "Use the story's clues to learn a new word", data: () => [part('rich-words', 'words'), DAY],
    how: ["Read the short story.", "Use its clues to work out what the new word means."],
    art: '<span class="clue-art"><span class="clue-glass"></span><span class="clue-word">wow</span></span>',
  },
  'fix-sentence': {
    title: 'Fix the Sentence', kind: 'reading', legend: 'One word is wrong. Find it and fix it!', data: () => [part('fix-sentences', 'sentences'), DAY],
    how: ["One word in the sentence is wrong.", "Tap it, then pick the word that fixes it."],
    art: '<span class="fix-art"><span class="fix-art-old">run</span><span class="fix-art-new">ran</span></span>',
  },
  'spell-it': {
    title: 'Spell It', kind: 'spelling', legend: 'Listen, look, and spell', levels: 3, data: () => [part('spelling', 'words'), DAY, reviewFor('spell-it'), levelFor('spell-it')],
    how: ["Read the sentence and find the missing word. Tap Hear it to listen.", "Pick it, sound it out, then spell it."],
    art: '<span class="spell-art"><span>s</span><span>p</span><span class="spell-art-blank">_</span><span>l</span><span>l</span></span>',
  },
  'end-marks': {
    title: 'End Marks', kind: 'reading', legend: 'Telling, asking, or a strong feeling?', levels: 3, data: () => [loadJson('data/end-marks.json'), DAY, levelFor('end-marks')],
    how: ["Every sentence needs an end mark.", "A period tells. A question mark asks. An exclamation mark shows a strong feeling."],
    art: '<span class="marks-art"><span>.</span><span>?</span><span>!</span></span>',
  },
  'number-pyramid': {
    title: 'Number Pyramid', kind: 'numbers', legend: 'Each brick = the two bricks under it, added', levels: 3, data: () => [levelFor('number-pyramid')],
    how: ["Each brick is the two bricks under it, added together.", "Tap an empty brick and type its number."],
    art: '<span class="bricks"><span class="brick-row"><span>9</span></span><span class="brick-row"><span>4</span><span>5</span></span></span>',
  },
  'magic-square': {
    title: 'Magic Square', kind: 'numbers', legend: 'Rows, columns, and diagonals all add up the same', levels: 3, data: () => [levelFor('magic-square')],
    how: ["Every row, column, and diagonal adds up to the same number.", "Tap a ? square and type its number."],
    art: '<span class="square-art"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></span>',
  },
  'number-line': {
    title: 'Number Line Hop', kind: 'numbers', legend: 'Where will the frog land?',
    how: ["The frog hops along the number line.", "Type the number where it will land."],
    art: '<span class="hop-art"><img class="hop-frog" src="assets/frog.svg" alt=""></span>',
  },
  'fact-families': {
    title: 'Fact Families', kind: 'numbers', legend: 'Three numbers make four facts. Drag them in!', levels: 3, data: () => [levelFor('fact-families')],
    how: ["Three numbers make four facts.", "Drag the numbers into each fact to light up the house."],
    art: '<span class="house-art"><span class="house-art-roof"></span><span class="house-art-body"><span></span><span></span></span></span>',
  },
  'find-the-mistake': {
    title: 'Find the Mistake', kind: 'numbers', legend: 'The frog got one step wrong. Find it and fix it!',
    how: ["The frog made one mistake.", "Tap the step that is wrong, then fix it."],
    art: '<span class="oops-art"><span>3+4=8</span><span class="oops-mark">✗</span></span>',
  },
  'word-problems': {
    title: 'Think It Through', kind: 'everyday', legend: 'Read carefully. Not every number helps!', data: () => [part('word-problems', 'problems')],
    how: ["Read the story problem carefully.", "One number doesn't help. Tap it, then solve the problem."],
    art: '<span class="think-art"><span>12</span><span class="think-q">?</span><span>7</span></span>',
  },
  'bug-groups': {
    title: 'Bug Groups', kind: 'numbers', legend: 'Equal groups make times facts', levels: 4, data: () => [levelFor('bug-groups'), reviewFor('bug-groups')],
    how: ["Bugs sit in equal groups on lily pads.", "Count the groups, and how many are in each one."],
    art: '<span class="bugs-art"><span><i></i><i></i><i></i></span><span><i></i><i></i><i></i></span></span>',
  },
  'garden-rows': {
    title: 'Garden Rows', kind: 'numbers', legend: 'Rows of seeds make times facts', levels: 4, data: () => [levelFor('garden-rows'), reviewFor('garden-rows')],
    how: ["Seeds grow in rows. Each row is a group.", "Add the rows, turn the garden, and split the big ones."],
    art: '<span class="garden-art"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>',
  },
  'fraction-pizza': {
    title: 'Fraction Pizza', kind: 'numbers', legend: 'Fractions, one slice at a time', levels: 3, data: () => [levelFor('fraction-pizza')],
    how: ['A fraction is part of a whole. 3/4 means 3 of 4 equal slices.', 'The bottom number is how many slices in all. The top number is how many have toppings.'],
    art: '<span class="pizza-art"></span>',
  },
  'pattern-train': {
    title: 'Pattern Train', kind: 'numbers', legend: 'Find the rule and fill the empty car', levels: 3, data: () => [levelFor('pattern-train')],
    how: ['The cars of each train follow a rule. One car is empty.', 'Work out the rule, then pick what goes in the empty car.'],
    art: '<span class="train-art"><i>2</i><i>4</i><i>?</i></span>',
  },
  'math-mix-ups': {
    title: 'Math Mix-Ups', kind: 'everyday', legend: 'Puzzles that take some thinking', levels: 2, data: () => [DAY],
    how: ["These take some thinking! Use what you know to work out what you don't.", 'Pick Mild or Spicy at the top. You can switch any time.'],
    art: '<span class="mix-art"><i></i><b></b><u></u></span>',
  },
  'graph-it': {
    title: 'Graph It', kind: 'everyday', legend: 'Read the graph, or make it', levels: 3, data: () => [levelFor('graph-it')],
    how: ["A graph is a picture of numbers.", "Read the graph to answer, or make the graph that shows the story."],
    art: '<span class="graph-art"><i></i><i></i><i></i></span>',
  },
  'clock-time': {
    title: 'Clock Time', kind: 'everyday', legend: 'Read the hands to tell the time', levels: 3, data: () => [levelFor('clock-time')],
    how: ["The short hand points to the hour. The long hand points to the minutes.", "Pick the time the clock shows."],
    art: '<span class="clock-art"><i></i><b></b></span>',
  },
  'coin-count': {
    title: 'Coin Count', kind: 'everyday', legend: 'Count the coins', levels: 3, data: () => [levelFor('coin-count')],
    how: ["Count the coins. Start with the biggest one and count on.", "Type how many cents, then press Check."],
    art: '<span class="coins-art"><i>10¢</i><i>5¢</i><i>1¢</i></span>',
  },
  'dot-to-dot': {
    title: 'Dot to Dot', kind: 'fun', legend: 'Count on to draw a picture', data: () => [DAY],
    how: ["The dots don't count 1, 2, 3. They count by 3s, 4s, or 6s!", 'Tap each dot in order, or slide your finger from dot to dot.'],
    art: '<svg class="dots-art" viewBox="0 0 40 40" aria-hidden="true"><polyline points="6,32 20,8 34,32"/><circle cx="6" cy="32" r="5"/><circle cx="20" cy="8" r="5"/><circle cx="34" cy="32" r="5"/></svg>',
  },
  'pond-sudoku': {
    title: 'Pond Sudoku', kind: 'fun', legend: 'One of each in every row, column, and box', levels: 3, data: () => [levelFor('pond-sudoku')],
    how: ['Every row, every column, and every box of 4 needs each animal once.', 'Tap an empty square, then tap the animal that goes there.'],
    art: '<span class="sudoku-art"><i>🐸</i><i></i><i></i><i>🐟</i></span>',
  },
  'memory-match': {
    title: 'Memory Match', kind: 'fun', legend: 'Turn over two cards to find a pair', levels: 3, data: () => [levelFor('memory-match')],
    how: ['The cards are face down. Turn over two at a time.', 'A pair stays up. If they don\'t match, remember where they are!'],
    art: '<span class="memory-art"><i></i><i>🐸</i><i>🐸</i><i></i></span>',
  },
  maze: {
    title: 'Maze 1', kind: 'fun', legend: 'Trace from the green dot to the star', data: () => [20, undefined, mazeRoom()],
    how: ["Find the way through the maze.", "Put your finger on the green dot and trace the path."],
    art: '<span class="maze-art"></span>',
  },
  'maze-2': {
    title: 'Maze 2', kind: 'fun', file: 'maze', legend: 'One more maze, with a new shape', data: () => [20, undefined, mazeRoom(), true],
    how: ["Here is today's second maze.", "Put your finger on the green dot and trace the path."],
    art: '<span class="maze-art maze-art-2"></span>',
  },
};

/** A game's screen: a back button, its title and legend, and room for the game. */
function makeScreen(name, { title, legend }) {
  const screen = make('section', 'view');
  screen.id = `view-${name}`;
  screen.hidden = true;
  const top = make('header', 'top game-top');
  const back = make('a', 'back', '←');
  back.href = '#';
  back.setAttribute('aria-label', 'Back to puzzles');
  top.append(back, make('h1', '', title));
  // An earlier day's puzzles show a tag in place of the legend, so the screen
  // is no taller than usual.
  if (playingPast && name in GAMES) top.append(make('p', 'yesterday-tag', `${capital(dayName(playDay))}'s puzzle`));
  else if (legend) top.append(make('p', 'legend', legend));
  const area = make('main', 'game');
  area.id = `game-${name}`;
  area.append(make('p', 'loading', 'Getting today\'s puzzle…'));
  screen.append(top, area);
  return screen;
}

/**
 * The first time a puzzle is opened, show how to play in place of the
 * puzzle. "Got it!" brings the puzzle back and remembers not to ask again.
 */
function showHowTo(name, area) {
  const { how } = GAMES[name];
  if (!how || progress.seen.includes(name) || progress.plays[name]) return;
  if (area.previousElementSibling?.classList.contains('how-to')) area.previousElementSibling.remove(); // drawn again: one card
  const card = make('div', 'how-to');
  card.append(make('h2', 'how-title', 'How to play'), ...how.map((line) => make('p', 'how-line', line)));
  card.append(button('button how-ok', 'Got it!', () => {
    progress = progressStore.markSeen(progress, name);
    progressStore.save(progress);
    card.remove();
    area.hidden = false;
  }));
  area.hidden = true;
  area.before(card);
}

// ---------- Half-done puzzles ----------

// If the phone locks or the app reloads partway through a puzzle, the
// puzzle picks up where it left off. Each game saves a small snapshot as
// it goes (session.save) and is handed it back when it starts again
// (session.saved). Snapshots are kept for the day being played only, and
// only if the puzzle is still exactly the same one.
const HALF_DONE_KEY = 'kids-puzzles.half-done';

function readHalfDone() {
  try {
    const stored = JSON.parse(localStorage.getItem(HALF_DONE_KEY));
    if (stored && stored.day === playDay && typeof stored.games === 'object') return stored;
  } catch { /* nothing saved, or storage is off */ }
  return { day: playDay, games: {} };
}

function writeHalfDone(name, entry) {
  const stored = readHalfDone();
  if (entry) stored.games[name] = entry;
  else delete stored.games[name];
  try { localStorage.setItem(HALF_DONE_KEY, JSON.stringify(stored)); } catch { /* storage is off: nothing is kept */ }
}

/**
 * What a game gets for saving and restoring: { saved, save(snapshot) }.
 * A puzzle where the player picks the level (Math Mix-Ups) also uses
 * `level` (the level to start at) and `setLevel(level)` (the player's pick).
 */
function sessionFor(name, puzzle) {
  // A fingerprint of the puzzle: a snapshot of a different puzzle (a new level, new words) is ignored.
  const fingerprint = hashString(JSON.stringify(puzzle));
  const entry = readHalfDone().games[name];
  return {
    saved: entry && entry.fingerprint === fingerprint ? entry.snapshot : undefined,
    save: (snapshot) => writeHalfDone(name, { fingerprint, snapshot }),
    level: levelFor(name),
    setLevel(level) {
      progress = progressStore.setLevel(progress, name, level);
      progressStore.save(progress);
    },
  };
}

/** Load a game's file and data, make today's puzzle, and draw it. */
async function startGame(name) {
  const { file = name, data = () => [] } = GAMES[name];
  const area = document.getElementById(`game-${name}`);
  try {
    const [game, extras] = await Promise.all([import(`./games/${file}.js`), Promise.all(data())]);
    const puzzle = game.generate(seedFor(playDay, file), ...extras);
    const onDone = (result) => {
      writeHalfDone(name, null); // finished: nothing left to pick up
      finishGame(name, result);
    };
    const session = sessionFor(name, puzzle);
    area.dataset.grid = puzzle.cols ? `${puzzle.cols}x${puzzle.rows}` : ''; // a maze: the shape it was made in
    try {
      game.render(area, puzzle, onDone, session);
      area.dataset.resumed = session.saved === undefined ? '' : 'yes';
    } catch (error) {
      // A snapshot that can't be restored must never break the puzzle: forget it and start fresh.
      if (session.saved === undefined) throw error;
      console.warn('Could not pick up the half-done puzzle; starting it fresh.', error);
      writeHalfDone(name, null);
      area.className = 'game';
      area.dataset.resumed = '';
      game.render(area, puzzle, onDone, sessionFor(name, puzzle));
    }
    showHowTo(name, area);
  } catch (error) {
    area.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

/**
 * A maze is made in the shape of the screen, and a puzzle is kept once it
 * is opened. So if the screen has changed shape since (the iPad was turned),
 * the maze would sit small in the middle: make it again to fit. A finished
 * maze is left as it is.
 */
async function refitMaze() {
  const name = location.hash.slice(1);
  const area = document.getElementById(`game-${name}`);
  if (!isMaze(name)) return;
  if (!area?.dataset.grid || area.classList.contains('finished')) return;
  const { gridFor } = await import('./games/maze.js');
  const [size, , room] = GAMES[name].data();
  const { cols, rows } = gridFor(size, room);
  if (`${cols}x${rows}` !== area.dataset.grid) startGame(name);
}

/** A game's card on the home screen: its picture, its name, and "Play" or "Done". */
function makeCard(name, { title, kind, art }) {
  const card = make('a', `card card-play kind-${kind}`);
  card.href = `#${name}`;
  const picture = make('span', 'card-art');
  picture.setAttribute('aria-hidden', 'true');
  picture.innerHTML = art;
  const status = make('span', 'card-status', 'Play');
  status.id = `status-${name}`;
  card.append(picture, make('span', 'card-name', title), status);
  return card;
}

// Build a section for each group, under "All puzzles" on the home screen.
for (const { kind, title } of GROUPS) {
  const section = make('section', `group kind-${kind}`);
  const heading = make('h2', 'group-title', title);
  heading.id = `group-${kind}`;
  section.setAttribute('aria-labelledby', heading.id);
  const cards = make('nav', 'cards');
  cards.id = `cards-${kind}`;
  cards.setAttribute('aria-label', `${title} puzzles`);
  section.append(heading, cards);
  document.getElementById('groups').append(section);
}

// Build every game's card and screen, and list the screens that exist.
// Anything else in the address shows the home screen.
const VIEWS = { '': document.getElementById('home') };
for (const [name, game] of Object.entries(GAMES)) {
  document.getElementById(`cards-${game.kind}`).append(makeCard(name, game));
  VIEWS[name] = document.querySelector('.app').appendChild(makeScreen(name, game));
}

VIEWS.stickers = document.querySelector('.app').appendChild(
  makeScreen('stickers', { title: 'My Stickers', legend: 'Every puzzle you finish has a gift.' }));

// ---------- For grown-ups ----------

// A page with the last 4 weeks, which puzzles get played, and a way to
// start over. Everything shown here is read from this phone only.
VIEWS['grown-ups'] = document.querySelector('.app').appendChild(
  makeScreen('grown-ups', { title: 'For Grown-Ups', legend: 'Everything here stays on this phone.' }));

function drawGrownUps() {
  const area = document.getElementById('game-grown-ups');
  area.replaceChildren();
  const days = progressStore.currentStreak(progress, today);
  area.append(make('p', 'gu-summary',
    `${progress.totalDays} puzzle days in all · ${days} day${days === 1 ? '' : 's'} in a row now`));
  area.append(make('p', 'gu-level',
    'Puzzles with levels move up after 3 easy days in a row, and down after 2 hard ones.'));

  // How each group is going: its puzzles that are going well or need practice.
  const groupLines = GROUPS.map(({ kind, title }) => {
    const trends = gamesIn(kind).map((name) => progressStore.trend(progress, name));
    const well = trends.filter((t) => t === 'well').length;
    const practice = trends.filter((t) => t === 'practice').length;
    const parts = [well ? `${well} going well` : '', practice ? `${practice} need${practice === 1 ? 's' : ''} practice` : ''].filter(Boolean);
    return parts.length ? `${title}: ${parts.join(', ')}` : '';
  }).filter(Boolean);
  if (groupLines.length) {
    area.append(make('h2', 'gu-heading', 'By group'));
    const groups = make('ul', 'gu-games');
    for (const text of groupLines) groups.append(make('li', 'gu-game', text));
    area.append(groups);
  }

  // The last 4 weeks, oldest first, with today in the last square.
  area.append(make('h2', 'gu-heading', 'Last 4 weeks'));
  const dates = Array.from({ length: progressStore.KEEP_DAYS }, (_, i) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - (progressStore.KEEP_DAYS - 1 - i)));
  const weeks = make('div', 'gu-weeks');
  for (const date of dates.slice(0, 7)) {
    weeks.append(make('span', 'gu-weekday', date.toLocaleDateString('en-US', { weekday: 'narrow' })));
  }
  for (const date of dates) {
    const key = dateKey(date);
    const count = (progress.finished[key] || []).length;
    const square = make('div', 'gu-day' + (count ? ' gu-day-played' : '') + (key === today ? ' gu-today' : ''));
    square.append(make('span', 'gu-date', String(date.getDate())), make('span', 'gu-count', count ? `${count}✓` : '·'));
    square.setAttribute('aria-label', `${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}: ${count ? `${count} puzzle${count === 1 ? '' : 's'}` : 'no puzzles'}`);
    weeks.append(square);
  }
  area.append(weeks);

  // Which puzzles get played: days each was finished, most first.
  area.append(make('h2', 'gu-heading', 'Puzzles played'));
  const list = make('ul', 'gu-games');
  const rows = Object.entries(GAMES)
    .map(([name, { title, levels }]) => ({ name, title, levels, times: progress.plays[name] || 0 }))
    .sort((a, b) => b.times - a.times || a.title.localeCompare(b.title));
  for (const { name, title, levels, times } of rows) {
    const row = make('li', 'gu-game');
    const about = make('span', 'gu-about');
    about.append(make('span', '', title));
    // How the last few days went, and the level for puzzles that have levels.
    const trend = progressStore.trend(progress, name);
    const notes = [
      levels ? `Level ${progressStore.levelOf(progress, name, today)} of ${levels}` : '',
      trend === 'well' ? '★ Going well' : trend === 'practice' ? '● Needs practice' : '',
    ].filter(Boolean).join(' · ');
    if (notes) about.append(make('span', `gu-note${trend === 'practice' ? ' gu-note-practice' : ''}`, notes));
    // Missed words and facts that will come back for more practice.
    const coming = (progress.review[name] || []).map((entry) => entry.item.replace(/^(\d+)x(\d+)$/, '$1 × $2'));
    if (coming.length) about.append(make('span', 'gu-note', `Coming back for practice: ${coming.join(', ')}`));
    row.append(about, make('span', 'gu-times', times ? `${times} day${times === 1 ? '' : 's'}` : 'not yet'));
    list.append(row);
  }
  area.append(list);

  // Start over: asks first, since it can't be undone.
  const ask = make('div', 'gu-confirm');
  ask.hidden = true;
  ask.append(
    make('p', '', 'This clears the lily pads, the streak, the stickers, and this page on this phone. It can\'t be undone.'),
    button('lw-button', 'Cancel', () => { ask.hidden = true; startOver.hidden = false; }),
    button('lw-button gu-reset', 'Yes, start over', () => {
      progressStore.save(progressStore.emptyProgress());
      try { localStorage.removeItem(HALF_DONE_KEY); } catch { /* storage is off */ }
      location.hash = '';
      location.reload();
    }),
  );
  const startOver = button('lw-button gu-start-over', 'Start over…', () => { ask.hidden = false; startOver.hidden = true; });
  area.append(startOver, ask);
}

// ---------- Moving between screens ----------

function show() {
  const name = location.hash.slice(1);
  const current = name in VIEWS ? name : '';

  for (const [viewName, view] of Object.entries(VIEWS)) {
    view.hidden = viewName !== current;
  }
  // The celebration card belongs to the game that just finished.
  document.getElementById('done').hidden = true;
  if (waitingGift) keepSticker(waitingGift); // left without opening the gift: keep the sticker anyway
  window.scrollTo(0, 0);
  // On a maze, a resting hand or a second finger must not zoom the page (see `.tracing` in styles.css).
  const tracing = isMaze(current);
  document.documentElement.classList.toggle('tracing', tracing);
  // maximum-scale also snaps an already zoomed page back to normal size on an iPad.
  document.querySelector('meta[name="viewport"]').content = `width=device-width, initial-scale=1, viewport-fit=cover${tracing ? ', maximum-scale=1, user-scalable=no' : ''}`;

  if (current === '') drawPond();
  if (current === 'grown-ups') drawGrownUps();
  if (current === 'stickers') {
    stickerPage = null; // the book always opens at its covers
    drawStickers();
  }

  if (current in GAMES && !started.has(current)) {
    started.add(current);
    startGame(current);
  } else {
    refitMaze(); // opened before, perhaps with the screen held the other way
  }
}

// Turning the device (or resizing the window) while a maze is showing.
let refitTimer;
window.addEventListener('resize', () => {
  clearTimeout(refitTimer);
  refitTimer = setTimeout(refitMaze, 200);
});

// "See my puzzle" closes the celebration card to look at the finished board.
document.getElementById('done-close').addEventListener('click', () => {
  document.getElementById('done').hidden = true;
});

// While a maze is showing, turn away a pinch: iPad Safari doesn't always follow `touch-action` (styles.css) for one.
const noZoom = (event) => {
  if (document.documentElement.classList.contains('tracing') && (event.touches?.length ?? 2) > 1) event.preventDefault();
};
for (const type of ['gesturestart', 'gesturechange', 'touchmove']) document.addEventListener(type, noZoom, { passive: false });

window.addEventListener('hashchange', show);
updateHome();
show();

// ---------- A new day ----------

// A home-screen app is rarely closed: it sleeps in the background and
// wakes up where it was, still showing the day it was opened. So whenever
// the app comes back to the front (and once a minute while it's open),
// check the date. If it's a new day, start again on the home screen with
// the new day's puzzles.
function startNewDayIfNeeded() {
  if (document.visibilityState !== 'visible' || dateKey() === today) return;
  // Go to today's home screen: not an earlier day's puzzles, and not a puzzle left open.
  location.replace(location.pathname);
}
// The Refresh button at the bottom of the home screen does the same by
// hand: it loads the app again, which gets the newest version (when the
// device is online) and today's puzzles. Half-done puzzles are kept.
document.getElementById('refresh').addEventListener('click', async (event) => {
  event.target.textContent = 'Refreshing…';
  event.target.disabled = true;
  try {
    // Ask for the newest service worker too, so the offline copy is up to date.
    const worker = await navigator.serviceWorker?.getRegistration();
    await worker?.update();
  } catch { /* offline, or no service worker: loading again still works */ }
  location.replace(location.pathname);
});

document.addEventListener('visibilitychange', startNewDayIfNeeded);
window.addEventListener('pageshow', startNewDayIfNeeded);
window.addEventListener('focus', startNewDayIfNeeded);
setInterval(startNewDayIfNeeded, 60 * 1000);

// ---------- Started ----------

// Tells the check in index.html that the app's code loaded and ran. The
// splash fades out on its own (styles.css); this just tidies it away.
window.lilyPadStarted = true;
setTimeout(() => document.getElementById('splash')?.remove(), 1500);

// ---------- Offline ----------

// The service worker (sw.js) saves the app's files so it opens without
// internet. If the phone can't run one, the app works as before, online.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Offline mode is off:', error));
}
