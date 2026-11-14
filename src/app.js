// app.js: the home screen, moving between screens, starting games,
// the streak, and the end-of-puzzle celebration.
//
// Each screen has its own address after the #, like #mystery-word.
// An empty address shows the home screen. Using the address means the
// phone's back gesture returns to the home screen too.

import { dateKey, seedFor } from './seed.js';
import * as progressStore from './progress.js';
import { pondPads } from './pond.js';
import { make, button } from './ui.js';
import { PAGES, STICKERS, nextSticker } from './stickers.js';
import { todaysSet, SET_SIZE } from './today.js';

const today = dateKey();
let progress = progressStore.load();

// Yesterday's puzzles: after a missed day, the home screen links to
// ?day=yesterday, which plays yesterday's puzzles instead of today's.
// Finishing one fills in the missed day (see progress.js). Only yesterday,
// not older days.
const now = new Date();
const yesterday = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
const playingYesterday = new URLSearchParams(location.search).get('day') === 'yesterday';
const playDay = playingYesterday ? yesterday : today; // the day whose puzzles are shown

// Games are started the first time they are opened, then kept, so
// leaving a game halfway and coming back keeps the guesses.
const started = new Set();

// ---------- The pond (streak) and card status ----------

// Set when the frog hops while the app is open, so the home screen can
// show the hop when the player comes back to it.
let justHopped = false;

function drawPond() {
  // `|| 0` covers a phone still holding an older progress.js for a few minutes after an update.
  const at = progress.totalDays || 0;
  const doneToday = progress.lastDay === today;
  const pond = document.getElementById('pond');
  pond.replaceChildren();
  for (const { number, kind } of pondPads(at, doneToday)) {
    const spot = document.createElement('span');
    spot.className = `pad pad-${kind}`;
    if (kind === 'frog') {
      const frog = document.createElement('img');
      frog.className = 'pond-frog' + (justHopped ? ' pond-frog-hop' : '');
      frog.src = 'assets/frog.svg';
      frog.alt = '';
      spot.append(frog);
    }
    if (number > 0) {
      const label = document.createElement('span');
      label.className = 'pad-number';
      label.textContent = String(number);
      spot.append(label);
    }
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
  if (playingYesterday && !progressStore.isFinished(progress, yesterday)) {
    caption = 'Finish one of yesterday\'s puzzles to fill in the missed day!';
  }
  const captionNode = document.getElementById('pond-caption');
  captionNode.textContent = caption;
  if (days >= 2) {
    const inARow = document.createElement('span');
    inARow.className = 'pond-streak';
    inARow.textContent = `★ ${days} days in a row`;
    captionNode.append(inARow);
  }
  drawCatchUp();
  drawStickerLink();
}

/** The link between today's and yesterday's puzzles, when it's needed. */
function drawCatchUp() {
  const link = document.getElementById('catch-up');
  const missedYesterday = (progress.totalDays || 0) > 0 && !progressStore.isFinished(progress, yesterday);
  link.hidden = !playingYesterday && !missedYesterday;
  if (playingYesterday) {
    link.textContent = '← Back to today\'s puzzles';
    link.href = './';
  } else {
    link.textContent = 'Missed yesterday? Play it now →';
    link.href = '?day=yesterday';
  }
}

// ---------- Today's set ----------

/** The 5 puzzles picked for the day being played (see src/today.js). */
function todaysPuzzles() {
  const names = (kind) => Object.keys(GAMES).filter((name) => GAMES[name].kind === kind);
  return todaysSet(names('words'), names('numbers'), DAY);
}

const isDone = (game) => progressStore.isFinished(progress, playDay, game);

function drawToday() {
  const set = todaysPuzzles();
  const done = set.filter(isDone).length;
  const next = set.find((game) => !isDone(game));
  document.getElementById('today-title').textContent = playingYesterday ? 'Yesterday\'s 5' : 'Today\'s 5';
  document.getElementById('today-count').textContent = done === SET_SIZE
    ? `★ All ${SET_SIZE} done! Great work.`
    : `${done} of ${SET_SIZE} done`;
  const list = document.getElementById('today-list');
  list.replaceChildren();
  set.forEach((game, i) => {
    const row = make('a', `today-row today-${GAMES[game].kind}` + (isDone(game) ? ' today-done' : game === next ? ' today-next' : ''));
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
    if (progressStore.isFinished(progress, playDay, game)) {
      document.getElementById(`status-${game}`).textContent = 'Done ✓';
    }
  }
}

/** A puzzle was finished. `result` is how it went: { misses, helped }. */
function finishGame(game, result) {
  const before = progress.totalDays || 0;
  // A puzzle gives a gift, and counts toward its level, the first time
  // it's finished each day.
  const firstTime = !progressStore.isFinished(progress, playDay, game);
  progress = progressStore.recordFinish(progress, playDay, game);
  if (firstTime) progress = progressStore.recordResult(progress, playDay, game, result, { maxLevel: GAMES[game].levels || 1 });
  progressStore.save(progress);
  const hopped = (progress.totalDays || 0) > before;
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

  const sticker = firstTime ? nextSticker(progress.stickers) : null;
  showGift(sticker);
  if (!sticker) celebrate(); // with a gift, the stars fall when it's opened
}

// ---------- Gifts and the sticker book ----------

/** Show a wrapped gift on the celebration card, or no gift (a replay, or a full book). */
// A gift that hasn't been opened yet. If the player leaves the card without
// opening it, the sticker still goes into the book (see show()).
let waitingGift = null;

function keepSticker(sticker) {
  progress = progressStore.addSticker(progress, sticker.id);
  progressStore.save(progress);
  waitingGift = null;
}

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
    shown.replaceChildren(make('span', 'gift-picture', sticker.picture), make('span', 'gift-name', `A new sticker: ${sticker.name}!`));
    shown.hidden = false;
    drawStickerLink();
    celebrate();
  };
}

