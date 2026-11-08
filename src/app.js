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
import * as letterScramble from './games/letter-scramble.js';
import * as maze from './games/maze.js';
import * as skipMaze from './games/skip-maze.js';
import * as numberLine from './games/number-line.js';
import * as factFamilies from './games/fact-families.js';
import * as progressStore from './progress.js';
import { pondPads } from './pond.js';

const today = dateKey();
let progress = progressStore.load();

// Playable games, by the name used in the address and in saved progress.
const GAMES = ['mystery-word', 'number-pyramid', 'magic-square', 'letter-wheel', 'letter-scramble', 'maze', 'skip-maze', 'number-line', 'fact-families'];

// Screens that exist. Anything else in the address shows the home screen.
const VIEWS = {
  '': document.getElementById('home'),
  'mystery-word': document.getElementById('view-mystery-word'),
  'number-pyramid': document.getElementById('view-number-pyramid'),
  'magic-square': document.getElementById('view-magic-square'),
  'letter-wheel': document.getElementById('view-letter-wheel'),
  'letter-scramble': document.getElementById('view-letter-scramble'),
  maze: document.getElementById('view-maze'),
  'skip-maze': document.getElementById('view-skip-maze'),
  'number-line': document.getElementById('view-number-line'),
  'fact-families': document.getElementById('view-fact-families'),
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
  'letter-scramble': startLetterScramble,
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

// ---------- Splash ----------

// The splash covers the screen while the app starts. Keep it up long
// enough to see (about 0.7 seconds), then fade it out.
const SPLASH_MS = 700;
function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    splash.remove();
    return;
  }
  splash.classList.add('splash-out');
  setTimeout(() => splash.remove(), 400);
}
setTimeout(hideSplash, SPLASH_MS);
