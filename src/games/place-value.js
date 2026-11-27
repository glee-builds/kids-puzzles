// place-value.js: what each digit of a number means.
//
// In 247 the 2 means 2 hundreds, the 4 means 4 tens, and the 7 means 7 ones.
// The blocks show it: a hundred is a big square, a ten is a tall bar, and a
// one is a small square. Each day has 4 rounds, of four kinds:
//   build    make a number out of blocks, with a − and a + for each kind
//   read     look at blocks and pick the number they make from 3 choices
//   compare  tap the bigger of two numbers that look alike
//   round    pick the nearest ten or hundred from 3 choices
//
//   level 1: two-digit numbers (tens and ones)
//   level 2: three-digit numbers; rounding to the nearest ten
//   level 3: some numbers have a zero, like 305; rounding to the nearest hundred

import { createRandom, forLevel } from '../seed.js';
import { nextRound } from '../rounds.js';
import { make, button, wiggle, roundFrame, markRight } from '../ui.js';

export const PLACES = ['hundreds', 'tens', 'ones'];
export const MAX_TRIES = 3; // tries at building a number before it's shown
// How many digits the numbers have, the kinds of round, and what to round to, at each level.
export const LEVELS = [
  { digits: 2, kinds: ['build', 'read', 'build', 'compare'] },
  { digits: 3, kinds: ['build', 'read', 'compare', 'round'], to: 10 },
  { digits: 3, zeros: true, kinds: ['read', 'build', 'round', 'compare'], to: 100 },
];

/** A number split into its places: places(247) is { hundreds: 2, tens: 4, ones: 7 }. */
export const places = (n) => ({ hundreds: Math.floor(n / 100), tens: Math.floor(n / 10) % 10, ones: n % 10 });

/** Round to the nearest ten or hundred; halfway goes up. roundTo(247, 10) is 250. */
export const roundTo = (n, to) => Math.round(n / to) * to;

const countText = (n, place) => `${n} ${n === 1 ? place.slice(0, -1) : place}`;

/** Blocks in words: "2 hundreds, 4 tens, and 7 ones". Two-digit numbers (`wide` false) leave out the hundreds. */
export function inWords(count, wide = true) {
  const [hundreds, tens, ones] = PLACES.map((place) => countText(count[place], place));
  return wide ? `${hundreds}, ${tens}, and ${ones}` : `${tens} and ${ones}`;
}

/** A number for this level. Only level 3 has zeros, and never two in one number. */
function number(random, { digits, zeros }) {
  const digit = () => random.int(1, 9);
  const lastTwo = [digit() * 10 + digit(), digit() * 10, digit()];
  return (digits === 3 ? digit() * 100 : 0) + (zeros ? random.pick(lastTwo) : lastTwo[0]);
}

/** The right answer and the first two wrong ones that fit, mixed up. */
function choicesFor(random, answer, wrong, fits) {
  const list = [answer];
  for (const n of wrong) if (list.length < 3 && !list.includes(n) && fits(n)) list.push(n);
  return random.shuffle(list);
}

const MAKERS = {
  build: (random, spec) => ({ kind: 'build', number: number(random, spec) }),
  read(random, spec) {
    const n = number(random, spec);
    const { hundreds: h, tens: t, ones: o } = places(n);
    // Wrong choices are the usual mistake, digits in the wrong places (247 as
    // 274 or 427), then near numbers if those don't have the right length.
    const swapped = [[h, o, t], [t, h, o], [o, t, h]].map(([a, b, c]) => a * 100 + b * 10 + c);
    const sameLength = (c) => String(c).length === spec.digits;
    return { kind: 'read', number: n, choices: choicesFor(random, n, [...swapped, n + 10, n - 10, n + 1, n - 1], sameLength) };
  },
  compare(random, spec) {
    const left = number(random, spec);
    const { hundreds, tens, ones } = places(left);
    // Half the time the last two digits are swapped (247 and 274). Otherwise,
    // or if swapping changes nothing (255), only the first digit is the same.
    const first = 10 ** (spec.digits - 1);
    let right = random.int(0, 1) === 0 ? left : hundreds * 100 + ones * 10 + tens;
    while (right === left) right = left - (left % first) + (number(random, spec) % first);
    return { kind: 'compare', left, right, answer: Math.max(left, right) };
  },
  round(random, spec) {
    const n = number(random, spec);
    const { to } = spec;
    const answer = roundTo(n, to);
    const other = answer > n ? answer - to : answer + to; // the neighbour on the other side
    // The third choice: rounding to the wrong place, or else one step further away.
    const wrong = [other, roundTo(n, to === 10 ? 100 : 10), Math.min(answer, other) - to, Math.max(answer, other) + to];
    return { kind: 'round', number: n, to, answer, choices: choicesFor(random, answer, wrong, (c) => c > 0 && c !== n) };
  },
};