function drawStickerLink() {
  const count = (progress.stickers || []).length;
  document.getElementById('sticker-link').textContent = count ? `My stickers (${count}) →` : 'My sticker book →';
}

function drawStickers() {
  const area = document.getElementById('game-stickers');
  area.replaceChildren();
  const owned = progress.stickers || [];
  const newest = owned[owned.length - 1];
  area.append(make('p', 'sb-count', owned.length === STICKERS.length
    ? 'Your sticker book is full. Wow!'
    : `${owned.length} of ${STICKERS.length} stickers. Finish a puzzle to open a gift!`));
  PAGES.forEach((page, p) => {
    const mine = STICKERS.filter((s) => s.page === p);
    const have = mine.filter((s) => owned.includes(s.id)).length;
    area.append(make('h2', 'sb-page', `${page.name} · ${have} of ${mine.length}`));
    const grid = make('div', 'sb-grid');
    for (const sticker of mine) {
      const got = owned.includes(sticker.id);
      const spot = make('span', 'sb-sticker' + (got ? '' : ' sb-empty') + (sticker.id === newest ? ' sb-new' : ''), got ? sticker.picture : '?');
      spot.setAttribute('role', 'img');
      spot.setAttribute('aria-label', got ? sticker.name : 'A sticker you don\'t have yet');
      grid.append(spot);
    }
    area.append(grid);
  });
}

// ---------- Celebration: falling stars ----------

const CONFETTI_COLORS = ['#ffb627', '#1f9e89', '#7b68e0', '#ff8a5c'];

function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.getElementById('confetti');
  layer.replaceChildren();
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.textContent = i % 3 === 0 ? '★' : '●';
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

// Some puzzles have levels (`levels` in GAMES). Each one's level goes up
// after 3 easy days in a row and down after 2 hard ones (src/progress.js),
// starting the next day, so a puzzle never changes partway through a day.
const levelFor = (game) => progressStore.levelOf(progress, game, playDay);

// Stories, themes, words, and sentences are dealt from a deck counted from
// this date, so none repeats until the whole deck has been used.
const DAY = progressStore.daysBetween('2026-01-01', playDay);

