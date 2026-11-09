// app.js: the home screen, moving between screens, starting games,
// the streak, and the end-of-puzzle celebration.
//
// Each screen has its own address after the #, like #mystery-word.
// An empty address shows the home screen. Using the address means the
// phone's back gesture returns to the home screen too.

import { dateKey, seedFor } from './seed.js';
import * as progressStore from './progress.js';
import { pondPads } from './pond.js';
import { make } from './ui.js';

const today = dateKey();
let progress = progressStore.load();

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
  const captionNode = document.getElementById('pond-caption');
  captionNode.textContent = caption;
  if (days >= 2) {
    const inARow = document.createElement('span');
    inARow.className = 'pond-streak';
    inARow.textContent = `★ ${days} days in a row`;
    captionNode.append(inARow);
  }
}

function updateHome() {
  drawPond();
  for (const game of Object.keys(GAMES)) {
    if (progressStore.isFinished(progress, today, game)) {
      document.getElementById(`status-${game}`).textContent = 'Done ✓';
    }
  }
}

function finishGame(game) {
  const before = progress.totalDays || 0;
  progress = progressStore.recordFinish(progress, today, game);
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

// Stories, themes, words, and sentences are dealt from a deck counted from
// this date, so none repeats until the whole deck has been used.
const DAY = progressStore.daysBetween('2026-01-01', today);

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
  'fix-sentence': { title: 'Fix the Sentence', legend: 'One word is wrong. Find it and fix it!', data: () => [part('fix-sentences', 'sentences'), DAY] },
  'number-pyramid': { title: 'Number Pyramid', legend: 'Each brick = the two bricks under it, added' },
  'magic-square': { title: 'Magic Square', legend: 'Rows, columns, and diagonals all add up the same' },
  'number-line': { title: 'Number Line Hop', legend: 'Where will the frog land?' },
  'fact-families': { title: 'Fact Families', legend: 'Three numbers make four facts. Drag them in!' },
  'find-the-mistake': { title: 'Find the Mistake', legend: 'The frog got one step wrong. Find it and fix it!' },
  'word-problems': { title: 'Think It Through', legend: 'Read carefully. Not every number helps!', data: () => [part('word-problems', 'problems')] },
  maze: { title: 'Maze', legend: 'Trace from the green dot to the star' },
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
    const puzzle = game.generate(seedFor(today, file), ...extras);
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
