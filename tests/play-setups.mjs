// Setup code for tests/screens.mjs: for a few puzzles, the JavaScript that
// playing them needs first (the day's puzzle, and a helper or two). It is
// put in front of that puzzle's snippets in PLAYS and RESUMES, so each
// snippet only says what to play. `G`, `seed`, `today`, `wait`, `next`, and
// `tapUntilRight` come from HELPERS in tests/screens.mjs.
export default {
  'lily-pad-paths': `
        const game = await import('/src/games/lily-pad-paths.js');
    const puzzle = game.generate(seed.seedFor(today, 'lily-pad-paths'), 1);
    const cell = ([r, c]) => G.querySelector('.lp-cell[data-r="' + r + '"][data-c="' + c + '"]');
    // join(pair) taps the squares of the stored path for one pair, in order.
    const join = async (pair) => { for (const square of puzzle.solution[pair]) { cell(square).click(); await wait(30); } };`,
  'tangram-pond': `
        const game = await import("/src/games/tangram-pond.js");
    const puzzle = game.generate(seed.seedFor(today, "tangram-pond"), dayNumber);
    const order = puzzle.pieces.map((_, i) => i);
    // Tap a piece in the tray, then a place on the board.
    const put = async (piece, place) => {
      G.querySelector(\`[data-piece="\${piece}"]\`).click(); await wait(60);
      G.querySelector(\`[data-place="\${place}"]\`).dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(60);
    };`,
  'word-kinds': `
        const game = await import('/src/games/word-kinds.js');
    const { items } = await (await fetch('/data/word-kinds.json')).json();
    const { rounds } = game.generate(seed.seedFor(today, 'word-kinds'), items, dayNumber);
    // pick(kind) taps that kind's button. playRound(round) answers a "name" round right and presses Next.
    const pick = async (kind) => { G.querySelectorAll('.wk-choice')[game.KINDS.indexOf(kind)].click(); await wait(); };
    const playRound = async (round) => { await pick(round.tags[round.target]); await next(); };`,
  'shop-change': `
        const game = await import('/src/games/shop-change.js');
    const rounds = game.generate(seed.seedFor(today, 'shop-change')).rounds;
    const pick = async (cents) => { [...G.querySelectorAll('.sc-choice')].find((choice) => choice.textContent === game.money(cents)).click(); await wait(); };
    // A coin round: tap the counting-up coins from the tray, then Check.
    const give = async (round) => {
      for (const { coin } of game.countUp(round.price, round.paid)) G.querySelector('.sc-tray .sc-' + coin).click();
      G.querySelector('.sc-check').click(); await wait();
    };
    const play = (round) => (round.kind === 'make' ? give(round) : pick(round.answer));`,
  'place-value': `
        const playRound = async () => {
      if (G.querySelector('.pv-check')) {
        const digits = G.querySelector('.pv-number').textContent.padStart(3, '0');
        ['hundreds', 'tens', 'ones'].forEach((place, i) => {
          for (let n = 0; n < Number(digits[i]); n++) G.querySelector('.pv-' + place + ' .pv-plus').click();
        });
        G.querySelector('.pv-check').click(); await wait();
      } else await tapUntilRight('.pv-choice');
      await next();
    };`,
  // rounds: today's 5 rounds. playRound(round) plays one and presses Next.
  'fraction-pizza': `
    const game = await import('/src/games/fraction-pizza.js');
    const { rounds } = game.generate(seed.seedFor(today, 'fraction-pizza'));
    const playRound = async (round) => {
      if (round.kind === 'make') {
        const slices = G.querySelectorAll('.fp-slice');
        for (let i = 0; i < round.topped; i++) slices[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        G.querySelector('.fp-check').click(); await wait();
      } else if (round.kind === 'match') {
        const fractions = G.querySelectorAll('.fp-match-fraction');
        const pizzas = G.querySelectorAll('.fp-match-pizza');
        for (let i = 0; i < 4; i++) { fractions[i].click(); pizzas[round.order.indexOf(i)].click(); await wait(40); }
      } else await tapUntilRight(round.kind === 'name' ? '.fp-choice' : '.fp-pick');
      await next();
    };`,
  // pairs: how many pairs. findPair(n) turns over both cards of pair n; turn(i) turns over card i; of(n) is pair n's two cards.
  'memory-match': `
    const game = await import('/src/games/memory-match.js');
    const { cards } = game.generate(seed.seedFor(today, 'memory-match'));
    const pairs = cards.length / 2;
    const nodes = G.querySelectorAll('.mem-card');
    const of = (pair) => cards.map((card, i) => (card.pair === pair ? i : -1)).filter((i) => i >= 0);
    const turn = async (i) => { nodes[i].click(); await wait(50); };
    const findPair = async (pair) => { await turn(of(pair)[0]); await turn(of(pair)[1]); };`,
  // puzzle: today's pond. place(id, off) taps the right animal for square `id` (or, with off = 1, a wrong one).
  'pond-sudoku': `
    const game = await import('/src/games/pond-sudoku.js');
    const puzzle = game.generate(seed.seedFor(today, 'pond-sudoku'));
    const place = async (id, off = 0) => { G.querySelectorAll('.ps-pick')[(game.answerFor(puzzle, id) + off) % 4].click(); await wait(60); };`,
};

/**
 * Magic Square and Number Pyramid: type one wrong number, then the right
 * number for `count` blanks in turn (every blank, if no count is given).
 */
export const fillBlanks = (name, count = Infinity) => `
  const game = await import('/src/games/${name}.js');
  let state = game.start(game.generate(seed.seedFor(today, '${name}')));
  await type(999);
  for (let found = 0; found < ${count} && state.status === 'playing'; found++) {
    const cell = game.workable(state)[0];
    const value = game.answerFor(state.puzzle, cell);
    await type(value);
    state = game.check(state, { cell, value });
  }`;
