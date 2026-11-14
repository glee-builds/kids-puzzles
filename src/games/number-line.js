// number-line.js: a frog hops along a number line. Where does it land?
//
// Each day has 5 hops from a starting number, like +10, -3, +20, +5, -10.
// The player types where the frog lands after each hop. Hops mix tens
// (change the tens digit) and ones (count on or back), and the frog always
// stays between 0 and 100.

import { createRandom } from '../seed.js';
import { make, button, liveMessage, numberPad } from '../ui.js';

export const HOPS = 5;
export const MIN = 0;
export const MAX = 100;
export const MAX_TRIES = 3; // after this many misses the frog hops there itself

const TENS = [10, 20];
const ONES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Make today's hops from a seed. */
export function generate(seed) {
  const random = createRandom(seed);
  // At least 2 tens hops and 2 ones hops; at least one back and one forward.
  const sizes = random.shuffle([TENS, TENS, ONES, ONES, random.pick([TENS, ONES])]);
  const [back, forward] = random.shuffle([0, 1, 2, 3, 4]);
  const hops = sizes.map((choices, i) => ({
    op: i === back ? '-' : i === forward ? '+' : random.int(0, 2) === 0 ? '-' : '+',
    amount: random.pick(choices),
  }));
  // Then start where every landing spot stays between 0 and 100 (and not
  // right at either end). There's always room: the hops spread at most 80.
  const offsets = positions({ start: 0, hops });
  const start = random.int(Math.max(5, MIN - Math.min(...offsets)), Math.min(95, MAX - Math.max(...offsets)));
  return { start, hops };
}

/** Where the frog is before hop 0, after hop 0, after hop 1, and so on. */
export function positions(puzzle) {
  const spots = [puzzle.start];
  for (const { op, amount } of puzzle.hops) {
    const at = spots[spots.length - 1];
    spots.push(op === '+' ? at + amount : at - amount);
  }
  return spots;
}

export const isTens = (amount) => amount % 10 === 0;

/** The starting state: on hop 0, no misses. */
export function start(puzzle) {
  return { puzzle, hop: 0, tries: {}, revealed: [], status: 'playing', last: null };
}

/**
 * Answer where the frog lands on the current hop. Returns the new state;
 * state.last says what happened: { hop, correct, revealed }.
 */
export function check(state, value) {
  if (state.status !== 'playing') throw new Error('All the hops are done.');
  const { hop } = state;
  const answer = positions(state.puzzle)[hop + 1];
  const tries = { ...state.tries };
  const revealed = [...state.revealed];
  const correct = Number(value) === answer;
  let wasRevealed = false;
  let next = hop;

  if (correct) {
    next = hop + 1;
  } else {
    tries[hop] = (tries[hop] || 0) + 1;
    if (tries[hop] >= MAX_TRIES) {
      revealed.push(hop);
      wasRevealed = true;
      next = hop + 1;
    }
  }

  const done = next >= state.puzzle.hops.length;
  return {
    ...state,
    hop: next,
    tries,
    revealed,
    status: done ? 'won' : 'playing',
    last: { hop, correct, revealed: wasRevealed },
  };
}

/**
 * A hint for the current hop, stronger after each miss:
 *   0-1 misses: a strategy (tens: change the tens digit; ones: count on/back)
 *   2+ misses:  the number sentence ("34 + 10 = ?")
 */
export function hint(state) {
  const { hop } = state;
  const { op, amount } = state.puzzle.hops[hop];
  const from = positions(state.puzzle)[hop];
  if ((state.tries[hop] || 0) >= 2) return `${from} ${op === '+' ? '+' : '−'} ${amount} = ?`;
  if (isTens(amount)) {
    const tens = amount / 10;
    const word = tens === 1 ? 'one ten' : `${tens} tens`;
    return op === '+' ? `${op}${amount} means ${word} more. Change the tens digit.`
      : `−${amount} means ${word} less. Change the tens digit.`;
  }
  return op === '+' ? `Count on ${amount} from ${from}.` : `Count back ${amount} from ${from}.`;
}

/** Confirm a set of hops is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { start: from, hops } = puzzle;
  if (!Number.isInteger(from) || from < MIN || from > MAX) problems.push(`start ${from} is outside 0 to 100`);
  if (!Array.isArray(hops) || hops.length !== HOPS) {
    return { ok: false, problems: [...problems, `there must be ${HOPS} hops`] };
  }
  for (const { op, amount } of hops) {
    if (op !== '+' && op !== '-') problems.push(`hop sign "${op}" must be + or -`);
    if (![...TENS, ...ONES].includes(amount)) problems.push(`hop size ${amount} is not allowed`);
  }
  if (positions(puzzle).some((p) => p < MIN || p > MAX)) problems.push('the frog leaves 0 to 100');
  const tens = hops.filter((h) => isTens(h.amount)).length;
  if (tens < 2) problems.push('needs at least 2 tens hops');
  if (hops.length - tens < 2) problems.push('needs at least 2 ones hops');
  if (!hops.some((h) => h.op === '-')) problems.push('needs at least one hop backward');
  if (!hops.some((h) => h.op === '+')) problems.push('needs at least one hop forward');
  return { ok: problems.length === 0, problems };
}

/**
 * The stretch of the number line to show for a hop: from a multiple of 10
 * at or below both numbers, to a multiple of 10 at or above both, at least
 * 20 wide. Both the frog and where it lands are always inside.
 */
