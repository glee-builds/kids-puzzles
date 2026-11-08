// app.js: load today's puzzle and show it.
//
// Phase 1 has one game. Phase 2 turns this into a daily set with a streak.

import { dateKey, seedFor } from './seed.js';
import * as wordGuess from './games/word-guess.js';

async function loadWords(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  const list = await response.json();
  return Object.values(list.words).flat();
}

function showDone() {
  const done = document.getElementById('done');
  done.hidden = false;
  done.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

async function main() {
  const game = document.getElementById('game');
  try {
    const words = await loadWords('data/words/level-1.json');
    const today = dateKey();
    const puzzle = wordGuess.generate(seedFor(today, 'word-guess'), words);
    wordGuess.render(game, puzzle, showDone);
  } catch (error) {
    game.textContent = 'Oops, the puzzle could not load. Try again in a moment.';
    console.error(error);
  }
}

main();
