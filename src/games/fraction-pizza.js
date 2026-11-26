// fraction-pizza.js: fractions as slices of pizza.
//
// A pizza is cut into equal slices, and some have toppings. A fraction
// says how much of the pizza that is: 3/4 is 3 of 4 equal slices. Each day
// has 5 rounds, of four kinds:
//   name     look at a pizza and pick its fraction from 3 choices
//   make     tap slices to put toppings on a fraction of the pizza
//   compare  which of two pizzas has more with toppings (or are they the same?)
//   match    join 4 fractions to the 4 pizzas that show them, with lines
//            (always the last round)
//
//   level 1: halves, thirds, and fourths; name and make
//   level 2: fifths, sixths, eighths, and tenths too; comparing pizzas cut the same way, or
//            with the same number of topped slices
//   level 3: comparing pizzas cut differently, and fractions that are equal
//            (1/2 is the same as 2/4)

import { createRandom, forLevel } from '../seed.js';
import { nextRound } from '../rounds.js';
import { make, button, shape, wiggle, roundFrame, markRight } from '../ui.js';

export const ROUNDS = 5;
export const MATCHES = 4; // fractions to join to pizzas in the last round
export const MAX_TRIES = 3; // tries at making a pizza before it's shown
// How many slices a pizza can be cut into, and the kinds of round, at each level.
export const LEVELS = [
  { slices: [2, 3, 4], kinds: ['name', 'make', 'name', 'make', 'match'] },
  { slices: [2, 3, 4, 5, 6, 8, 10], kinds: ['name', 'make', 'compare', 'make', 'match'] },
  { slices: [2, 3, 4, 5, 6, 8, 10], kinds: ['make', 'compare', 'name', 'compare', 'match'] },
];
const settingsFor = (level) => forLevel(LEVELS, level);
// Pairs of fractions that are the same amount, as [topped, slices] twice.
const EQUALS = [
  [1, 2, 2, 4], [1, 2, 3, 6], [1, 2, 4, 8], [1, 2, 5, 10], [1, 3, 2, 6], [2, 3, 4, 6], [1, 4, 2, 8], [3, 4, 6, 8],
  [1, 5, 2, 10], [2, 5, 4, 10], [3, 5, 6, 10], [4, 5, 8, 10],
];

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
    // Wrong choices are the mistakes kids make: naming the plain part, putting
    // the plain slices on the bottom, and miscounting the slices. Each is a
    // real fraction (top smaller than bottom), so none is a giveaway.
    const plain = slices - topped;
    const wrong = [[plain, slices], [topped, plain], [topped, slices + 1], [topped + 1, slices + 1]];
    const choices = [answer];
    for (const [top, bottom] of wrong) {
      const text = fractionText(top, bottom);
      if (choices.length < 3 && top < bottom && !choices.includes(text)) choices.push(text);
    }
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
  match(random, { slices: list }) {
    // 4 pizzas that are all different amounts (so 1/2 and 2/4 are never both
    // here), cut at least 2 different ways.
    let pairs;
    do {
      pairs = Array.from({ length: MATCHES }, () => pizza(random, list));
    } while (new Set(pairs.map((p) => p.topped / p.slices)).size < MATCHES || new Set(pairs.map((p) => p.slices)).size < 2);
    // `order` is the pizzas from top to bottom: order[0] is which fraction the top pizza shows.
    return { kind: 'match', pairs, order: random.shuffle(pairs.map((_, i) => i)) };
  },
};

/** Make today's 5 rounds from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const spec = settingsFor(level);
  const rounds = [];
  for (const kind of spec.kinds) {
    let round;
    let tries = 0;
    // Try again if this round shows the same pizza as an earlier one.
    do {
      round = MAKERS[kind](random, spec, level, rounds.some((r) => r.answer === 'same'));
      tries++;
    } while (tries < 20 && kind !== 'match' && rounds.some((r) => JSON.stringify([r.slices, r.topped, r.left, r.right]) === JSON.stringify([round.slices, round.topped, round.left, round.right])));
    rounds.push(round);
  }
  return { level, rounds };
}

/** The starting state: round 0. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/**
 * Whether `answer` is right: a fraction's text (name), a count of topped
 * slices (make), 'left', 'right', or 'same' (compare), or how many
 * fractions have been joined to their pizzas (match: all 4).
 */
export function isRight(round, answer) {
  if (round.kind === 'match') return answer === MATCHES;
  return round.kind === 'make' ? answer === round.topped : answer === round.answer;
}

