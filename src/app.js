// app.js: the home screen, moving between screens, starting games,
// the streak, and the end-of-puzzle celebration.
//
// Each screen has its own address after the #, like #mystery-word.
// An empty address shows the home screen. Using the address means the
// phone's back gesture returns to the home screen too.

import { dateKey, seedFor } from './seed.js';
import * as wordGuess from './games/word-guess.js';
import * as numberPyramid from './games/number-pyramid.js';
import * as magicSquare from './games/magic-square.js';
import * as letterScramble from './games/letter-scramble.js';
import * as storyOrder from './games/story-order.js';
import * as wordSearch from './games/word-search.js';
import * as wordLadder from './games/word-ladder.js';
import * as maze from './games/maze.js';
import * as numberLine from './games/number-line.js';
import * as factFamilies from './games/fact-families.js';
import * as findTheMistake from './games/find-the-mistake.js';
import * as wordProblems from './games/word-problems.js';
import * as wordClues from './games/word-clues.js';
import * as progressStore from './progress.js';
import { pondPads } from './pond.js';

const today = dateKey();
let progress = progressStore.load();

// Playable games, by the name used in the address and in saved progress.
const GAMES = ['mystery-word', 'number-pyramid', 'magic-square', 'story-order', 'letter-scramble', 'word-search', 'word-ladder', 'maze', 'number-line', 'fact-families', 'find-the-mistake', 'word-problems', 'word-clues'];

