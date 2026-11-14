// More half-done checks for tests/screens.mjs (see RESUMES there).
// Each entry: a puzzle's name, with `play` (JavaScript that plays part of
// it) and `check` (a JavaScript expression that is true if, after the page
// is loaded again, the puzzle picked up where it left off).
export default {
  // Fix the first problem, then find (but don't fix) the mistake in the second.
  'find-the-mistake': {
    play: `const game = await import('/src/games/find-the-mistake.js');
      const [first, second] = game.generate(seed.seedFor(today, 'find-the-mistake')).problems;
      G.querySelectorAll('.fm-step')[first.mistake].click(); await wait();
      await type(game.lines(first, true)[first.mistake].answer); await next();
      G.querySelectorAll('.fm-step')[second.mistake].click(); await wait();`,
    check: `G.querySelector('.count-line').textContent.startsWith('Problem 2 ') && Boolean(G.querySelector('.fm-wrong')) && !G.querySelector('.fm-pad').hidden`,
  },
  // Answer the first problem (tap the number that isn't needed, then type the answer).
  'word-problems': {
    play: `const game = await import('/src/games/word-problems.js');
      const data = await (await fetch('/data/word-problems.json')).json();
      const first = game.generate(seed.seedFor(today, 'word-problems'), data.problems).problems[0];
      const extra = String(first.numbers.c);
      [...G.querySelectorAll('.wp-number')].find((chip) => chip.textContent === extra).click(); await wait();
      await type(game.answerFor(first)); await next();`,
    check: `G.querySelector('.count-line').textContent.startsWith('Problem 2 ') && G.querySelector('.next-button').hidden`,
  },
  // Trace the first 5 steps of the way through, then lift the finger.
  maze: {
    play: `const game = await import('/src/games/maze.js');
      const route = game.solution(game.generate(seed.seedFor(today, 'maze'), 1)).slice(0, 6);
      const grid = G.querySelector('.mz-grid');
      const finger = (kind, [r, c]) => {
        const box = grid.querySelector('[data-r="' + r + '"][data-c="' + c + '"]').getBoundingClientRect();
        grid.dispatchEvent(new PointerEvent(kind, { bubbles: true, pointerId: 1, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
      };
      finger('pointerdown', route[0]);
      for (const square of route) finger('pointermove', square);
      finger('pointerup', route[5]);
      await wait();`,
    check: `G.querySelectorAll('.mz-path').length === 6 && !G.querySelector('.mz-head').classList.contains('mz-start')`,
  },
};
