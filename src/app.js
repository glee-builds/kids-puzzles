// app.js: the home screen, moving between screens, and starting games.
//
// Each screen has its own address after the #, like #mystery-word.
// An empty address shows the home screen. Using the address means the
// phone's back gesture returns to the home screen too.

import { dateKey, seedFor } from './seed.js';
import * as wordGuess from './games/word-guess.js';

// Screens that exist. Anything else in the address shows the home screen.
const VIEWS = {
  '': document.getElementById('home'),
  'mystery-word': document.getElementById('view-mystery-word'),
};

// Games are started the first time they are opened, then kept, so
// leaving a game halfway and coming back keeps the guesses.
const started = new Set();

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
    const puzzle = wordGuess.generate(seedFor(dateKey(), 'word-guess'), words);
    wordGuess.render(game, puzzle, () => {
      document.getElementById('done').hidden = false;
      const status = document.getElementById('status-mystery-word');
      status.textContent = 'Done ✓';
      status.classList.add('card-status-done');
    });
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

const STARTERS = {
  'mystery-word': startMysteryWord,
};

function show() {
  const name = location.hash.slice(1);
  const current = name in VIEWS ? name : '';

  for (const [viewName, view] of Object.entries(VIEWS)) {
    view.hidden = viewName !== current;
  }
  window.scrollTo(0, 0);

  if (STARTERS[current] && !started.has(current)) {
    started.add(current);
    STARTERS[current]();
  }
}

window.addEventListener('hashchange', show);
show();
