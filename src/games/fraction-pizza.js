// fraction-pizza.js: fractions as slices of pizza.
//
// A pizza is cut into equal slices, and some have toppings. A fraction
// says how much of the pizza that is: 3/4 is 3 of 4 equal slices. Each day
// has 4 rounds, of three kinds:
//   name     look at a pizza and pick its fraction from 3 choices
//   make     tap slices to put toppings on a fraction of the pizza
//   compare  which of two pizzas has more with toppings (or are they the same?)
//
//   level 1: halves, thirds, and fourths; name and make
//   level 2: sixths and eighths too; comparing pizzas cut the same way, or
//            with the same number of topped slices
//   level 3: comparing pizzas cut differently, and fractions that are equal
//            (1/2 is the same as 2/4)

import { createRandom } from '../seed.js';
import { nextRound } from '../rounds.js';
import { make, button, shape, wiggle, roundFrame } from '../ui.js';

export const ROUNDS = 4;
export const MAX_TRIES = 3; // tries at making a pizza before it's shown
// How many slices a pizza can be cut into, and the kinds of round, at each level.
export const LEVELS = [
  { slices: [2, 3, 4], kinds: ['name', 'make', 'name', 'make'] },
  { slices: [2, 3, 4, 6, 8], kinds: ['name', 'make', 'compare', 'make'] },
  { slices: [2, 3, 4, 6, 8], kinds: ['make', 'compare', 'name', 'compare'] },
];
const levelOf = (level = 1) => LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1];
// Pairs of fractions that are the same amount, as [topped, slices] twice.
const EQUALS = [[1, 2, 2, 4], [1, 2, 3, 6], [1, 2, 4, 8], [1, 3, 2, 6], [2, 3, 4, 6], [1, 4, 2, 8], [3, 4, 6, 8]];

/** A fraction as text: fractionText(3, 4) is "3/4". */
export const fractionText = (topped, slices) => `${topped}/${slices}`;

/** Which pizza has more with toppings: 'left', 'right', or 'same'. */
export function bigger(left, right) {
  const difference = left.topped * right.slices - right.topped * left.slices;
  return difference > 0 ? 'left' : difference < 0 ? 'right' : 'same';
}

/** A pizza with some but not all of its slices topped. */
function pizza(random, slicesList) {
  const slices = random.pick(slicesList);
  return { slices, topped: random.int(1, slices - 1) };
}

const MAKERS = {
  name(random, { slices: list }) {
    const { slices, topped } = pizza(random, list);
    const answer = fractionText(topped, slices);
    // Wrong choices are the mistakes kids make: naming the plain part, and
    // putting the plain slices on the bottom.
    const wrong = [fractionText(slices - topped, slices), fractionText(topped, slices - topped), fractionText(topped, slices + 1), fractionText(slices, topped)];
    const choices = [answer];
    for (const text of wrong) if (choices.length < 3 && !choices.includes(text)) choices.push(text);
    return { kind: 'name', slices, topped, answer, choices: random.shuffle(choices) };
  },
  make(random, { slices: list }) {
    return { kind: 'make', ...pizza(random, list) };
  },
  compare(random, { slices: list }, level, alreadyEqual) {
    let left;
    let right;
    if (level >= 3 && !alreadyEqual) {
      // Two fractions that are the same amount, cut differently.
      const [a, b, c, d] = random.pick(EQUALS);
      [left, right] = random.shuffle([{ topped: a, slices: b }, { topped: c, slices: d }]);
    } else {
      do {
        left = pizza(random, list);
        right = pizza(random, list);
        if (level < 3) {
          // Level 2: cut the same way, or the same number of topped slices.
          if (random.int(0, 1) === 0) right = { slices: left.slices, topped: random.int(1, left.slices - 1) };
          else right.topped = left.topped;
        }
      } while (right.topped >= right.slices || bigger(left, right) === 'same' || (level >= 3 && left.slices === right.slices));
    }
    return { kind: 'compare', left, right, answer: bigger(left, right), choices: level >= 3 ? ['left', 'same', 'right'] : ['left', 'right'] };
  },
};

/** Make today's 4 rounds from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const spec = levelOf(level);
  const rounds = [];
  for (const kind of spec.kinds) {
    let round;
    let tries = 0;
    // Try again if this round shows the same pizza as an earlier one.
    do {
      round = MAKERS[kind](random, spec, level, rounds.some((r) => r.answer === 'same'));
      tries++;
    } while (tries < 20 && rounds.some((r) => JSON.stringify([r.slices, r.topped, r.left, r.right]) === JSON.stringify([round.slices, round.topped, round.left, round.right])));
    rounds.push(round);
  }
  return { level, rounds };
}

/** The starting state: round 0. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/** Whether `answer` is right: a fraction's text (name), a count of topped slices (make), or 'left', 'right', 'same' (compare). */
export function isRight(round, answer) {
  return round.kind === 'make' ? answer === round.topped : answer === round.answer;
}

