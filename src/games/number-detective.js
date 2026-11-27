// number-detective.js: find the one number that fits every clue.
//
// Each day has 3 mysteries. A mystery shows 3 or 4 clues ("I am even.") and
// 12 suspect numbers. Exactly one suspect fits every clue. A wrong tap says
// which clue that number breaks, and the number is crossed out.
//   level 1: numbers 10 to 50; odd or even, more or less than, between,
//            the tens digit, counting by 2s, 5s or 10s
//   level 2: numbers 10 to 99; also the ones digit, what the digits add up
//            to, counting by 3s or 4s
//   level 3: numbers 10 to 200; also counting by 6s, a tens digit bigger
//            than the ones digit, and adding or taking away 10
// Every clue is needed: for each clue, some suspect breaks only that one.

import { createRandom, forLevel } from '../seed.js';
import { make, button, wiggle, roundFrame, markRight } from '../ui.js';
import { nextRound } from '../rounds.js';

export const MYSTERIES = 3;
export const SUSPECTS = 12;

const LEVEL_1 = ['even', 'odd', 'more', 'less', 'between', 'tens', 'countBy'];
const LEVEL_2 = [...LEVEL_1, 'ones', 'digitSum'];
// The numbers each level uses, its kinds of clue, and what it counts by.
export const LEVELS = [
  { low: 10, high: 50, kinds: LEVEL_1, steps: [2, 5, 10] },
  { low: 10, high: 99, kinds: LEVEL_2, steps: [2, 5, 10, 3, 4] },
  { low: 10, high: 200, kinds: [...LEVEL_2, 'tensBigger', 'plusTen', 'minusTen'], steps: [2, 5, 10, 3, 4, 6] },
];

const digits = (n) => String(n).split('').map(Number);
const digitSum = (n) => digits(n).reduce((sum, digit) => sum + digit, 0);
const tens = (n) => Math.floor(n / 10) % 10;
const ones = (n) => n % 10;

// The two clues about one digit: "My tens digit is 4." and "My ones digit is 6."
const digitClue = (place, digitOf) => ({
  make: (n) => ({ digit: digitOf(n) }),
  fits: (c, n) => digitOf(n) === c.digit,
  text: (c) => `My ${place} digit is ${c.digit}.`,
  proof: (c) => `${place} digit ${c.digit}`,
  miss: (c, n) => `The ${place} digit of ${n} is ${digitOf(n)}, not ${c.digit}.`,
});

// Every kind of clue. For a clue `c` and a number `n`:
//   make   the clue's own numbers for the answer `n` (null if `n` can't have this clue)
//   fits   true if `n` fits the clue
//   text   the clue as a sentence
//   proof  a few words that show `n` fits, for the message after a right answer
//   miss   a sentence that shows `n` breaks it (when left out: "n is not <proof>.")
const KINDS = {
  even: { make: (n) => (n % 2 === 0 ? {} : null), fits: (c, n) => n % 2 === 0, text: () => 'I am even.', proof: () => 'even' },
  odd: { make: (n) => (n % 2 === 1 ? {} : null), fits: (c, n) => n % 2 === 1, text: () => 'I am odd.', proof: () => 'odd' },
  more: {
    make: (n, random) => ({ than: n - random.int(1, 9) }),
    fits: (c, n) => n > c.than,
    text: (c) => `I am more than ${c.than}.`,
    proof: (c) => `more than ${c.than}`,
  },
  less: {
    make: (n, random) => ({ than: n + random.int(1, 9) }),
    fits: (c, n) => n < c.than,
    text: (c) => `I am less than ${c.than}.`,
    proof: (c) => `less than ${c.than}`,
  },
  // The two ends are round numbers (40 and 60), one or two tens apart from the answer's ten.
  between: {
    make: (n, random) => ({
      low: 10 * (Math.floor((n - 1) / 10) - random.int(0, 1)),
      high: 10 * (Math.ceil((n + 1) / 10) + random.int(0, 1)),
    }),
    fits: (c, n) => n > c.low && n < c.high,
    text: (c) => `I am between ${c.low} and ${c.high}.`,
    proof: (c) => `between ${c.low} and ${c.high}`,
  },
  tens: digitClue('tens', tens),
  ones: digitClue('ones', ones),
  digitSum: {
    make: (n) => ({ sum: digitSum(n) }),
    fits: (c, n) => digitSum(n) === c.sum,
    text: (c) => `My digits add up to ${c.sum}.`,
    proof: (c, n) => `${digits(n).join(' + ')} = ${c.sum}`,
    miss: (c, n) => `${digits(n).join(' + ')} = ${digitSum(n)}, not ${c.sum}.`,
  },
  countBy: {
    make(n, random, steps) {
      const said = steps.filter((step) => n % step === 0);
      return said.length ? { step: random.pick(said) } : null;
    },
    fits: (c, n) => n % c.step === 0,
    text: (c) => `You say me when you count by ${c.step}s.`,
    proof: (c) => `a count-by-${c.step}s number`,
  },
  tensBigger: {
    make: (n) => (tens(n) > ones(n) ? {} : null),
    fits: (c, n) => tens(n) > ones(n),
    text: () => 'My tens digit is bigger than my ones digit.',
    proof: (c, n) => `tens ${tens(n)} is bigger than ones ${ones(n)}`,
    miss: (c, n) => `In ${n}, the tens digit ${tens(n)} is not bigger than the ones digit ${ones(n)}.`,
  },
  // "I am 10 more than 36" would give the answer away by itself, so these two
  // ask for 10 more or 10 less in the head, then compare.
  plusTen: {
    make: (n, random) => ({ over: n + 10 - random.int(1, 9) }),
    fits: (c, n) => n + 10 > c.over,
    text: (c) => `Add 10 to me and you get more than ${c.over}.`,
    proof: (c, n) => `${n} + 10 is more than ${c.over}`,
    miss: (c, n) => `${n} + 10 = ${n + 10}. That is not more than ${c.over}.`,
  },
  minusTen: {
    make: (n, random) => ({ under: n - 10 + random.int(1, 9) }),
    fits: (c, n) => n - 10 < c.under,
    text: (c) => `Take 10 from me and you get less than ${c.under}.`,
    proof: (c, n) => `${n} − 10 is less than ${c.under}`,
    miss: (c, n) => `${n} − 10 = ${n - 10}. That is not less than ${c.under}.`,
  },
};

