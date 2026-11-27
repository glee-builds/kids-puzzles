// share-it-out.js: share berries equally among frogs (the start of dividing).
//
// Each day has 3 rounds, and each round has two steps:
//   1. Share: tap a frog's lily pad to move one berry from the pile onto it
//      (tap the berries under a pad to move one back). "One each" gives every
//      frog a berry at once. Check is right when the pile is empty and every
//      frog has the same number.
//   2. The fact: 12 ÷ 3 = ? with 3 choices, then the times fact it comes from.
//   level 1: sharing among 2, 5, or 10
//   level 2: among 3, 4, or 6
//   level 3: among 2 to 9, and one round is turned around: "Each frog gets 4.
//            How many frogs can have some?"
// Never more than 10 frogs or 50 berries, so everything stays big enough to tap.

import { createRandom, forLevel } from '../seed.js';
import { nextRound } from '../rounds.js';
import { make, button, wiggle, roundFrame, markRight } from '../ui.js';

export const ROUNDS = 3;
export const MOST_BERRIES = 50;
// How many frogs can share at each level.
export const FROGS = [[2, 5, 10], [3, 4, 6], [2, 3, 4, 5, 6, 7, 8, 9]];
const EACH = [2, 9];  // berries for each frog (from, to): within the 9 × 9 table
const SPARE_PADS = 9; // pads shown when the question is "how many frogs?"

export const total = (round) => round.frogs * round.each;
/** The number a round asks for: berries for each frog, or how many frogs. */
export const answerOf = (round) => (round.ask === 'frogs' ? round.frogs : round.each);
/** The number the berries are divided by. */
const dividerOf = (round) => (round.ask === 'frogs' ? round.each : round.frogs);
const sum = (counts) => counts.reduce((a, b) => a + b, 0);

/** Make today's 3 rounds. Same seed and level, same rounds. */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const turned = level >= 3 ? random.int(0, ROUNDS - 1) : -1; // the turned-around round
  const rounds = [];
  while (rounds.length < ROUNDS) {
    const round = { frogs: random.pick(forLevel(FROGS, level)), each: random.int(...EACH) };
    if (total(round) > MOST_BERRIES || rounds.some((r) => total(r) === total(round))) continue;
    round.ask = rounds.length === turned ? 'frogs' : 'each';
    // Wrong choices are real mistakes: picking the number in the question,
    // taking away instead of sharing, or being one off.
    const answer = answerOf(round);
    const mistakes = [dividerOf(round), answer + 1, answer - 1, total(round) - dividerOf(round)];
    const wrong = [...new Set(mistakes)].filter((n) => n !== answer && n > 0).slice(0, 2);
    rounds.push({ ...round, choices: random.shuffle([answer, ...wrong]) });
  }
  return { level, rounds };
}

/** Step 1: is this a fair share? `counts` is how many berries each pad has. */
export function isRight(round, counts) {
  // When the question is "how many frogs?", empty pads are frogs that got none.
  const fed = round.ask === 'frogs' ? counts.filter((n) => n > 0) : counts;
  return sum(counts) === total(round) && fed.length === round.frogs && fed.every((n) => n === round.each);
}

/** A fair share for a round, pad by pad. */
export function solution(round) {
  const pads = round.ask === 'frogs' ? SPARE_PADS : round.frogs;
  return Array.from({ length: pads }, (_, i) => (i < round.frogs ? round.each : 0));
}

/** A friendly hint after a share that isn't fair. */
export function hint(round, counts) {
  const left = total(round) - sum(counts);
  if (left > 0) return `There ${left === 1 ? 'is still 1 berry' : `are still ${left} berries`} in the pile. Share them all.`;
  if (round.ask === 'frogs') return `Every frog that gets berries needs exactly ${round.each}.`;
  return `One frog has ${Math.max(...counts)} and another has ${Math.min(...counts)}. Equal means the same for everyone.`;
}

/** The fact a round teaches: "3 × 4 = 12, so 12 ÷ 3 = 4." */
export const factText = (round) =>
  `${round.frogs} × ${round.each} = ${total(round)}, so ${total(round)} ÷ ${dividerOf(round)} = ${answerOf(round)}.`;

/** The starting state: round 0, on the sharing step. */
export function start(puzzle) {
  return { puzzle, round: 0, step: 'share', tries: 0, shown: [], status: 'playing', last: null };
}

/**
 * Answer the current step: a list of pad counts when sharing, a number for
 * the fact. The third unfair share in a row is shared for the player.
 */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  if (state.step === 'fact') {
    const after = nextRound(state, answer === answerOf(round), { canShow: false });
    return { ...after, step: after.round === state.round ? 'fact' : 'share' };
  }
  // Sharing never ends the round: when it is done, the fact step is next.
  const after = nextRound(state, isRight(round, answer));
  return { ...after, round: state.round, status: 'playing', step: after.round === state.round ? 'share' : 'fact' };
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const { rounds, level = 1 } = puzzle;
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS) return { ok: false, problems: [`there must be ${ROUNDS} rounds`] };
  const problems = [];
  rounds.forEach((round, i) => {
    const { frogs, each, ask, choices } = round;
    const name = `round ${i + 1}`;
    if (!forLevel(FROGS, level).includes(frogs)) problems.push(`${name}: ${frogs} frogs isn't in level ${level}`);
    if (!(each >= EACH[0] && each <= EACH[1])) problems.push(`${name}: ${each} berries each`);
    if (total(round) > MOST_BERRIES) problems.push(`${name}: ${total(round)} berries is too many`);
    if (ask !== 'each' && !(ask === 'frogs' && level >= 3)) problems.push(`${name}: it can't ask for "${ask}"`);
    if (!isRight(round, solution(round))) problems.push(`${name} can't be shared equally`);
    if (choices?.length !== 3 || new Set(choices).size !== 3 || !choices.includes(answerOf(round))) {
      problems.push(`${name} needs 3 different choices, one right`);
    }
  });
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