/** Answer the current round. A miss stays on it; the third miss at making a pizza shows it. */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  return nextRound(state, isRight(round, answer), { canShow: round.kind === 'make', maxTries: MAX_TRIES });
}

/** A hint after a miss. */
export function hint(round, answer) {
  if (round.kind === 'name') {
    return `The bottom number is how many slices in all: ${round.slices}. The top number is how many have toppings.`;
  }
  if (round.kind === 'make') {
    return `${fractionText(round.topped, round.slices)} means ${round.topped} of the ${round.slices} slices. You have ${answer}.`;
  }
  const { left, right } = round;
  if (left.slices === right.slices) return 'The slices are the same size. Count which pizza has more with toppings.';
  if (left.topped === right.topped) return `Both have ${left.topped} with toppings, but a pizza cut into fewer slices has bigger slices.`;
  return 'Look at how much of each whole pizza is covered, not how many slices.';
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  const spec = levelOf(level);
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS) return { ok: false, problems: [`there must be ${ROUNDS} rounds`] };
  const proper = (p) => p && spec.slices.includes(p.slices) && Number.isInteger(p.topped) && p.topped >= 1 && p.topped < p.slices;
  rounds.forEach((round, i) => {
    const where = `round ${i + 1}`;
    if (round.kind !== spec.kinds[i]) problems.push(`${where} should be a "${spec.kinds[i]}" round`);
    if (round.kind === 'compare') {
      if (!proper(round.left) || !proper(round.right)) problems.push(`${where}: a pizza isn't a fraction this level uses`);
      else if (round.answer !== bigger(round.left, round.right)) problems.push(`${where}: the answer is wrong`);
      if (!round.choices?.includes(round.answer)) problems.push(`${where}: the answer isn't one of the choices`);
    } else {
      if (!proper(round)) problems.push(`${where}: ${round.topped}/${round.slices} isn't a fraction this level uses`);
      if (round.kind === 'name' && (round.answer !== fractionText(round.topped, round.slices) || round.choices?.length !== 3
        || new Set(round.choices).size !== 3 || !round.choices.includes(round.answer))) {
        problems.push(`${where} needs 3 different choices, one right`);
      }
    }
  });
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/**
 * A pizza cut into `slices`, in a 100 by 100 box. `topped` is a list of
 * true or false, one per slice, going clockwise from the top. Returns the
 * drawing and its slice nodes.
 */
function pizzaDrawing(slices, topped, label) {
  const svg = shape('svg', { viewBox: '0 0 100 100', class: 'fp-pizza', role: 'img', 'aria-label': label });
  svg.append(shape('circle', { cx: 50, cy: 50, r: 48, class: 'fp-crust' }));
  const at = (turn, radius) => {
    const angle = turn * 2 * Math.PI - Math.PI / 2; // a turn of 0 is straight up
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  };
  const nodes = [];
  for (let i = 0; i < slices; i++) {
    const [x1, y1] = at(i / slices, 43);
    const [x2, y2] = at((i + 1) / slices, 43);
    const slice = shape('g', { class: `fp-slice${topped[i] ? ' fp-topped' : ''}` });
    slice.append(shape('path', { d: `M50 50 L${x1} ${y1} A43 43 0 ${slices === 1 ? 1 : 0} 1 ${x2} ${y2} Z`, class: 'fp-cheese' }));
    // Toppings: a few round pieces along the middle of the slice (shown only when it's topped).
    const spots = slices <= 3 ? [[0.3, 22], [0.5, 34], [0.7, 22]] : [[0.5, 20], [0.5, 34]];
    for (const [along, radius] of spots) {
      const [cx, cy] = at((i + along) / slices, radius);
      slice.append(shape('circle', { cx, cy, r: 4.2, class: 'fp-topping' }));
    }
    svg.append(slice);
    nodes.push(slice);
  }
  return { svg, nodes };
}