// Screens that exist. Anything else in the address shows the home screen.
const VIEWS = {
  '': document.getElementById('home'),
  'mystery-word': document.getElementById('view-mystery-word'),
  'number-pyramid': document.getElementById('view-number-pyramid'),
  'magic-square': document.getElementById('view-magic-square'),
  'story-order': document.getElementById('view-story-order'),
  'letter-scramble': document.getElementById('view-letter-scramble'),
  'word-search': document.getElementById('view-word-search'),
  'word-ladder': document.getElementById('view-word-ladder'),
  maze: document.getElementById('view-maze'),
  'number-line': document.getElementById('view-number-line'),
  'fact-families': document.getElementById('view-fact-families'),
  'find-the-mistake': document.getElementById('view-find-the-mistake'),
  'word-problems': document.getElementById('view-word-problems'),
  'word-clues': document.getElementById('view-word-clues'),
};

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
  for (const game of GAMES) {
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

async function loadWords(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  const list = await response.json();
  return Object.values(list.words).flat();
}

async function startMysteryWord() {
  const game = document.getElementById('game');
  try {
    const words = await loadWords('data/words/level-3.json');
    const puzzle = wordGuess.generate(seedFor(today, 'word-guess'), words);
    wordGuess.render(game, puzzle, () => finishGame('mystery-word'));
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

function startNumberPyramid() {
  const game = document.getElementById('game-number-pyramid');
  const puzzle = numberPyramid.generate(seedFor(today, 'number-pyramid'));
  numberPyramid.render(game, puzzle, () => finishGame('number-pyramid'));
}

function startMagicSquare() {
  const game = document.getElementById('game-magic-square');
  const puzzle = magicSquare.generate(seedFor(today, 'magic-square'));
  magicSquare.render(game, puzzle, () => finishGame('magic-square'));
}

// Stories are dealt two a day from a fixed start date, so none repeats
// until all of them have been used.
const STORY_START = '2026-01-01';

async function startStoryOrder() {
  const game = document.getElementById('game-story-order');
  try {
    const response = await fetch('data/stories.json');
    if (!response.ok) throw new Error('Could not load data/stories.json');
    const { stories } = await response.json();
    const day = progressStore.daysBetween(STORY_START, today);
    const puzzle = storyOrder.generate(seedFor(today, 'story-order'), stories, day);
    storyOrder.render(game, puzzle, () => finishGame('story-order'));
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

async function startLetterScramble() {
  const game = document.getElementById('game-letter-scramble');
  try {
    const lists = await Promise.all([
      loadWords('data/words/level-1.json'),
      loadWords('data/words/level-2.json'),
    ]);
    const puzzle = letterScramble.generate(seedFor(today, 'letter-scramble'), lists.flat());
    letterScramble.render(game, puzzle, () => finishGame('letter-scramble'));
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

// Word Search themes are dealt one a day from the same start date.
async function startWordSearch() {
  const game = document.getElementById('game-word-search');
  try {
    const response = await fetch('data/search-themes.json');
    if (!response.ok) throw new Error('Could not load data/search-themes.json');
    const { themes } = await response.json();
    const day = progressStore.daysBetween(STORY_START, today);
    const puzzle = wordSearch.generate(seedFor(today, 'word-search'), themes, day);
    wordSearch.render(game, puzzle, () => finishGame('word-search'));
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

async function startWordLadder() {
  const game = document.getElementById('game-word-ladder');
  try {
    const [ladder, ...phonics] = await Promise.all([
      loadWords('data/words/ladder.json'),
      loadWords('data/words/level-1.json'),
      loadWords('data/words/level-2.json'),
    ]);
    const puzzle = wordLadder.generate(seedFor(today, 'word-ladder'), ladder, phonics.flat());
    wordLadder.render(game, puzzle, () => finishGame('word-ladder'));
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

function startMaze() {
  const game = document.getElementById('game-maze');
  const puzzle = maze.generate(seedFor(today, 'maze'));
  maze.render(game, puzzle, () => finishGame('maze'));
}

function startNumberLine() {
  const game = document.getElementById('game-number-line');
  const puzzle = numberLine.generate(seedFor(today, 'number-line'));
  numberLine.render(game, puzzle, () => finishGame('number-line'));
}

function startFactFamilies() {
  const game = document.getElementById('game-fact-families');
  const puzzle = factFamilies.generate(seedFor(today, 'fact-families'));
  factFamilies.render(game, puzzle, () => finishGame('fact-families'));
}

function startFindTheMistake() {
  const game = document.getElementById('game-find-the-mistake');
  const puzzle = findTheMistake.generate(seedFor(today, 'find-the-mistake'));
  findTheMistake.render(game, puzzle, () => finishGame('find-the-mistake'));
}

async function startWordProblems() {
  const game = document.getElementById('game-word-problems');
  try {
    const response = await fetch('data/word-problems.json');
    if (!response.ok) throw new Error('Could not load data/word-problems.json');
    const { problems } = await response.json();
    const puzzle = wordProblems.generate(seedFor(today, 'word-problems'), problems);
    wordProblems.render(game, puzzle, () => finishGame('word-problems'));
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

// Word Clues words are dealt two a day from the same start date.
async function startWordClues() {
  const game = document.getElementById('game-word-clues');
  try {
    const response = await fetch('data/rich-words.json');
    if (!response.ok) throw new Error('Could not load data/rich-words.json');
    const { words } = await response.json();
    const day = progressStore.daysBetween(STORY_START, today);
    const puzzle = wordClues.generate(seedFor(today, 'word-clues'), words, day);
    wordClues.render(game, puzzle, () => finishGame('word-clues'));
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

const STARTERS = {
  'mystery-word': startMysteryWord,
  'number-pyramid': startNumberPyramid,
  'magic-square': startMagicSquare,
  'story-order': startStoryOrder,
  'letter-scramble': startLetterScramble,
  'word-search': startWordSearch,
  'word-ladder': startWordLadder,
  maze: startMaze,
  'number-line': startNumberLine,
  'fact-families': startFactFamilies,
  'find-the-mistake': startFindTheMistake,
  'word-problems': startWordProblems,
  'word-clues': startWordClues,
};

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

  if (STARTERS[current] && !started.has(current)) {
    started.add(current);
    STARTERS[current]();
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