const BERRY = '🍓';
const berries = (n) => `${n} ${n === 1 ? 'berry' : 'berries'}`;

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many wrong answers were given, and helped
 * is how many rounds the game shared out for the player.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    const { misses: before, ...rest } = session.saved;
    state = { ...state, ...rest };
    misses = before;
  }
  const keep = () => session.save?.({ round: state.round, step: state.step, shown: state.shown, misses });
  container.replaceChildren();
  container.classList.add('sh');

  const frame = roundFrame(container, { count: ROUNDS, prefix: 'sh', draw: (i) => drawRound(puzzle.rounds[i]) });
  const { question, stage, message } = frame;

  function drawRound(round) {
    const all = total(round);
    let counts = state.step === 'fact' ? solution(round) : solution(round).fill(0);
    const sharing = () => state.step === 'share' && puzzle.rounds[state.round] === round;

    question.textContent = round.ask === 'frogs'
      ? `${all} berries. Each frog gets ${round.each}. How many frogs can have some?`
      : `Share ${all} berries equally among ${round.frogs} frogs.`;

    const pile = make('p', 'sh-pile');
    const pads = make('div', 'sh-pads');
    const below = make('div', 'sh-below');
    // More than 5 pads go in two even rows, so each stays wide enough to tap.
    pads.style.setProperty('--sh-across', counts.length > 5 ? Math.ceil(counts.length / 2) : counts.length);
    const move = (i, by) => {
      if (!sharing() || counts[i] + by < 0 || sum(counts) + by > all) return;
      counts[i] += by;
      draw();
    };
    const spots = counts.map((_, i) => {
      const spot = pads.appendChild(make('div', 'sh-spot'));
      const pad = spot.appendChild(button('sh-pad', '🐸', () => move(i, 1)));
      const back = spot.appendChild(button('sh-berries', '', () => move(i, -1)));
      return { pad, back };
    });
    const oneEach = button('lw-button sh-all', `One each ${BERRY}`, () => {
      if (!sharing() || all - sum(counts) < counts.length) return;
      counts = counts.map((n) => n + 1);
      draw();
    });
    const checkButton = button('lw-button sh-check', 'Check', () => {
      if (!sharing()) return;
      state = check(state, counts);
      if (state.last.correct) return showFact(`✓ A fair share: ${berries(round.each)} for each frog.`);
      misses += 1;
      if (state.last.shown) {
        counts = solution(round);
        return showFact(`Here is a fair share: ${berries(round.each)} for each frog.`);
      }
      message.textContent = `Not quite. ${hint(round, counts)}`;
      wiggle(pads);
    });

    function draw() {
      const left = all - sum(counts);
      // A big pile is a number with a few berries, not 50 tiny ones.
      pile.textContent = left ? `${BERRY.repeat(Math.min(left, 6))} ${left} in the pile` : 'The pile is empty.';
      spots.forEach(({ pad, back }, i) => {
        const n = counts[i];
        back.textContent = n === 0 ? '0' : n <= 2 ? BERRY.repeat(n) : `${n}${BERRY}`;
        pad.setAttribute('aria-label', `Frog ${i + 1} has ${berries(n)}. Give one more.`);
        back.setAttribute('aria-label', `Take a berry back from frog ${i + 1}`);
        pad.disabled = !sharing() || left === 0;
        back.disabled = !sharing() || n === 0;
      });
      oneEach.disabled = left < counts.length;
    }

    // Step 2: the dividing fact that the picture shows.
    function showFact(text) {
      keep();
      draw();
      message.textContent = text;
      const row = make('div', 'sh-choices');
      for (const n of round.choices) {
        const choice = row.appendChild(button('lw-button sh-choice', String(n), () => {
          if (state.round !== puzzle.rounds.indexOf(round)) return;
          state = check(state, n);
          if (!state.last.correct) {
            misses += 1;
            message.textContent = `Not quite. Count ${round.ask === 'frogs' ? 'the frogs that have berries' : 'the berries one frog has'}.`;
            wiggle(choice);
            return;
          }
          markRight(choice);
          keep();
          frame.finish(`✓ ${factText(round)}`, state.round, () => onDone({ status: state.status, misses, helped: state.shown.length }));
        }));
      }
      below.replaceChildren(make('p', 'sh-fact', `${all} ÷ ${dividerOf(round)} = ?`), row);
    }

    // The One each button would fill the spare pads, so the turned-around round goes without it.
    below.append(...(round.ask === 'frogs' ? [] : [oneEach]), checkButton);
    stage.append(pile, pads, below);
    if (state.step === 'fact') showFact('');
    else draw();
  }

  frame.begin(state.round);
}