/** True if the number `n` fits the clue. */
export const fits = (clue, n) => KINDS[clue.kind].fits(clue, n);

/** The clue as a sentence: clueText({ kind: 'even' }) is "I am even." */
export const clueText = (clue) => KINDS[clue.kind].text(clue);

/** Why `n` breaks the clue: "37 is not even." */
export function whyNot(clue, n) {
  const kind = KINDS[clue.kind];
  return kind.miss ? kind.miss(clue, n) : `${n} is not ${kind.proof(clue, n)}.`;
}

/** The message after a right answer: "✓ 46! Between 40 and 60, even, and 4 + 6 = 10." */
export function solvedText({ clues, answer }) {
  const facts = clues.map((clue) => KINDS[clue.kind].proof(clue, answer));
  const list = `${facts.slice(0, -1).join(', ')}, and ${facts.at(-1)}`;
  return `✓ ${answer}! ${list[0].toUpperCase()}${list.slice(1)}.`;
}

/** The clues that `n` breaks. */
const broken = (clues, n) => clues.filter((clue) => !fits(clue, n));

// "Between 40 and 60": is 40 itself between? Kids disagree, so 40 and 60 are never suspects.
const onEdge = (clues, n) => clues.some((clue) => clue.kind === 'between' && (n === clue.low || n === clue.high));

/**
 * 12 suspects, smallest first: the answer, a near miss for every clue (it
 * breaks only that clue), then the numbers that break the fewest clues.
 * Returns null if some clue has no near miss: that clue isn't needed.
 */
function suspectsFor(random, answer, clues, low, high) {
  const breaks = new Map(); // each wrong number -> how many clues it breaks
  for (let n = low; n <= high; n++) if (broken(clues, n).length > 0 && !onEdge(clues, n)) breaks.set(n, broken(clues, n).length);
  const mixed = random.shuffle([...breaks.keys()]).sort((a, b) => breaks.get(a) - breaks.get(b));
  const nearMisses = clues.map((clue) => mixed.find((n) => breaks.get(n) === 1 && !fits(clue, n)));
  if (nearMisses.includes(undefined) || mixed.length < SUSPECTS - 1) return null;
  const wrong = [...new Set([...nearMisses, ...mixed])].slice(0, SUSPECTS - 1);
  return [...wrong, answer].sort((a, b) => a - b);
}

