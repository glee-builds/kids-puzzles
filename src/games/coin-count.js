// coin-count.js: count a handful of coins and type how many cents.
//
// Each day has 4 handfuls. The player types the total on the number pad.
//   level 1: pennies, nickels, and dimes, in order from biggest to smallest
//   level 2: quarters too, still in order
//   level 3: the coins are mixed up, and show their names instead of their
//            values (so "dime" has to mean 10)
// After 2 misses the hint counts on from the biggest coin; after 3 the
// total is shown.

import { nextRound } from '../rounds.js';
import { createRandom, forLevel } from '../seed.js';
import { make, numberPad, roundFrame } from '../ui.js';

export const HANDFULS = 4;
export const MAX_TRIES = 3;
export const COINS = { penny: 1, nickel: 5, dime: 10, quarter: 25 };
// For each level: which coins, how many in a handful (from, to), and the most cents.
export const LEVELS = [
  { coins: ['penny', 'nickel', 'dime'], count: [3, 5], most: 50 },
  { coins: ['penny', 'nickel', 'dime', 'quarter'], count: [3, 6], most: 99 },
  { coins: ['penny', 'nickel', 'dime', 'quarter'], count: [4, 7], most: 99, mixed: true, names: true },
];
const settingsFor = (level) => forLevel(LEVELS, level);

/** How many cents a list of coins is worth. */
export const totalOf = (coins) => coins.reduce((sum, coin) => sum + COINS[coin], 0);

const biggestFirst = (coins) => [...coins].sort((a, b) => COINS[b] - COINS[a]);

/** Make today's 4 handfuls from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const rules = settingsFor(level);
  const rounds = [];
  while (rounds.length < HANDFULS) {
    const count = random.int(...rules.count);
    const picked = Array.from({ length: count }, () => random.pick(rules.coins));
    const total = totalOf(picked);
    // At least two kinds of coin, not too many cents, and a new total each time.
    if (new Set(picked).size < 2 || total > rules.most || rounds.some((r) => r.total === total)) continue;
    rounds.push({ coins: rules.mixed ? random.shuffle(picked) : biggestFirst(picked), total, names: Boolean(rules.names) });
  }
  return { level, rounds };
}

/** The starting state: handful 0, no tries. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/** Answer the current handful with a number of cents. The third miss shows the total. */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the coins are counted.');
  const round = state.puzzle.rounds[state.round];
  const correct = Number(answer) === round.total;
  return nextRound(state, correct, { maxTries: MAX_TRIES });
}

/** Counting on from the biggest coin: "25, 35, 40, 41". */
export function countingOn(coins) {
  let sum = 0;
  return biggestFirst(coins).map((coin) => (sum += COINS[coin])).join(', ');
}

/** A hint for the current handful, stronger after each miss. */
export function hint(round, tries) {
  if (tries >= 2) return `Count on from the biggest coin: ${countingOn(round.coins)}.`;
  return round.names
    ? 'A quarter is 25¢, a dime is 10¢, a nickel is 5¢, and a penny is 1¢.'
    : 'Start with the biggest coin, then count on with the smaller ones.';
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  if (!Array.isArray(rounds) || rounds.length !== HANDFULS) return { ok: false, problems: [`there must be ${HANDFULS} handfuls`] };
  const rules = settingsFor(level);
  rounds.forEach(({ coins, total }, i) => {
    if (coins.some((coin) => !rules.coins.includes(coin))) problems.push(`handful ${i + 1} has a coin that isn't in level ${level}`);
    if (coins.length < rules.count[0] || coins.length > rules.count[1]) problems.push(`handful ${i + 1} has ${coins.length} coins`);
    if (totalOf(coins) !== total) problems.push(`handful ${i + 1}: the coins make ${totalOf(coins)}, not ${total}`);
    if (total > rules.most) problems.push(`handful ${i + 1}: ${total} is over ${rules.most}`);
    if (new Set(coins).size < 2) problems.push(`handful ${i + 1} needs two kinds of coin`);
  });
  if (new Set(rounds.map((r) => r.total)).size !== rounds.length) problems.push('two handfuls have the same total');
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

const CHEERS = ['You counted it!', 'Right on the money!', 'Great counting!', 'Yes!'];

/** One coin: a circle with its value (or its name), bigger for bigger coins. */
function coinNode(coin, names) {
  const node = make('span', `cc-coin cc-${coin}`, names ? coin : `${COINS[coin]}¢`);
  node.setAttribute('aria-label', names ? coin : `${coin}, ${COINS[coin]} cents`);
  return node;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong totals; helped is the totals shown.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round, shown: session.saved.shown || [] };
    misses = session.saved.misses;
  }
  const keep = () => session.save?.({ round: state.round, misses, shown: state.shown });
  let waiting = false; // a handful is finished and Next hasn't been pressed
  container.replaceChildren();
  container.classList.add('cc');

  const entry = make('p', 'cc-entry');
  const drawEntry = () => { entry.textContent = `${pad.typed || '?'}¢`; };

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'cc',
    draw(i) {
      const round = puzzle.rounds[i];
      waiting = false;
      pad.set('');
      question.textContent = 'How many cents?';
      const coins = make('div', 'cc-coins');
      for (const coin of round.coins) coins.append(coinNode(coin, round.names));
      drawEntry();
      entry.classList.remove('cc-entry-right', 'cc-entry-shown');
      stage.append(coins, entry);
    },
  });
  const { question, stage, message } = frame;

  function submit() {
    if (waiting || state.status !== 'playing') return;
    if (pad.typed === '') {
      message.textContent = 'Type a number, then press Check.';
      return;
    }
    const round = puzzle.rounds[state.round];
    state = check(state, Number(pad.typed));
    const { correct, shown } = state.last;
    if (!correct) misses += 1;
    if (!correct && !shown) {
      pad.set('');
      drawEntry();
      message.textContent = `Not quite. ${hint(round, state.tries)}`;
      return;
    }
    waiting = true;
    pad.set(String(round.total));
    drawEntry();
    entry.classList.add(correct ? 'cc-entry-right' : 'cc-entry-shown');
    const text = correct
      ? `✓ ${CHEERS[state.last.round % CHEERS.length]} ${countingOn(round.coins)}.`
      : `It's ${round.total}¢. Count on: ${countingOn(round.coins)}.`;
    keep();
    frame.finish(text, state.round, () => {
      pad.stop();
      onDone({ status: state.status, misses, helped: state.shown.length });
    });
  }

  const pad = numberPad(container, {
    maxDigits: 2,
    canType: () => !waiting && state.status === 'playing',
    onType() {
      message.textContent = '';
      drawEntry();
    },
    onCheck: submit,
  });
  container.append(pad.node);

  frame.begin(state.round);
}
