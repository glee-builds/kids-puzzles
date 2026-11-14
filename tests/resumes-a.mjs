// More half-done checks for tests/screens.mjs (see RESUMES there).
// Each entry: a puzzle's name, with `play` (JavaScript that plays part of
// it) and `check` (a JavaScript expression that is true if, after the page
// is loaded again, the puzzle picked up where it left off).
export default {
  // Spell the first word with Hint (each press puts one letter in place), then get one letter of the second.
  'letter-scramble': {
    play: `const hint = () => G.querySelectorAll('.ls-buttons button')[1].click();
      for (let tries = 0; tries < 20 && !G.querySelector('.ls-found-done'); tries++) { hint(); await wait(300); }
      await wait(1000); hint(); await wait();`,
    check: `G.querySelectorAll('.ls-found-done').length === 1 && G.querySelectorAll('.ls-box-locked').length === 1`,
  },
  // Put the first story in order, go on to the second, and get its first sentence from Hint.
  'story-order': {
    play: `const game = await import('/src/games/story-order.js');
      const { stories } = await (await fetch('/data/stories.json')).json();
      const [first] = game.generate(seed.seedFor(today, 'story-order'), stories, dayNumber).items;
      for (const sentence of first.sentences) {
        [...G.querySelectorAll('.so-card')].find((card) => card.textContent === sentence).click(); await wait();
      }
      await wait(500); G.querySelector('.lw-enter').click(); await wait();
      G.querySelector('.button-row .lw-button').click(); await wait();`,
    check: `doneDots(1) && G.querySelectorAll('.so-slot-locked').length === 1 && G.querySelectorAll('.so-card').length === 3`,
  },
  // Climb the first ladder with Hint (two presses a step), go on to the second, and take one step.
  'word-ladder': {
    play: `const hint = () => G.querySelectorAll('.button-row .lw-button')[1].click();
      for (let tries = 0; tries < 20 && G.querySelector('.lw-enter').hidden; tries++) { hint(); await wait(); }
      G.querySelector('.lw-enter').click(); await wait();
      hint(); await wait(); hint(); await wait();`,
    check: `doneDots(1) && G.querySelectorAll('.wl-rung').length > 2 && !G.querySelector('.button-row .lw-button').disabled
      && G.querySelector('.wl-rung-start').getAttribute('aria-label') !== G.querySelector('.wl-rung-now').textContent`,
  },
  // Finish the first step, and answer the second without tapping Next.
  'word-clues': {
    play: `await tapUntilRight('.wc-choice'); await next(); await tapUntilRight('.wc-choice');`,
    check: `G.querySelector('.count-line').textContent === 'Story 2 of 2' && Boolean(G.querySelector('.wc-right')) && !G.querySelector('.next-button').hidden`,
  },
  // Fix the first sentence, then find the wrong word in the second (but don't fix it yet).
  'fix-sentence': {
    play: `const game = await import('/src/games/fix-sentence.js');
      const { sentences } = await (await fetch('/data/fix-sentences.json')).json();
      const items = game.generate(seed.seedFor(today, 'fix-sentence'), sentences, dayNumber).items;
      G.querySelectorAll('.fs-word')[items[0].wrong].click(); await wait();
      await tapUntilRight('.wc-choice'); await next();
      G.querySelectorAll('.fs-word')[items[1].wrong].click(); await wait();`,
    check: `G.querySelector('.count-line').textContent.startsWith('Sentence 2 of') && Boolean(G.querySelector('.fs-wrong')) && G.querySelectorAll('.wc-choice').length === 3`,
  },
};