/** Make today's 3 mysteries from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const { low, high, kinds, steps } = forLevel(LEVELS, level);
  const rounds = [];
  // Pick a number and some clues about it; try again until every clue is needed.
  while (rounds.length < MYSTERIES) {
    const answer = random.int(low, high);
    if (rounds.some((round) => round.answer === answer)) continue;
    const clues = random.shuffle(kinds)
      .map((kind) => {
        const own = KINDS[kind].make(answer, random, steps);
        return own && { kind, ...own };
      })
      .filter(Boolean)
      .slice(0, random.int(3, 4));
    const suspects = suspectsFor(random, answer, clues, low, high);
    if (suspects) rounds.push({ clues, suspects, answer });
  }
  return { level, rounds };
}

/** The starting state: mystery 0, no suspects crossed out. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], crossed: [], status: 'playing', last: null };
}

/**
 * Tap a suspect. A wrong one is crossed out (no penalty), and
 * state.last.broken is the first clue it breaks.
 */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the mysteries are solved.');
  const round = state.puzzle.rounds[state.round];
  const correct = answer === round.answer;
  const next = nextRound(state, correct, { canShow: false, extra: { broken: broken(round.clues, answer)[0] } });
  return { ...next, crossed: correct ? [] : [...state.crossed, answer] };
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  const { low, high, kinds, steps } = forLevel(LEVELS, level);
  if (!Array.isArray(rounds) || rounds.length !== MYSTERIES) return { ok: false, problems: [`there must be ${MYSTERIES} mysteries`] };
  rounds.forEach(({ clues, suspects, answer }, i) => {
    const where = `mystery ${i + 1}`;
    const known = Array.isArray(clues) && clues.every((clue) => kinds.includes(clue.kind) && (clue.kind !== 'countBy' || steps.includes(clue.step)));
    if (!known || clues.length < 3 || clues.length > 4) return problems.push(`${where} needs 3 or 4 clues from level ${level}`);
    const inOrder = Array.isArray(suspects) && suspects.length === SUSPECTS
      && suspects.every((n, k) => Number.isInteger(n) && n >= low && n <= high && (k === 0 || n > suspects[k - 1]));
    if (!inOrder) return problems.push(`${where} needs ${SUSPECTS} different suspects from ${low} to ${high}, smallest first`);
    const fitting = suspects.filter((n) => broken(clues, n).length === 0);
    if (fitting.length !== 1 || fitting[0] !== answer) problems.push(`${where}: the answer must be the only suspect that fits every clue`);
    for (const clue of clues) {
      const needed = suspects.some((n) => broken(clues, n).length === 1 && !fits(clue, n));
      if (!needed) problems.push(`${where}: the clue "${clueText(clue)}" isn't needed`);
    }
    if (suspects.some((n) => onEdge(clues, n))) problems.push(`${where}: a suspect sits on the edge of a "between" clue`);
  });
  if (new Set(rounds.map((round) => round.answer)).size !== rounds.length) problems.push('two mysteries have the same answer');
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong taps; helped is always 0.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round, crossed: session.saved.crossed };
    misses = session.saved.misses;
  }
  const keep = () => session.save?.({ round: state.round, misses, crossed: state.crossed });
  container.replaceChildren();
  container.classList.add('nd');

  // Crossed out: off, with a line through it and an ✗ (drawn in styles.css).
  const crossOut = (suspect) => {
    suspect.disabled = true;
    suspect.classList.add('nd-crossed');
    suspect.setAttribute('aria-label', `${suspect.textContent}, crossed out`);
  };

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'nd',
    draw(i) {
      const round = puzzle.rounds[i];
      const clues = question.appendChild(make('ul', 'nd-clues'));
      for (const clue of round.clues) clues.append(make('li', 'nd-clue', clueText(clue)));
      message.textContent = 'Tap the number that fits every clue.';
      const grid = stage.appendChild(make('div', 'nd-suspects'));
      for (const n of round.suspects) {
        const suspect = grid.appendChild(button('lw-button nd-suspect', String(n), () => {
          if (state.round !== i) return;
          state = check(state, n);
          if (!state.last.correct) misses += 1;
          keep();
          if (!state.last.correct) {
            message.textContent = whyNot(state.last.broken, n);
            crossOut(suspect);
            wiggle(suspect);
            return;
          }
          markRight(suspect);
          frame.finish(solvedText(round), state.round, () => onDone({ status: state.status, misses, helped: 0 }));
        }));
        if (state.crossed.includes(n)) crossOut(suspect);
      }
    },
  });
  const { question, stage, message } = frame;
  frame.begin(state.round);
}
