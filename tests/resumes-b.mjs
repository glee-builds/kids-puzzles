// More half-done checks for tests/screens.mjs (see RESUMES there).
// Each entry: a puzzle's name, with `play` (JavaScript that plays part of
// it) and `check` (a JavaScript expression that is true if, after the page
// is loaded again, the puzzle picked up where it left off).

// Type a wrong number, then the right numbers for two blanks (bricks or squares).
const twoBlanks = (name) => `
  const game = await import('/src/games/${name}.js');
  let state = game.start(game.generate(seed.seedFor(today, '${name}')));
  await type(999);
  for (let found = 0; found < 2; found++) {
    const cell = game.workable(state)[0];
    const value = game.answerFor(state.puzzle, cell);
    await type(value);
    state = game.check(state, { cell, value });
  }`;

export default {
  'number-pyramid': { play: twoBlanks('number-pyramid'), check: `G.querySelectorAll('.np-found').length === 2 && G.querySelectorAll('.np-selected').length === 1` },
  'magic-square': { play: twoBlanks('magic-square'), check: `G.querySelectorAll('.np-found').length === 2 && G.querySelectorAll('.np-selected').length === 1` },
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
