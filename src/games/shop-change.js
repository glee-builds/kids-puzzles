// shop-change.js: run a shop counter and give the right change.
//
// A customer buys something and pays with 2 quarters or a dollar bill.
// Each day has 4 rounds.
//   level 1: prices in 5s, paid with 50¢ or $1.00; pick the change from 3
//            choices, then give it in coins (2 customers, 2 rounds each)
//   level 2: any price, paid with $1.00; make the change by tapping coins
//   level 3: two things bought together; first pick what both cost, then
//            make the change (2 customers, 2 rounds each)
// The hints teach counting up from the price to what was paid. On a coin
// round the third miss shows one way to make the change.

import { nextRound } from '../rounds.js';
import { createRandom, forLevel } from '../seed.js';
import { make, button, wiggle, markRight, roundFrame } from '../ui.js';
import { COINS, totalOf } from './coin-count.js';

export const ROUNDS = 4;
export const MAX_TRIES = 3;
export const HAND_FULL = 10; // more coins than this won't fit on a phone
// For each level: what the customer can pay with, how many things they
// buy, what prices count by, and the kinds of round each customer gives.
export const LEVELS = [
  { paid: [50, 100], items: 1, step: 5, kinds: ['change', 'make'] },
  { paid: [100], items: 1, step: 1, kinds: ['make'] },
  { paid: [100], items: 2, step: 1, kinds: ['total', 'make'] },
];
const LEAST = 10; // nothing in the shop is cheaper than this
const PAYS_WITH = { 50: '2 quarters', 100: 'a dollar bill' };
const ITEMS = [
  ['🍎', 'apple'], ['🍌', 'banana'], ['🍪', 'cookie'], ['🥕', 'carrot'], ['🍋', 'lemon'], ['🧁', 'cupcake'],
  ['🥨', 'pretzel'], ['🍩', 'donut'], ['🥚', 'egg'], ['🍐', 'pear'], ['🍊', 'orange'], ['✏️', 'pencil'],
  ['🎈', 'balloon'], ['🥛', 'milk'], ['🍑', 'peach'], ['🍭', 'lollipop'],
];