// Every game, by the name used in its address (#maze) and in saved
// progress, in the order of the cards on the home screen. Each has:
//   title, legend  shown at the top of its screen
//   kind           'words' or 'numbers': which group its card is in
//   levels         how many levels it has, if more than one
//   art            the little picture on its card (styled in styles.css)
//   file           its file in src/games/, if not the same as the name
//                  (also the name its daily seed uses)
//   data           what its generate() needs after the seed, if anything
// Adding a game: add its file in src/games/ and one entry here. Its card
// and its screen are built from the entry.
const GAMES = {
  'mystery-word': {
    title: 'Mystery Word', kind: 'words', file: 'word-guess', data: () => [words('level-3'), DAY],
    art: '<span class="mini mini-a">A</span><span class="mini mini-q">?</span>',
  },
  'letter-scramble': {
    title: 'Letter Scramble', kind: 'words', legend: 'Put the letters back in order', data: () => [words('level-1', 'level-2')],
    art: '<span class="scramble-art"><span>t</span><span>a</span><span>c</span></span>',
  },
  'story-order': {
    title: 'Story Order', kind: 'words', legend: 'Put the story in order', data: () => [part('stories', 'stories'), DAY],
    art: '<span class="story-art"><span>1</span><span>2</span><span>3</span></span>',
  },
  'word-search': {
    title: 'Word Search', kind: 'words', legend: 'Find the hidden words', data: () => [part('search-themes', 'themes'), DAY],
    art: '<span class="search-art"><span>c</span><span class="search-art-hit">a</span><span>x</span><span>q</span><span class="search-art-hit">n</span><span>o</span><span>e</span><span class="search-art-hit">t</span><span>p</span></span>',
  },
  'word-ladder': {
    title: 'Word Ladder', kind: 'words', legend: 'Change one letter at a time', data: () => [words('ladder'), words('level-1', 'level-2')],
    art: '<span class="ladder-art"><span>c<b>a</b>t</span><span>c<b>o</b>t</span><span>c<b>o</b>g</span></span>',
  },
  'word-clues': {
    title: 'Word Clues', kind: 'words', legend: "Use the story's clues to learn a new word", data: () => [part('rich-words', 'words'), DAY],
    art: '<span class="clue-art"><span class="clue-glass"></span><span class="clue-word">wow</span></span>',
  },
  'fix-sentence': {
    title: 'Fix the Sentence', kind: 'words', legend: 'One word is wrong. Find it and fix it!', data: () => [part('fix-sentences', 'sentences'), DAY],
    art: '<span class="fix-art"><span class="fix-art-old">run</span><span class="fix-art-new">ran</span></span>',
  },
  'spell-it': {
    title: 'Spell It', kind: 'words', legend: 'Listen, look, and spell', data: () => [part('spelling', 'words'), DAY],
    art: '<span class="spell-art"><span>s</span><span>p</span><span class="spell-art-blank">_</span><span>l</span><span>l</span></span>',
  },
  'end-marks': {
    title: 'End Marks', kind: 'words', legend: 'Telling, asking, or a strong feeling?', data: () => [loadJson('data/end-marks.json'), DAY],
    art: '<span class="marks-art"><span>.</span><span>?</span><span>!</span></span>',
  },
  'number-pyramid': {
    title: 'Number Pyramid', kind: 'numbers', legend: 'Each brick = the two bricks under it, added', levels: 3, data: () => [levelFor('number-pyramid')],
    art: '<span class="bricks"><span class="brick-row"><span>9</span></span><span class="brick-row"><span>4</span><span>5</span></span></span>',
  },
  'magic-square': {
    title: 'Magic Square', kind: 'numbers', legend: 'Rows, columns, and diagonals all add up the same', levels: 3, data: () => [levelFor('magic-square')],
    art: '<span class="square-art"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></span>',
  },
  'number-line': {
    title: 'Number Line Hop', kind: 'numbers', legend: 'Where will the frog land?',
    art: '<span class="hop-art"><img class="hop-frog" src="assets/frog.svg" alt=""></span>',
  },
  'fact-families': {
    title: 'Fact Families', kind: 'numbers', legend: 'Three numbers make four facts. Drag them in!',
    art: '<span class="house-art"><span class="house-art-roof"></span><span class="house-art-body"><span></span><span></span></span></span>',
  },
  'find-the-mistake': {
    title: 'Find the Mistake', kind: 'numbers', legend: 'The frog got one step wrong. Find it and fix it!',
    art: '<span class="oops-art"><span>3+4=8</span><span class="oops-mark">✗</span></span>',
  },
  'word-problems': {
    title: 'Think It Through', kind: 'numbers', legend: 'Read carefully. Not every number helps!', data: () => [part('word-problems', 'problems')],
    art: '<span class="think-art"><span>12</span><span class="think-q">?</span><span>7</span></span>',
  },
  'bug-groups': {
    title: 'Bug Groups', kind: 'numbers', legend: 'Equal groups make times facts', levels: 3, data: () => [levelFor('bug-groups')],
    art: '<span class="bugs-art"><span><i></i><i></i><i></i></span><span><i></i><i></i><i></i></span></span>',
  },
  'garden-rows': {
    title: 'Garden Rows', kind: 'numbers', legend: 'Rows of seeds make times facts', levels: 3, data: () => [levelFor('garden-rows')],
    art: '<span class="garden-art"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>',
  },
  maze: {
    title: 'Maze', kind: 'numbers', legend: 'Trace from the green dot to the star', levels: 3, data: () => [levelFor('maze')],
    art: '<span class="maze-art"></span>',
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
  // Yesterday's puzzles show a tag in place of the legend, so the screen
  // is no taller than usual.
  if (playingYesterday && name in GAMES) top.append(make('p', 'yesterday-tag', 'Yesterday\'s puzzle'));
  else if (legend) top.append(make('p', 'legend', legend));
  const area = make('main', 'game');
  area.id = `game-${name}`;
  area.append(make('p', 'loading', 'Getting today\'s puzzle…'));
  screen.append(top, area);
  return screen;
}

/** Load a game's file and data, make today's puzzle, and draw it. */
async function startGame(name) {
  const { file = name, data = () => [] } = GAMES[name];
  const area = document.getElementById(`game-${name}`);
  try {
    const [game, extras] = await Promise.all([import(`./games/${file}.js`), Promise.all(data())]);
    const puzzle = game.generate(seedFor(playDay, file), ...extras);
    game.render(area, puzzle, (result) => finishGame(name, result));
  } catch (error) {
    area.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

/** A game's card on the home screen: its picture, its name, and "Play" or "Done". */
function makeCard(name, { title, kind, art }) {
  const card = make('a', `card card-play card-${kind}`);
  card.href = `#${name}`;
  const picture = make('span', 'card-art');
  picture.setAttribute('aria-hidden', 'true');
  picture.innerHTML = art;
  const status = make('span', 'card-status', 'Play');
  status.id = `status-${name}`;
  card.append(picture, make('span', 'card-name', title), status);
  return card;
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
    `${progress.totalDays || 0} puzzle days in all · ${days} day${days === 1 ? '' : 's'} in a row now`));
  area.append(make('p', 'gu-level',
    'Puzzles with levels move up after 3 easy days in a row, and down after 2 hard ones.'));

  // The last 4 weeks, oldest first, with today in the last square.
  area.append(make('h2', 'gu-heading', 'Last 4 weeks'));
  const now = new Date();
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
    .map(([name, { title, levels }]) => ({ name, title, levels, times: progress.plays?.[name] || 0 }))
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

  if (current === '') drawPond();
  if (current === 'grown-ups') drawGrownUps();
  if (current === 'stickers') drawStickers();

  if (current in GAMES && !started.has(current)) {
    started.add(current);
    startGame(current);
  }
}

// "See my puzzle" closes the celebration card to look at the finished board.
document.getElementById('done-close').addEventListener('click', () => {
  document.getElementById('done').hidden = true;
});

window.addEventListener('hashchange', show);
updateHome();
show();

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