const firstTopped = (slices, topped) => Array.from({ length: slices }, (_, i) => i < topped);

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong answers; helped is the pizzas
 * that were made for the player.
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
  container.classList.add('fp');

  const frame = roundFrame(container, { count: puzzle.rounds.length, prefix: 'fp', draw: (i) => DRAW[puzzle.rounds[i].kind](puzzle.rounds[i]) });
  const { question, stage, message } = frame;
  const finishRound = (text) => {
    keep();
    frame.finish(text, state.round, () => onDone({ status: state.status, misses, helped: state.shown.length }));
  };

  /** Answer the round on screen. Returns what happened, after saying "not quite" for a plain miss. */
  function answer(round, value, node) {
    if (state.round !== puzzle.rounds.indexOf(round)) return null;
    state = check(state, value);
    if (!state.last.correct) misses += 1;
    if (!state.last.correct && !state.last.shown) {
      message.textContent = `Not quite. ${hint(round, value)}`;
      if (node) wiggle(node);
    }
    return state.last;
  }

  const DRAW = {
    // Look at a pizza and pick its fraction.
    name(round) {
      question.textContent = 'How much of the pizza has toppings?';
      const row = make('div', 'fp-choices');
      for (const text of round.choices) {
        const choice = row.appendChild(button('lw-button fp-choice', text, () => {
          if (!answer(round, text, choice)?.correct) return;
          choice.classList.add('grp-right');
          for (const other of row.children) other.disabled = true;
          finishRound(`✓ ${round.topped} of ${round.slices} slices: ${text}.`);
        }));
      }
      stage.append(pizzaDrawing(round.slices, firstTopped(round.slices, round.topped), `A pizza cut into ${round.slices} slices. ${round.topped} have toppings.`).svg, row);
    },

    // Tap slices to put toppings on a fraction of the pizza.
    make(round) {
      const text = fractionText(round.topped, round.slices);
      question.append('Put toppings on ', make('strong', 'fp-fraction', text), ' of the pizza.');
      const { svg, nodes } = pizzaDrawing(round.slices, firstTopped(round.slices, 0), `A pizza cut into ${round.slices} slices. Tap slices to add toppings.`);
      svg.setAttribute('role', 'group');
      let locked = false;
      nodes.forEach((slice, i) => {
        const toggle = () => {
          if (locked) return;
          slice.classList.toggle('fp-topped');
          slice.setAttribute('aria-pressed', slice.classList.contains('fp-topped'));
        };
        slice.setAttribute('role', 'button');
        slice.setAttribute('tabindex', '0');
        slice.setAttribute('aria-label', `Slice ${i + 1}`);
        slice.setAttribute('aria-pressed', 'false');
        slice.addEventListener('click', toggle);
        slice.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
        });
      });
      const checkButton = button('lw-button fp-check', 'Check', () => {
        const count = nodes.filter((slice) => slice.classList.contains('fp-topped')).length;
        const result = answer(round, count, svg);
        if (!result || (!result.correct && !result.shown)) return;
        locked = true;
        checkButton.disabled = true;
        // Shown after 3 misses: put the toppings on for the player.
        if (result.shown) nodes.forEach((slice, i) => slice.classList.toggle('fp-topped', i < round.topped));
        finishRound(result.correct ? `✓ ${round.topped} of ${round.slices} slices is ${text}!` : `${text} is ${round.topped} of the ${round.slices} slices, like this.`);
      });
      stage.append(svg, checkButton);
    },

    // Which of two pizzas has more with toppings?
    compare(round) {
      question.textContent = round.choices.includes('same') ? 'Which pizza has more with toppings? Or are they the same?' : 'Which pizza has more with toppings?';
      const row = make('div', 'fp-pair');
      const texts = { left: fractionText(round.left.topped, round.left.slices), right: fractionText(round.right.topped, round.right.slices) };
      const done = round.answer === 'same'
        ? `✓ ${texts.left} and ${texts.right} are the same amount!`
        : `✓ ${texts[round.answer]} is more than ${texts[round.answer === 'left' ? 'right' : 'left']}.`;
      for (const side of round.choices) {
        const pick = row.appendChild(button(`fp-pick fp-pick-${side}`, '', () => {
          if (!answer(round, side, pick)?.correct) return;
          pick.classList.add('grp-right');
          for (const other of row.children) other.disabled = true;
          finishRound(done);
        }));
        if (side === 'same') {
          pick.classList.add('lw-button');
          pick.textContent = 'The same';
        } else {
          const { slices, topped } = round[side];
          pick.append(pizzaDrawing(slices, firstTopped(slices, topped), `The ${side} pizza: ${topped} of ${slices} slices have toppings`).svg, make('span', 'fp-under', texts[side]));
        }
      }
      stage.append(row);
    },
  };

  frame.begin(state.round);
}
