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
}

/** The link between today's and yesterday's puzzles, when it's needed. */
function drawCatchUp() {
  const link = document.getElementById('catch-up');
  const missedYesterday = (progress.totalDays || 0) > 0 && !progressStore.isFinished(progress, yesterday);
  link.hidden = !playingYesterday && !missedYesterday;
  if (playingYesterday) {
    link.textContent = '← Back to today\'s puzzles';
    link.href = './';
    document.getElementById('subtitle').textContent = 'Yesterday\'s puzzles';
  } else {
    link.textContent = 'Missed yesterday? Play it now →';
    link.href = '?day=yesterday';
  }
}

function updateHome() {
  drawPond();
  for (const game of Object.keys(GAMES)) {
    if (progressStore.isFinished(progress, playDay, game)) {
      document.getElementById(`status-${game}`).textContent = 'Done ✓';
    }
  }
}

function finishGame(game) {
  const before = progress.totalDays || 0;
  progress = progressStore.recordFinish(progress, playDay, game);
  progressStore.save(progress);
  const hopped = (progress.totalDays || 0) > before;
  updateHome();
  justHopped = hopped; // show the hop when the home screen comes back

  const days = progress.streak;
  document.getElementById('done-streak').textContent = hopped
    ? `The frog hopped to lily pad ${progress.totalDays}!`
    : days >= 2 ? `★ Puzzles ${days} days in a row!` : `The frog is on lily pad ${progress.totalDays}!`;
  document.getElementById('done').hidden = false;
  celebrate();
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

// Number Pyramid, Magic Square, and the Maze get harder as the pond grows:
// level 2 after 30 puzzle days, level 3 after 60. Today doesn't count yet,
// so the level can't change partway through a day.
const DAYS_PER_LEVEL = 30;
const daysBeforeToday = (progress.totalDays || 0) - (progress.lastDay === today ? 1 : 0);
const LEVEL = Math.min(3, 1 + Math.floor(daysBeforeToday / DAYS_PER_LEVEL));

// Stories, themes, words, and sentences are dealt from a deck counted from
// this date, so none repeats until the whole deck has been used.
const DAY = progressStore.daysBetween('2026-01-01', playDay);

// The multiplication puzzles grow with how many days each has been played
// (see src/times.js). Today doesn't count yet, so a puzzle never changes
// partway through a day.
const playsBefore = (game) =>
  (progress.plays?.[game] || 0) - (progressStore.isFinished(progress, playDay, game) ? 1 : 0);

// Every game, by the name used in its address (#maze) and in saved
// progress. Each has:
//   title, legend  shown at the top of its screen
//   file           its file in src/games/, if not the same as the name
//                  (also the name its daily seed uses)
//   data           what its generate() needs after the seed, if anything
// Adding a game: add its file in src/games/, its card in index.html, and
// one line here.
const GAMES = {
  'mystery-word': { title: 'Mystery Word', file: 'word-guess', data: () => [words('level-3'), DAY] },
  'letter-scramble': { title: 'Letter Scramble', legend: 'Put the letters back in order', data: () => [words('level-1', 'level-2')] },
  'story-order': { title: 'Story Order', legend: 'Put the story in order', data: () => [part('stories', 'stories'), DAY] },
  'word-search': { title: 'Word Search', legend: 'Find the hidden words', data: () => [part('search-themes', 'themes'), DAY] },
  'word-ladder': { title: 'Word Ladder', legend: 'Change one letter at a time', data: () => [words('ladder'), words('level-1', 'level-2')] },
  'word-clues': { title: 'Word Clues', legend: "Use the story's clues to learn a new word", data: () => [part('rich-words', 'words'), DAY] },
  'spell-it': { title: 'Spell It', legend: 'Listen, look, and spell', data: () => [part('spelling', 'words'), DAY] },
  'fix-sentence': { title: 'Fix the Sentence', legend: 'One word is wrong. Find it and fix it!', data: () => [part('fix-sentences', 'sentences'), DAY] },
  'number-pyramid': { title: 'Number Pyramid', legend: 'Each brick = the two bricks under it, added', data: () => [LEVEL] },
  'magic-square': { title: 'Magic Square', legend: 'Rows, columns, and diagonals all add up the same', data: () => [LEVEL] },
  'number-line': { title: 'Number Line Hop', legend: 'Where will the frog land?' },
  'fact-families': { title: 'Fact Families', legend: 'Three numbers make four facts. Drag them in!' },
  'bug-groups': { title: 'Bug Groups', legend: 'Equal groups make times facts', data: () => [playsBefore('bug-groups')] },
  'garden-rows': { title: 'Garden Rows', legend: 'Rows of seeds make times facts', data: () => [playsBefore('garden-rows')] },
  'find-the-mistake': { title: 'Find the Mistake', legend: 'The frog got one step wrong. Find it and fix it!' },
  'word-problems': { title: 'Think It Through', legend: 'Read carefully. Not every number helps!', data: () => [part('word-problems', 'problems')] },
  maze: { title: 'Maze', legend: 'Trace from the green dot to the star', data: () => [LEVEL] },
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
  if (legend) top.append(make('p', 'legend', legend));
  if (playingYesterday && name !== 'grown-ups') top.append(make('p', 'yesterday-tag', 'Yesterday\'s puzzle'));
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
    game.render(area, puzzle, () => finishGame(name));
  } catch (error) {
    area.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

// Build every game's screen, and list the screens that exist. Anything
// else in the address shows the home screen.
const VIEWS = { '': document.getElementById('home') };
for (const [name, game] of Object.entries(GAMES)) {
  VIEWS[name] = document.querySelector('.app').appendChild(makeScreen(name, game));
}

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
  const next = LEVEL < 3 ? ` Level ${LEVEL + 1} starts after ${LEVEL * DAYS_PER_LEVEL} puzzle days.` : '';
  area.append(make('p', 'gu-level',
    `Number Pyramid, Magic Square, and the Maze are on level ${LEVEL} of 3.${next}`));

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
    .map(([name, { title }]) => [title, progress.plays?.[name] || 0])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [title, times] of rows) {
    const row = make('li', 'gu-game');
    row.append(make('span', '', title), make('span', 'gu-times', times ? `${times} day${times === 1 ? '' : 's'}` : 'not yet'));
    list.append(row);
  }
  area.append(list);

  // Start over: asks first, since it can't be undone.
  const ask = make('div', 'gu-confirm');
  ask.hidden = true;
  ask.append(
    make('p', '', 'This clears the lily pads, the streak, and this page on this phone. It can\'t be undone.'),
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
  window.scrollTo(0, 0);

  if (current === '') drawPond();
  if (current === 'grown-ups') drawGrownUps();

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
