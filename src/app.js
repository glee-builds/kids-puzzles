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
import * as letterWheel from './games/letter-wheel.js';
import * as maze from './games/maze.js';
import * as skipMaze from './games/skip-maze.js';
import * as numberLine from './games/number-line.js';
import * as factFamilies from './games/fact-families.js';
import * as progressStore from './progress.js';

const today = dateKey();
let progress = progressStore.load();

// Playable games, by the name used in the address and in saved progress.
const GAMES = ['mystery-word', 'number-pyramid', 'magic-square', 'letter-wheel', 'maze', 'skip-maze', 'number-line', 'fact-families'];

// Screens that exist. Anything else in the address shows the home screen.
const VIEWS = {
  '': document.getElementById('home'),
  'mystery-word': document.getElementById('view-mystery-word'),
  'number-pyramid': document.getElementById('view-number-pyramid'),
  'magic-square': document.getElementById('view-magic-square'),
  'letter-wheel': document.getElementById('view-letter-wheel'),
  maze: document.getElementById('view-maze'),
  'skip-maze': document.getElementById('view-skip-maze'),
  'number-line': document.getElementById('view-number-line'),
  'fact-families': document.getElementById('view-fact-families'),
};

// Games are started the first time they are opened, then kept, so
// leaving a game halfway and coming back keeps the guesses.
const started = new Set();

// ---------- Streak and card status ----------

function streakText(days) {
  if (days === 0) return 'Finish a puzzle to start a streak!';
  // The streak counts days with any finished puzzle, so the words say
  // "puzzles", not the name of one game.
  if (days === 1) return '★ Puzzles 1 day';
  return `★ Puzzles ${days} days in a row`;
}

function updateHome() {
  const days = progressStore.currentStreak(progress, today);
  const streak = document.getElementById('streak');
  streak.textContent = streakText(days);
  streak.classList.toggle('streak-on', days > 0);

  for (const game of GAMES) {
    if (progressStore.isFinished(progress, today, game)) {
      document.getElementById(`status-${game}`).textContent = 'Done ✓';
    }
  }
}

function finishGame(game) {
  progress = progressStore.recordFinish(progress, today, game);
  progressStore.save(progress);
  updateHome();

  const days = progress.streak;
  document.getElementById('done-streak').textContent =
    days === 1 ? '★ Day 1 of your puzzle streak!' : `★ Puzzles ${days} days in a row!`;
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
    const words = await loadWords('data/words/level-2.json');
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

async function startLetterWheel() {
  const game = document.getElementById('game-letter-wheel');
  try {
    const lists = await Promise.all([
      loadWords('data/words/level-1.json'),
      loadWords('data/words/level-2.json'),
    ]);
    const puzzle = letterWheel.generate(seedFor(today, 'letter-wheel'), lists.flat());
    letterWheel.render(game, puzzle, () => finishGame('letter-wheel'));
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

function startSkipMaze() {
  const game = document.getElementById('game-skip-maze');
  const puzzle = skipMaze.generate(seedFor(today, 'skip-maze'));
  skipMaze.render(game, puzzle, () => finishGame('skip-maze'));
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

const STARTERS = {
  'mystery-word': startMysteryWord,
  'number-pyramid': startNumberPyramid,
  'magic-square': startMagicSquare,
  'letter-wheel': startLetterWheel,
  maze: startMaze,
  'skip-maze': startSkipMaze,
  'number-line': startNumberLine,
  'fact-families': startFactFamilies,
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