/** In a match round: whether fraction number `fraction` goes with the pizza in place `place` (0 is the top). */
export const goesWith = (round, fraction, place) => round.order[place] === fraction;

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
  if (round.kind === 'match') {
    // `answer` is the fraction that was joined to the wrong pizza.
    const { topped, slices } = round.pairs[answer];
    return `${fractionText(topped, slices)} is a pizza cut into ${slices} slices, with toppings on ${topped} of them.`;
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
  const spec = settingsFor(level);
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS) return { ok: false, problems: [`there must be ${ROUNDS} rounds`] };
  const proper = (p) => p && spec.slices.includes(p.slices) && Number.isInteger(p.topped) && p.topped >= 1 && p.topped < p.slices;
  rounds.forEach((round, i) => {
    const where = `round ${i + 1}`;
    if (round.kind !== spec.kinds[i]) problems.push(`${where} should be a "${spec.kinds[i]}" round`);
    if (round.kind === 'match') {
      if (round.pairs?.length !== MATCHES || !round.pairs.every(proper)) problems.push(`${where} needs ${MATCHES} fractions this level uses`);
      else if (new Set(round.pairs.map((p) => p.topped / p.slices)).size !== MATCHES) problems.push(`${where}: two of the fractions are the same amount`);
      if ([...(round.order || [])].sort().join() !== '0,1,2,3') problems.push(`${where}: the pizzas must be the 4 fractions, in some order`);
    } else if (round.kind === 'compare') {
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
          markRight(choice);
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
          markRight(pick);
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

    // Join each fraction on the left to its pizza on the right: tap one then
    // the other, or drag a line across.
    match(round) {
      question.textContent = 'Join each fraction to its pizza.';
      const board = make('div', 'fp-match');
      const left = make('div', 'fp-match-column');
      const right = make('div', 'fp-match-column');
      // The lines are drawn in the space between the columns: 0 to 100 across, and 0 to 100 down.
      const lines = shape('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'fp-lines', 'aria-hidden': 'true' });
      const band = shape('line', { class: 'fp-line fp-band', x1: 0, x2: 0, y1: 0, y2: 0 }); // follows a dragging finger
      lines.append(band);
      const rowAt = (i) => ((i + 0.5) / MATCHES) * 100; // how far down row i's middle is
      const joined = new Set(); // fractions already joined
      let selected = null;
      let dragging = false;

      const fractions = round.pairs.map(({ topped, slices }, i) => {
        const node = left.appendChild(button('lw-button fp-match-fraction', fractionText(topped, slices), () => select(i)));
        node.addEventListener('pointerdown', () => { select(i); dragging = selected === i; });
        return node;
      });
      const pizzas = round.order.map((fraction, place) => {
        const { topped, slices } = round.pairs[fraction];
        const node = right.appendChild(button('fp-match-pizza', '', () => join(place)));
        node.dataset.place = place;
        node.append(pizzaDrawing(slices, firstTopped(slices, topped), `A pizza cut into ${slices} slices. ${topped} have toppings.`).svg);
        return node;
      });

      function select(i) {
        if (joined.has(i) || state.round !== puzzle.rounds.indexOf(round)) return;
        selected = i;
        fractions.forEach((node, n) => {
          node.classList.toggle('fp-selected', n === i);
          node.setAttribute('aria-pressed', n === i);
        });
        message.textContent = `Now tap the pizza that shows ${fractions[i].textContent}.`;
      }

      /** Try joining the selected fraction to the pizza in this place. */
      function join(place) {
        if (state.round !== puzzle.rounds.indexOf(round) || pizzas[place].disabled) return;
        if (selected === null) {
          message.textContent = 'Tap a fraction first.';
          return;
        }
        if (!goesWith(round, selected, place)) {
          misses += 1;
          message.textContent = `Not quite. ${hint(round, selected)}`;
          wiggle(pizzas[place]);
          return;
        }
        lines.append(shape('line', { class: 'fp-line', x1: 0, y1: rowAt(selected), x2: 100, y2: rowAt(place) }));
        joined.add(selected);
        for (const node of [fractions[selected], pizzas[place]]) {
          node.classList.remove('fp-selected');
          node.classList.add('fp-joined');
          node.disabled = true;
        }
        message.textContent = `✓ ${fractions[selected].textContent} is joined.`;
        selected = null;
        if (joined.size === MATCHES) {
          state = check(state, joined.size);
          finishRound('✓ Every fraction has its pizza!');
        }
      }

      // Dragging: a line follows the finger from the fraction, and letting go on a pizza joins them.
      board.addEventListener('pointermove', (event) => {
        if (!dragging || selected === null) return;
        const box = lines.getBoundingClientRect();
        const across = Math.min(Math.max(((event.clientX - box.left) / box.width) * 100, 0), 100);
        const down = Math.min(Math.max(((event.clientY - box.top) / box.height) * 100, 0), 100);
        for (const [name, value] of Object.entries({ x1: 0, y1: rowAt(selected), x2: across, y2: down })) band.setAttribute(name, value);
        band.classList.add('fp-band-on');
      });
      const letGo = (event) => {
        band.classList.remove('fp-band-on');
        if (!dragging) return;
        dragging = false;
        const under = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-place]');
        if (under) join(Number(under.dataset.place));
      };
      board.addEventListener('pointerup', letGo);
      board.addEventListener('pointercancel', () => { dragging = false; band.classList.remove('fp-band-on'); });

      board.append(left, lines, right);
      stage.append(board);
    },
  };

  frame.begin(state.round);
}