/** Cents as money text: money(35) is "35¢" and money(100) is "$1.00". */
export const money = (cents) => (cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents}¢`);

/**
 * Count up from the price to what was paid, the way a shopkeeper does:
 * pennies to the next 5, a nickel or dimes to the next quarter mark (25,
 * 50, 75), then quarters. Returns the steps: [{ coin: 'nickel', at: 40 }, ...].
 */
export function countUp(price, paid) {
  const steps = [];
  for (let at = price; at < paid;) {
    const gap = 25 - (at % 25); // how far to the next quarter mark
    const coin = at % 5 ? 'penny' : gap === 25 ? 'quarter' : gap % 10 ? 'nickel' : 'dime';
    at += COINS[coin];
    steps.push({ coin, at });
  }
  return steps;
}

/** The right answer and the first two wrong ones that work, in a mixed order. */
function choicesFor(random, right, wrongs) {
  const usable = wrongs.filter((cents, i) => cents > 0 && cents < 100 && cents !== right && wrongs.indexOf(cents) === i);
  return random.shuffle([right, ...usable.slice(0, 2)]);
}

/** Make today's 4 rounds from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const rules = forLevel(LEVELS, level);
  const rounds = [];
  while (rounds.length < ROUNDS) {
    const paid = random.pick(rules.paid);
    // Each price leaves room for the others, so the total stays under what was paid.
    const most = Math.floor((paid - 1) / rules.items / rules.step);
    const items = random.shuffle(ITEMS).slice(0, rules.items).map(([emoji, name]) => (
      { emoji, name, price: rules.step * random.int(LEAST / rules.step, most) }
    ));
    const price = items.reduce((sum, item) => sum + item.price, 0);
    // A new price and a new thing for each customer.
    if (rounds.some((r) => r.price === price || r.items[0].name === items[0].name)) continue;
    const change = paid - price;
    for (const kind of rules.kinds) {
      const round = { kind, items, price, paid, answer: kind === 'total' ? price : change };
      // Wrong choices are real slips: giving the price back, or being 10¢ (or 1¢) off.
      if (kind === 'change') round.choices = choicesFor(random, change, [price, ...random.shuffle([change + 10, change - 10])]);
      if (kind === 'total') round.choices = choicesFor(random, price, random.shuffle([price + 10, price - 10, price + 1, price - 1]));
      rounds.push(round);
    }
  }
  return { level, rounds };
}

/** The starting state: round 0, no tries. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/**
 * Answer the current round with a number of cents (a choice) or a list of
 * coins (any coins with the right total are right). Only a coin round shows
 * its answer after the third miss: a choice round has just 3 choices.
 */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('The shop is closed for today.');
  const round = state.puzzle.rounds[state.round];
  const cents = Array.isArray(answer) ? totalOf(answer) : Number(answer);
  return nextRound(state, cents === round.answer, { canShow: round.kind === 'make', maxTries: MAX_TRIES });
}

/** The numbers said while counting up: "40, 50, 75, $1.00". */
export const countSteps = ({ price, paid }) => countUp(price, paid).map((step) => (step.at < paid ? step.at : money(paid))).join(', ');

/** "The apple is 35¢. Count up to $1.00: 40, 50, 75, $1.00. That is 5¢ + 10¢ + 25¢ + 25¢." */
export function countingUp(round) {
  const { items, price, paid } = round;
  const what = items.length > 1 ? 'Both cost' : `The ${items[0].name} is`;
  const coins = countUp(price, paid).map((step) => money(COINS[step.coin])).join(' + ');
  return `${what} ${money(price)}. Count up to ${money(paid)}: ${countSteps(round)}. That is ${coins}.`;
}

/** A hint for the current round, stronger after the second miss. */
export function hint(round, tries) {
  if (round.kind === 'total') {
    const [a, b] = round.items.map((item) => item.price);
    return tries < 2
      ? 'Add the tens first, then the ones.'
      : `Tens: ${a - (a % 10)} + ${b - (b % 10)} = ${a + b - (a % 10) - (b % 10)}. Ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}. Put them together.`;
  }
  return tries < 2 ? `Start at ${money(round.price)} and count up to ${money(round.paid)}.` : countingUp(round);
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS) return { ok: false, problems: [`there must be ${ROUNDS} rounds`] };
  const rules = forLevel(LEVELS, level);
  rounds.forEach(({ kind, items, price, paid, answer, choices }, i) => {
    const say = (problem) => problems.push(`round ${i + 1}: ${problem}`);
    if (kind !== rules.kinds[i % rules.kinds.length]) say(`"${kind}" is out of place in level ${level}`);
    if (items.length !== rules.items) say(`${items.length} things to buy`);
    if (items.some((item) => !Number.isInteger(item.price) || item.price < 1 || item.price % rules.step)) say('a price that is not allowed');
    if (items.reduce((sum, item) => sum + item.price, 0) !== price) say(`the prices do not add up to ${price}`);
    if (!rules.paid.includes(paid) || price >= paid) say(`${price} paid with ${paid}`);
    if (answer !== (kind === 'total' ? price : paid - price)) say(`the answer is not ${answer}`);
    // The change can be made with real coins (this is the answer the game shows).
    if (totalOf(countUp(price, paid).map((step) => step.coin)) !== paid - price) say('counting up does not reach what was paid');
    if (kind !== 'make' && (choices?.length !== 3 || new Set(choices).size !== 3 || !choices.includes(answer))) {
      say('needs 3 different choices, one right');
    }
  });
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

const QUESTIONS = { change: 'How much change?', total: 'How much for both?', make: 'Make the change with coins.' };
// After picking the change, the same customer's coin round says how much to give.
const giveCoins = (round) => `Give ${money(round.answer)} change in coins.`;

/** One coin button: a circle with its value written on it. */
function coinButton(coin, label, onClick) {
  const node = button(`sc-coin sc-${coin}`, money(COINS[coin]), onClick);
  node.setAttribute('aria-label', `${label} ${coin}, ${COINS[coin]} cent${COINS[coin] === 1 ? '' : 's'}`);
  return node;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong answers; helped is the answers shown.
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
  container.replaceChildren();
  container.classList.add('sc');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'sc',
    draw(i) {
      const round = puzzle.rounds[i];
      const open = () => state.round === i; // false once this round is finished
      question.textContent = round.kind === 'make' && puzzle.rounds[i - 1]?.kind === 'change' ? giveCoins(round) : QUESTIONS[round.kind];
      const counter = make('div', 'sc-counter');
      for (const item of round.items) {
        const card = counter.appendChild(make('div', 'sc-item'));
        card.append(make('span', 'sc-emoji', item.emoji), make('span', 'sc-tag', `${item.name} ${money(item.price)}`));
      }
      stage.append(counter, make('p', 'sc-paid', `💵 Pays with ${PAYS_WITH[round.paid]}: ${money(round.paid)}`));

      /** Try an answer. A miss wiggles `node` and gives a hint; returns true when the round is over. */
      function answer(value, node, missStart = 'Not quite.') {
        state = check(state, value);
        const { correct, shown } = state.last;
        if (!correct) misses += 1;
        if (!correct && !shown) {
          wiggle(node);
          message.textContent = `${missStart} ${hint(round, state.tries)}`;
          return false;
        }
        const text = round.kind === 'total' ? `✓ Yes! Both cost ${money(round.price)}.`
          : `${shown ? 'Here is one way to make' : '✓'} ${money(round.answer)} change. Count up: ${countSteps(round)}.`;
        keep();
        frame.finish(text, state.round, () => onDone({ status: state.status, misses, helped: state.shown.length }));
        return true;
      }

      if (round.kind !== 'make') {
        const row = stage.appendChild(make('div', 'sc-choices'));
        for (const cents of round.choices) {
          const choice = row.appendChild(button('lw-button sc-choice', money(cents), () => {
            if (open() && answer(cents, choice)) markRight(choice);
          }));
        }
        return;
      }

      // A coin round: the tray adds a coin to the hand; tapping a coin in the hand puts it back.
      let hand = [];
      const handRow = make('div', 'sc-hand');
      function drawHand() {
        handRow.replaceChildren(...hand.map((coin, at) => coinButton(coin, 'Put back a', () => {
          if (!open()) return;
          hand.splice(at, 1);
          drawHand();
        })));
        if (!hand.length) handRow.append(make('span', 'sc-empty', 'Tap coins to add them here.'));
      }
      const tray = make('div', 'sc-tray');
      for (const coin of ['quarter', 'dime', 'nickel', 'penny']) {
        tray.append(coinButton(coin, 'Add a', () => {
          if (!open()) return;
          if (hand.length >= HAND_FULL) {
            message.textContent = 'That is a lot of coins! Tap one to put it back, and try a bigger coin.';
            return;
          }
          hand.push(coin);
          message.textContent = '';
          drawHand();
        }));
      }
      tray.append(button('lw-button sc-check', 'Check', () => {
        if (!open()) return;
        if (!hand.length) {
          message.textContent = 'Tap coins to add them, then press Check.';
          return;
        }
        // The first miss says what the coins make; the second has a longer hint, so it leaves that out.
        const over = answer(hand, handRow, state.tries ? 'Not quite.' : `Your coins make ${money(totalOf(hand))}.`);
        if (over && state.last.shown) hand = countUp(round.price, round.paid).map((step) => step.coin);
        if (over) {
          drawHand();
          handRow.classList.add(state.last.shown ? 'sc-hand-shown' : 'sc-hand-right');
        }
      }));
      drawHand();
      stage.append(handRow, tray);
    },
  });
  const { question, stage, message } = frame;
  frame.begin(state.round);
}
