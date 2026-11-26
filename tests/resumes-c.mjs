// More half-done checks for tests/screens.mjs (see RESUMES there).
// Each entry: a puzzle's name, with `play` (JavaScript that plays part of
// it) and `check` (a JavaScript expression that is true if, after the page
// is loaded again, the puzzle picked up where it left off).
export default {
  'fraction-pizza': {
    play: `const game = await import('/src/games/fraction-pizza.js');
    const { rounds } = game.generate(seed.seedFor(today, 'fraction-pizza'));
    const playRound = async (round) => {
      if (round.kind === 'make') {
        const slices = G.querySelectorAll('.fp-slice');
        for (let i = 0; i < round.topped; i++) slices[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        G.querySelector('.fp-check').click(); await wait();
      } else await tapUntilRight(round.kind === 'name' ? '.fp-choice' : '.fp-pick');
      await next();
    };
      for (const round of rounds.slice(0, 2)) await playRound(round);`,
    check: `doneDots(2)`,
    finish: `const game = await import('/src/games/fraction-pizza.js');
    const { rounds } = game.generate(seed.seedFor(today, 'fraction-pizza'));
    const playRound = async (round) => {
      if (round.kind === 'make') {
        const slices = G.querySelectorAll('.fp-slice');
        for (let i = 0; i < round.topped; i++) slices[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        G.querySelector('.fp-check').click(); await wait();
      } else await tapUntilRight(round.kind === 'name' ? '.fp-choice' : '.fp-pick');
      await next();
    };
      for (const round of rounds.slice(2)) await playRound(round);`,
  },
  'memory-match': {
    play: `const game = await import('/src/games/memory-match.js');
    const { cards } = game.generate(seed.seedFor(today, 'memory-match'));
    const nodes = G.querySelectorAll('.mem-card');
    const of = (pair) => cards.map((card, i) => (card.pair === pair ? i : -1)).filter((i) => i >= 0);
    const turn = async (i) => { nodes[i].click(); await wait(50); };
      for (const pair of [0, 1]) { await turn(of(pair)[0]); await turn(of(pair)[1]); }`,
    check: `G.querySelectorAll('.mem-matched').length === 4 && G.querySelectorAll('.mem-up').length === 4`,
    finish: `const game = await import('/src/games/memory-match.js');
    const { cards } = game.generate(seed.seedFor(today, 'memory-match'));
    const nodes = G.querySelectorAll('.mem-card');
    const of = (pair) => cards.map((card, i) => (card.pair === pair ? i : -1)).filter((i) => i >= 0);
    const turn = async (i) => { nodes[i].click(); await wait(50); };
      for (let pair = 2; pair < cards.length / 2; pair++) { await turn(of(pair)[0]); await turn(of(pair)[1]); }`,
  },
  'pond-sudoku': {
    play: `const game = await import('/src/games/pond-sudoku.js');
      const puzzle = game.generate(seed.seedFor(today, 'pond-sudoku'));
      for (const id of puzzle.hidden.slice(0, 2)) { G.querySelectorAll('.ps-pick')[game.answerFor(puzzle, id)].click(); await wait(60); }`,
    check: `G.querySelectorAll('.ps-found').length === 2 && G.querySelectorAll('.ps-selected').length === 1`,
    finish: `const game = await import('/src/games/pond-sudoku.js');
      const puzzle = game.generate(seed.seedFor(today, 'pond-sudoku'));
      for (const id of puzzle.hidden.slice(2)) { G.querySelectorAll('.ps-pick')[game.answerFor(puzzle, id)].click(); await wait(60); }`,
  },
  'dot-to-dot': {
    play: `for (const dot of [...G.querySelectorAll('.dd-dot')].slice(0, 3)) { dot.click(); await wait(60); }`,
    check: `G.querySelectorAll('.dd-dot-done').length === 3 && G.querySelector('.dd-line').getAttribute('points').split(' ').length === 3`,
    finish: `for (const dot of [...G.querySelectorAll('.dd-dot')].slice(3)) { dot.click(); await wait(60); }`,
  },
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
      const route = game.solution(game.generate(seed.seedFor(today, 'maze'), 20)).slice(0, 6);
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
