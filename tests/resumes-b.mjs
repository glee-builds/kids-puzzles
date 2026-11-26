// More half-done checks for tests/screens.mjs (see RESUMES there).
// Each entry: a puzzle's name, with `play` (JavaScript that plays part of
// it) and `check` (a JavaScript expression that is true if, after the page
// is loaded again, the puzzle picked up where it left off).

import { fillBlanks } from './play-setups.mjs';

export default {
  'number-pyramid': { play: fillBlanks('number-pyramid', 2), check: `G.querySelectorAll('.np-found').length === 2 && G.querySelectorAll('.np-selected').length === 1` },
  'magic-square': { play: fillBlanks('magic-square', 2), check: `G.querySelectorAll('.np-found').length === 2 && G.querySelectorAll('.np-selected').length === 1` },
  'number-line': {
    play: `const game = await import('/src/games/number-line.js');
      const spots = game.positions(game.generate(seed.seedFor(today, 'number-line')));
      await type(spots[1]); await type(spots[2]);`,
    // Two hops done, and the frog sits on the number the third hop starts from.
    check: `G.querySelectorAll('.nl-dot-done').length === 2
      && G.querySelector('.nl-line').getAttribute('aria-label').endsWith('The frog is on ' + G.querySelector('.nl-from').textContent + '.')`,
  },
  'fact-families': {
    // The roof numbers are whole, part, part. One wrong fact, then both adding facts.
    play: `const tap = async (order) => { for (const i of order) G.querySelectorAll('.ff-num')[i].click(); await wait(1100); };
      await tap([0, 1, 2]); await tap([1, 2, 0]); await tap([2, 1, 0]);`,
    check: `G.querySelectorAll('.ff-light-lit').length === 2 && G.querySelector('.ff-op').textContent === '−'`,
  },
};