export function windowFor(from, to) {
  let lo = Math.floor(Math.min(from, to) / 10) * 10;
  let hi = Math.ceil((Math.max(from, to) + 1) / 10) * 10;
  if (hi - lo < 20) hi = lo + 20;
  if (hi > MAX) {
    hi = MAX;
    lo = Math.min(lo, MAX - 20);
  }
  return { lo, hi };
}

// ---------------------------------------------------------------------------
// The screen: number line with the frog, the hop card, and a number pad.
// ---------------------------------------------------------------------------

const CHEERS = ['Hop! Yes!', 'Great counting!', 'You got it!', 'Nice jump!', 'Correct!'];

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: how many wrong answers, and how many answers were shown.
 */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let typed = '';
  let frogAt = puzzle.start;
  let cheerCount = 0;
  const spots = positions(puzzle);

  container.replaceChildren();
  container.classList.add('nl');

  const dots = make('div', 'nl-dots');
  const dotNodes = puzzle.hops.map(() => {
    const dot = make('span', 'nl-dot');
    dots.append(dot);
    return dot;
  });

  const line = make('div', 'nl-line');
  const ticks = make('div', 'nl-ticks');
  const frog = make('img', 'nl-frog');
  frog.src = 'assets/frog.svg';
  frog.alt = ''; // the line's label already says where the frog is
  line.append(ticks, frog);

  const card = make('div', 'nl-card');
  const message = liveMessage('nl-message', 'Where will the frog land?');

  const { node: pad, stop: stopKeys } = numberPad(container, { onDigit: typeDigit, onErase: erase, onCheck: submit });

  container.append(dots, line, card, message, pad);

  let view = windowFor(spots[0], spots[1]);

  function drawLine() {
    ticks.replaceChildren();
    const width = view.hi - view.lo;
    for (let n = view.lo; n <= view.hi; n++) {
      const tick = make('span', 'nl-tick' + (n % 10 === 0 ? ' nl-tick-ten' : n % 5 === 0 ? ' nl-tick-five' : ''));
      tick.style.left = `${((n - view.lo) / width) * 100}%`;
      if (n % 10 === 0) tick.append(make('span', 'nl-label', String(n)));
      ticks.append(tick);
    }
    frog.style.left = `${((frogAt - view.lo) / width) * 100}%`;
    line.setAttribute('aria-label', `Number line from ${view.lo} to ${view.hi}. The frog is on ${frogAt}.`);
  }

  function drawCard() {
    card.replaceChildren();
    if (state.status !== 'playing') return;
    const { op, amount } = puzzle.hops[state.hop];
    card.append(
      make('span', 'nl-from', String(spots[state.hop])),
      make('span', `nl-hop ${op === '+' ? 'nl-hop-plus' : 'nl-hop-minus'}`, `${op === '+' ? '+' : '−'}${amount}`),
      make('span', 'nl-arrow', '→'),
      make('span', 'nl-answer', typed || '?'),
    );
    dotNodes.forEach((dot, i) => {
      dot.className = 'nl-dot'
        + (i < state.hop ? (state.revealed.includes(i) ? ' nl-dot-shown' : ' nl-dot-done') : '')
        + (i === state.hop ? ' nl-dot-now' : '');
    });
  }

  function typeDigit(digit) {
    if (state.status !== 'playing' || typed.length >= 3) return;
    typed = typed === '0' ? digit : typed + digit;
    drawCard();
  }

  function erase() {
    typed = typed.slice(0, -1);
    drawCard();
  }

  function submit() {
    if (state.status !== 'playing') return;
    if (typed === '') {
      message.textContent = 'Type a number, then press Check.';
      return;
    }
    state = check(state, Number(typed));
    typed = '';
    const { hop, correct, revealed } = state.last;

    if (correct || revealed) {
      frogAt = spots[hop + 1];
      message.textContent = correct
        ? CHEERS[cheerCount++ % CHEERS.length]
        : `The frog lands on ${frogAt}. On to the next hop!`;
      // Let the frog hop on the current line, then move the line if needed.
      frog.classList.remove('nl-frog-jump');
      void frog.offsetWidth;
      frog.classList.add('nl-frog-jump');
      drawLine();
      if (state.status === 'playing') {
        const nextView = windowFor(spots[state.hop], spots[state.hop + 1]);
        if (nextView.lo !== view.lo || nextView.hi !== view.hi) {
          setTimeout(() => { view = nextView; drawLine(); }, 600);
        }
      }
    } else {
      message.textContent = `Not quite. ${hint(state)}`;
    }
    drawCard();

    if (state.status === 'won') {
      dotNodes.forEach((dot, i) => {
        dot.className = 'nl-dot ' + (state.revealed.includes(i) ? 'nl-dot-shown' : 'nl-dot-done');
      });
      message.textContent = 'The frog finished all its hops!';
      stopKeys();
      container.classList.add('finished');
      // Every wrong answer is in state.tries; every answer shown is in state.revealed.
      const misses = Object.values(state.tries).reduce((sum, n) => sum + n, 0);
      onDone({ status: state.status, misses, helped: state.revealed.length });
    }
  }


  drawLine();
  drawCard();
}
