// More half-done checks for tests/screens.mjs (see RESUMES there).
// Each entry: a puzzle's name, with `play` (JavaScript that plays part of
// it) and `check` (a JavaScript expression that is true if, after the page
// is loaded again, the puzzle picked up where it left off). Some puzzles
// have setup code that runs first: see tests/play-setups.mjs.
export default {
  'tangram-pond': {
    play: `await put(0, 0); await put(1, 1);`,
    check: `G.querySelectorAll(".tp-place-done").length === 2 && G.querySelectorAll(".tp-piece-used").length === 2`,
    finish: `for (const i of order.slice(2)) await put(i, i);`,
  },
  'word-kinds': {
    play: `for (const round of rounds.slice(0, 2)) await playRound(round);`,
    check: `doneDots(2) && G.querySelectorAll('.wk-choice').length === 3`,
    finish: `for (const round of rounds.slice(2)) await playRound(round);`,
  },
  'word-builder': {
    play: `for (let round = 0; round < 2; round++) { await tapUntilRight('.wb-choice'); await next(); }`,
    check: `doneDots(2)`,
    finish: `for (let round = 0; round < 2; round++) { await tapUntilRight('.wb-choice'); await next(); }`,
  },
  'shop-change': {
    play: `for (const round of rounds.slice(0, 2)) { await pick(round.answer); await next(); }`,
    check: `doneDots(2) && G.querySelectorAll('.sc-choice').length === 3`,
    finish: `for (const round of rounds.slice(2)) { await pick(round.answer); await next(); }`,
  },
  'number-detective': {
    play: `const game = await import('/src/games/number-detective.js');
    const rounds = game.generate(seed.seedFor(today, 'number-detective')).rounds;
    const tap = async (n) => { [...G.querySelectorAll('.nd-suspect')].find((suspect) => suspect.textContent === String(n)).click(); await wait(); };
    const wrong = (round) => round.suspects.find((n) => n !== round.answer);
      await tap(rounds[0].answer); await next(); await tap(wrong(rounds[1]));`,
    check: `doneDots(1) && G.querySelectorAll('.nd-crossed:disabled').length === 1`,
    finish: `const game = await import('/src/games/number-detective.js');
    const rounds = game.generate(seed.seedFor(today, 'number-detective')).rounds;
    const tap = async (n) => { [...G.querySelectorAll('.nd-suspect')].find((suspect) => suspect.textContent === String(n)).click(); await wait(); };
    const wrong = (round) => round.suspects.find((n) => n !== round.answer);
      for (const round of rounds.slice(1)) { await tap(round.answer); await next(); }`,
  },
  'share-it-out': {
    play: `const all = G.querySelector('.sh-all');
      while (!all.disabled) all.click();
      G.querySelector('.sh-check').click(); await wait();`,
    check: `doneDots(0) && G.querySelectorAll('.sh-choice').length === 3 && !G.querySelector('.sh-check')`,
    finish: `await tapUntilRight('.sh-choice'); await next();
    for (let round = 1; round < 3; round++) {
      const all = G.querySelector('.sh-all');
      while (!all.disabled) all.click();
      G.querySelector('.sh-check').click(); await wait();
      await tapUntilRight('.sh-choice'); await next();
    }`,
  },
  'place-value': {
    play: `for (let round = 0; round < 2; round++) await playRound();`,
    check: `doneDots(2)`,
    finish: `for (let round = 0; round < 2; round++) await playRound();`,
  },
  'hoop-shots': {
    play: `const ball = G.querySelector('.hs-ball'); for (let shot = 0; shot < 2; shot++) { ball.click(); await wait(900); }`,
    check: `G.querySelector('.hs-score').textContent === '4 of 20'`,
    finish: `const ball = G.querySelector('.hs-ball'); for (let shot = 0; shot < 12 && !ball.disabled; shot++) { ball.click(); await wait(900); }`,
  },
  'pattern-train': {
    play: `for (let train = 0; train < 2; train++) { await tapUntilRight('.pt-choice'); await next(); }`,
    check: `doneDots(2)`,
    finish: `for (let train = 0; train < 2; train++) { await tapUntilRight('.pt-choice'); await next(); }`,
  },
  'fraction-pizza': {
    play: `for (const round of rounds.slice(0, 2)) await playRound(round);`,
    check: `doneDots(2)`,
    finish: `for (const round of rounds.slice(2)) await playRound(round);`,
  },
  'memory-match': {
    play: `await findPair(0); await findPair(1);`,
    check: `G.querySelectorAll('.mem-matched').length === 4 && G.querySelectorAll('.mem-up').length === 4`,
    finish: `for (let pair = 2; pair < pairs; pair++) await findPair(pair);`,
  },
  'pond-sudoku': {
    play: `for (const id of puzzle.hidden.slice(0, 2)) await place(id);`,
    check: `G.querySelectorAll('.ps-found').length === 2 && G.querySelectorAll('.ps-selected').length === 1`,
    finish: `for (const id of puzzle.hidden.slice(2)) await place(id);`,
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