/** Make today's 4 rounds from a seed and a level (1 to 3). No number comes up twice. */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const spec = forLevel(LEVELS, level);
  const used = new Set();
  const rounds = spec.kinds.map((kind) => {
    let round;
    do round = MAKERS[kind](random, spec); while (used.has(round.number ?? round.left));
    used.add(round.number ?? round.left);
    return round;
  });
  return { level, rounds };
}

/** The starting state: round 0. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/** Whether `answer` is right: { hundreds, tens, ones } blocks for a build round, or the number picked. */
export function isRight(round, answer) {
  if (round.kind !== 'build') return answer === (round.answer ?? round.number);
  const need = places(round.number);
  return PLACES.every((place) => answer[place] === need[place]);
}

/** Answer the current round. A miss stays on it; the third miss at building shows the blocks. */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  return nextRound(state, isRight(round, answer), { canShow: round.kind === 'build', maxTries: MAX_TRIES });
}

/** A hint after a miss: what the digits mean. */
export function hint(round, answer) {
  const wide = (round.number ?? round.left) >= 100;
  if (round.kind === 'build') return `${round.number} has ${inWords(places(round.number), wide)}. You have ${inWords(answer, wide)}.`;
  if (round.kind === 'read') return `Count each kind: ${inWords(places(round.number), wide)}. ${wide ? 'Hundreds come first, then tens' : 'Tens come first'}, then ones.`;
  if (round.kind === 'compare') {
    const [left, right] = [places(round.left), places(round.right)];
    const place = PLACES.find((name) => left[name] !== right[name]); // the first place that tells them apart
    const start = place === 'hundreds' || !wide ? 'Look' : `Both have ${countText(left.hundreds, 'hundreds')}, so look`;
    return `${start} at the ${place}: ${countText(left[place], place)} or ${countText(right[place], place)}?`;
  }
  const below = Math.floor(round.number / round.to) * round.to;
  const { tens, ones } = places(round.number);
  const next = round.to === 10 ? countText(ones, 'ones') : countText(tens, 'tens');
  return `${round.number} is between ${below} and ${below + round.to}. It has ${next}: 5 or more goes up, 4 or less goes down.`;
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  const spec = forLevel(LEVELS, level);
  if (!Array.isArray(rounds) || rounds.length !== spec.kinds.length) return { ok: false, problems: [`there must be ${spec.kinds.length} rounds`] };
  const fits = (n) => Number.isInteger(n) && String(n).length === spec.digits && (spec.zeros || !String(n).includes('0'));
  const threeWith = (round, answer) => round.choices?.length === 3 && new Set(round.choices).size === 3 && round.choices.includes(answer);
  rounds.forEach((round, i) => {
    const where = `round ${i + 1}`;
    if (round.kind !== spec.kinds[i]) problems.push(`${where} should be a "${spec.kinds[i]}" round`);
    if (round.kind === 'compare') {
      if (!fits(round.left) || !fits(round.right) || round.left === round.right) problems.push(`${where} needs two different numbers this level uses`);
      else if (round.answer !== Math.max(round.left, round.right)) problems.push(`${where}: the answer is wrong`);
      return;
    }
    if (!fits(round.number)) problems.push(`${where}: ${round.number} isn't a number this level uses`);
    if (round.kind === 'read' && !threeWith(round, round.number)) problems.push(`${where} needs 3 different choices, one right`);
    if (round.kind === 'round') {
      if (round.to !== spec.to || round.answer !== roundTo(round.number, round.to)) problems.push(`${where}: the answer is wrong`);
      if (!threeWith(round, round.answer)) problems.push(`${where} needs 3 different choices, one right`);
    }
  });
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/**
 * One kind of block: a pile of blocks over its name. set(n) draws n blocks.
 * With `counted`, the name also says how many ("3 tens").
 */
function column(place, counted) {
  const node = make('div', `pv-column pv-${place}`);
  const pile = node.appendChild(make('div', 'pv-pile'));
  const label = node.appendChild(make('span', 'pv-label', place));
  pile.setAttribute('role', 'img');
  const set = (n) => {
    pile.replaceChildren(...Array.from({ length: n }, () => make('span', 'pv-block')));
    pile.setAttribute('aria-label', countText(n, place));
    if (counted) label.textContent = countText(n, place);
  };
  return { node, set };
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong answers; helped is the numbers
 * that were built for the player.
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
  container.classList.add('pv');

  const frame = roundFrame(container, { count: puzzle.rounds.length, prefix: 'pv', draw: (i) => DRAW[puzzle.rounds[i].kind](puzzle.rounds[i]) });
  const { question, stage, message } = frame;
  const finishRound = (text) => {
    keep();
    frame.finish(text, state.round, () => onDone({ status: state.status, misses, helped: state.shown.length }));
  };
  // Two-digit numbers have no hundreds column.
  const placesFor = (n) => (n >= 100 ? PLACES : PLACES.slice(1));
  const big = (n) => make('strong', 'pv-number', n);

  /** Answer the round on screen. Returns what happened, after saying "not quite" for a plain miss. */
  function answer(round, value, node) {
    if (state.round !== puzzle.rounds.indexOf(round)) return null;
    state = check(state, value);
    if (!state.last.correct) misses += 1;
    if (!state.last.correct && !state.last.shown) {
      message.textContent = `Not quite. ${hint(round, value)}`;
      wiggle(node);
    }
    return state.last;
  }

  /** A row of number buttons; the right one finishes the round with `done`. */
  function choiceRow(round, numbers, done, extraClass = '') {
    const row = make('div', 'pv-choices');
    for (const n of numbers) {
      const choice = row.appendChild(button(`lw-button pv-choice ${extraClass}`.trim(), n, () => {
        if (!answer(round, n, choice)?.correct) return;
        markRight(choice);
        finishRound(done);
      }));
    }
    return row;
  }

  const DRAW = {
    // Make a number out of blocks.
    build(round) {
      question.append('Build ', big(round.number), '.');
      const need = places(round.number);
      const wide = round.number >= 100;
      const have = { hundreds: 0, tens: 0, ones: 0 };
      const board = make('div', 'pv-board');
      const columns = placesFor(round.number).map((place) => {
        const pile = column(place, true);
        const steps = pile.node.appendChild(make('div', 'pv-steps'));
        for (const [sign, by, words] of [['−', -1, 'Take away'], ['+', 1, 'Add']]) {
          const step = steps.appendChild(button(`lw-button pv-step pv-${by > 0 ? 'plus' : 'minus'}`, sign, () => {
            have[place] = Math.min(Math.max(have[place] + by, 0), 9); // a place holds 0 to 9
            pile.set(have[place]);
          }));
          step.setAttribute('aria-label', `${words} one ${place.slice(0, -1)}`);
        }
        pile.set(0);
        board.append(pile.node);
        return { place, pile };
      });
      const checkButton = button('lw-button pv-check', 'Check', () => {
        const result = answer(round, { ...have }, board);
        if (!result || (!result.correct && !result.shown)) return;
        for (const node of stage.querySelectorAll('button')) node.disabled = true;
        // Shown after 3 misses: build it for the player.
        for (const { place, pile } of columns) pile.set(need[place]);
        finishRound(result.correct ? `✓ ${inWords(need, wide)} make ${round.number}!` : `${round.number} is ${inWords(need, wide)}, like this.`);
      });
      stage.append(board, checkButton);
    },

    // Look at blocks and pick the number they make.
    read(round) {
      question.textContent = 'What number do the blocks make?';
      const need = places(round.number);
      const board = make('div', 'pv-board');
      for (const place of placesFor(round.number)) {
        const pile = column(place, false);
        pile.set(need[place]);
        board.append(pile.node);
      }
      stage.append(board, choiceRow(round, round.choices, `✓ ${inWords(need, round.number >= 100)} make ${round.number}.`));
    },

    // Tap the bigger of two numbers.
    compare(round) {
      question.textContent = 'Which is bigger?';
      const smaller = Math.min(round.left, round.right);
      stage.append(choiceRow(round, [round.left, round.right], `✓ ${round.answer} is bigger than ${smaller}.`, 'pv-big'));
    },

    // Pick the nearest ten or hundred.
    round(round) {
      question.append('Round ', big(round.number), ` to the nearest ${round.to === 10 ? 'ten' : 'hundred'}.`);
      stage.append(choiceRow(round, round.choices, `✓ ${round.number} rounds to ${round.answer}.`));
    },
  };

  frame.begin(state.round);
}
