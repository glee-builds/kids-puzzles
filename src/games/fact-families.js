// fact-families.js: light up a house by building its four number facts.
//
// A fact family is three numbers where two parts make a whole, like 7, 8,
// and 15. The same three numbers make four facts:
//   7 + 8 = 15    8 + 7 = 15    15 − 7 = 8    15 − 8 = 7
// Each house has the three numbers on its roof. The player drags them into
// one fact at a time: two adding facts, then two take-away facts. Each true
// fact lights a window. When all four are lit, the house shows the four
// facts together. Three houses make a street.
//
// At level 2 the last house is a times family instead (3, 4, and 12):
//   3 × 4 = 12    4 × 3 = 12    12 ÷ 3 = 4    12 ÷ 4 = 3
// At level 3 the last two houses are, with bigger numbers.

import { createRandom } from '../seed.js';
import { make, button, liveMessage, wiggle, dragOrTap } from '../ui.js';

export const HOUSES = 3;
export const WINDOWS = ['+', '+', '-', '-'];
export const TIMES_WINDOWS = ['×', '×', '÷', '÷'];
/** The signs of a house's four windows. A times house has `times: true`. */
export const windowsFor = (house) => (house.times ? TIMES_WINDOWS : WINDOWS);
// How many houses are times families at each level, and their numbers.
const TIMES_HOUSES = [0, 1, 2];
const TIMES_NUMBERS = [[], [2, 3, 4, 5, 10], [3, 4, 6, 7, 8, 9]];
export const MAX_TRIES = 3; // after this many misses the window fills itself
export const MAX_WHOLE = 100;
export const FIRST_HOUSE_MAX = 20;

/** Make today's street of houses from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const step = Math.min(Math.max(level, 1), TIMES_HOUSES.length) - 1;
  const plusHouses = HOUSES - TIMES_HOUSES[step];
  const houses = [];
  while (houses.length < plusHouses) {
    const easy = houses.length === 0;
    const whole = easy ? random.int(8, FIRST_HOUSE_MAX) : random.int(25, 99);
    const part = random.int(easy ? 2 : 11, whole - (easy ? 2 : 11));
    const house = { a: Math.min(part, whole - part), b: Math.max(part, whole - part), c: whole };
    if (house.a === house.b) continue; // a double makes only 2 facts, not 4
    if (houses.some((h) => h.c === house.c)) continue;
    houses.push(house);
  }
  // Times families: two different numbers and what they multiply to.
  while (houses.length < HOUSES) {
    const [a, b] = random.shuffle(TIMES_NUMBERS[step]).slice(0, 2).sort((x, y) => x - y);
    if (houses.some((h) => h.c === a * b)) continue;
    houses.push({ a, b, c: a * b, times: true });
  }
  return { houses };
}

const factKey = (x, op, y, z) => `${x}${op}${y}=${z}`;

/** The four true facts for a house, as strings like "7+8=15". */
export function factsFor({ a, b, c, times }) {
  const [join, split] = times ? ['×', '÷'] : ['+', '-'];
  return [factKey(a, join, b, c), factKey(b, join, a, c), factKey(c, split, a, b), factKey(c, split, b, a)];
}

/** The starting state: house 0, window 0, nothing lit. */
export function start(puzzle) {
  return {
    puzzle,
    house: 0,
    lit: puzzle.houses.map(() => []), // per house: fact strings, in window order
    tries: {},                        // "house-window" -> misses
    revealed: [],                     // "house-window" keys filled in after 3 misses
    status: 'playing',
    last: null,
  };
}

/** The window being filled now in the current house. */
export const currentWindow = (state) => state.lit[state.house].length;

/** Facts with this window's sign that haven't been made yet in this house. */
function missingFacts(state) {
  const house = state.puzzle.houses[state.house];
  const op = windowsFor(house)[currentWindow(state)];
  return factsFor(house).filter((f) => f.includes(op) && !state.lit[state.house].includes(f));
}

/**
 * Try a fact [x, y, z] in the current window (x op y = z, where op comes
 * from the window). Returns the new state; state.last.result is one of:
 *   'lit'      a new true fact: the window lights up
 *   'repeat'   true, but already made in this house
 *   'wrong'    not a true fact with this house's numbers
 *   'shown'    the 3rd miss: the window fills itself in
 */
export function check(state, [x, y, z]) {
  if (state.status !== 'playing') throw new Error('The street is already lit.');
  const house = state.puzzle.houses[state.house];
  const windowIndex = currentWindow(state);
  const op = windowsFor(house)[windowIndex];
  const fact = factKey(x, op, y, z);
  const tryKey = `${state.house}-${windowIndex}`;

  const lit = state.lit.map((facts) => [...facts]);
  const tries = { ...state.tries };
  const revealed = [...state.revealed];
  let result;

  if (state.lit[state.house].includes(fact)) {
    result = 'repeat';
  } else if (factsFor(house).includes(fact)) {
    result = 'lit';
    lit[state.house].push(fact);
  } else {
    tries[tryKey] = (tries[tryKey] || 0) + 1;
    if (tries[tryKey] >= MAX_TRIES) {
      result = 'shown';
      lit[state.house].push(missingFacts(state)[0]);
      revealed.push(tryKey);
    } else {
      result = 'wrong';
    }
  }

  let next = state.house;
  if (lit[state.house].length === WINDOWS.length) next += 1;
  const done = next >= state.puzzle.houses.length;
  return {
    ...state,
    house: done ? state.house : next,
    lit,
    tries,
    revealed,
    status: done ? 'won' : 'playing',
    last: { house: state.house, window: windowIndex, fact, result },
  };
}

const PROMPTS = [
  'Drag the numbers to make an adding fact.',
  'Make another adding fact. Switch the order!',
  'Now a take-away fact. Start with the biggest number.',
  'One more take-away fact. Switch the order!',
];
const TIMES_PROMPTS = [
  'Drag the numbers to make a times fact.',
  'Make another times fact. Switch the order!',
  'Now a divide fact. Start with the biggest number.',
  'One more divide fact. Switch the order!',
];

/** What to make next, in words. Empty once the street is lit. */
export function prompt(state) {
  if (state.status !== 'playing') return '';
  const house = state.puzzle.houses[state.house];
  return (house.times ? TIMES_PROMPTS : PROMPTS)[currentWindow(state)];
}

/**
 * A hint for the current window, stronger after each miss:
 *   0-1 misses: the rule for this kind of fact
 *   2+ misses:  the first number of a fact still to make
 */
export function hint(state) {
  const windowIndex = currentWindow(state);
  const house = state.puzzle.houses[state.house];
  const op = windowsFor(house)[windowIndex];
  const misses = state.tries[`${state.house}-${windowIndex}`] || 0;
  if (misses >= 2) {
    const first = missingFacts(state)[0].split(/[+\-×÷=]/)[0];
    return `Try starting with ${first}.`;
  }
  return {
    '+': 'In an adding fact, the two smaller numbers make the biggest one.',
    '-': 'In a take-away fact, start with the biggest number.',
    '×': 'In a times fact, the two smaller numbers make the biggest one.',
    '÷': 'In a divide fact, start with the biggest number.',
  }[op];
}

/** Confirm a street is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { houses } = puzzle;
  if (!Array.isArray(houses) || houses.length !== HOUSES) {
    return { ok: false, problems: [`there must be ${HOUSES} houses`] };
  }
  houses.forEach(({ a, b, c, times }, i) => {
    if (![a, b, c].every((n) => Number.isInteger(n) && n > 0)) problems.push(`house ${i}: numbers must be whole and above 0`);
    if (times) {
      if (a * b !== c) problems.push(`house ${i}: ${a} × ${b} is not ${c}`);
      if (a < 2 || b < 2) problems.push(`house ${i}: a times family needs numbers of 2 or more`);
      if (i === 0) problems.push('the first house must be an adding family');
    } else if (a + b !== c) problems.push(`house ${i}: ${a} + ${b} is not ${c}`);
    if (a === b) problems.push(`house ${i}: the two parts must be different`);
    if (c > MAX_WHOLE) problems.push(`house ${i}: ${c} is over ${MAX_WHOLE}`);
  });
  if (houses[0] && houses[0].c > FIRST_HOUSE_MAX) problems.push(`the first house must be ${FIRST_HOUSE_MAX} or less`);
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: the street, the house (roof numbers, then one fact to build),
// and the four facts together when a house is done.
//
// Numbers move from the roof into the fact's three boxes. Dragging works,
// and so does tapping (a tapped number goes into the first empty box).
// Tapping a filled box sends its number back to the roof.
// ---------------------------------------------------------------------------

const CHEERS = ['Lights on!', 'True fact!', 'Yes!', 'Bright idea!'];
const PAUSE = 700; // ms to show a right or wrong fact before clearing it

/** "15-7=8" -> "15 − 7 = 8" */
const pretty = (fact) => fact.replace(/([+\-×÷=])/g, ' $1 ').replace('-', '−');

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many wrong answers were given, and
 * helped is how many windows filled themselves in.
 */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let misses = 0;             // wrong facts in the whole puzzle
  let viewHouse = 0;          // the house on screen (stays on a lit house until "Next")
  let boxes = [null, null, null]; // roof index (0 whole, 1 and 2 parts) in each box
  let busy = false;           // true while a fact is being judged
  let cheerCount = 0;

  container.replaceChildren();
  container.classList.add('ff');

  const street = make('div', 'ff-street');
  const streetHouses = puzzle.houses.map(() => {
    const icon = make('span', 'ff-street-house', '⌂');
    street.append(icon);
    return icon;
  });

  const house = make('div', 'ff-house');
  const roof = make('div', 'ff-roof');
  const tiles = [0, 1, 2].map((i) => {
    const tile = button(i === 0 ? 'ff-num ff-num-whole' : 'ff-num');
    dragOrTap(tile, {
      canStart: () => canPlay() && !boxes.includes(i),
      targets: () => boxNodes,
      onDrop: (k) => place(i, k),
      onTap: () => placeFirstEmpty(i),
      classes: { ghost: 'ff-ghost', lifted: 'ff-num-lifted' },
    });
    roof.append(tile);
    return tile;
  });

  const body = make('div', 'ff-body');
  const lights = make('div', 'ff-lights');
  const lightNodes = WINDOWS.map(() => {
    const light = make('span', 'ff-light');
    lights.append(light);
    return light;
  });

  const fact = make('div', 'ff-fact');
  const op = make('span', 'ff-op');
  const boxNodes = [0, 1, 2].map((k) => {
    const box = button('ff-box', '', () => sendBack(k));
    return box;
  });
  fact.append(boxNodes[0], op, boxNodes[1], make('span', 'ff-op', '='), boxNodes[2]);

  const windowsBox = make('div', 'ff-windows');
  const windowNodes = WINDOWS.map(() => {
    const win = make('div', 'ff-window');
    windowsBox.append(win);
    return win;
  });
  body.append(lights, fact, windowsBox);
  house.append(roof, body);

  const promptLine = make('p', 'ff-prompt');
  const message = liveMessage('ff-message');

  const clearButton = button('lw-button ff-action', 'Clear', () => {
    if (busy) return;
    boxes = [null, null, null];
    draw();
  });
  const nextButton = button('lw-button lw-enter ff-action', 'Next house →', () => {
    viewHouse = state.house;
    message.textContent = '';
    draw();
  });

  container.append(street, house, promptLine, message, clearButton, nextButton);

  const numbersOf = (h) => {
    const { a, b, c } = puzzle.houses[h];
    return [c, a, b];
  };
  const houseDone = () => state.lit[viewHouse].length === WINDOWS.length;
  const canPlay = () => state.status === 'playing' && !busy && !houseDone();

  // ---------- Moving numbers ----------

  function place(i, k) {
    if (!canPlay()) return;
    boxes = boxes.map((b) => (b === i ? null : b));
    boxes[k] = i;
    draw();
    if (boxes.every((b) => b !== null)) {
      busy = true;
      setTimeout(submit, 250);
    }
  }

  function placeFirstEmpty(i) {
    if (boxes.includes(i)) return;
    const k = boxes.indexOf(null);
    if (k !== -1) place(i, k);
  }

  function sendBack(k) {
    if (!canPlay() || boxes[k] === null) return;
    boxes[k] = null;
    draw();
  }

  // ---------- Judging a fact ----------

  function submit() {
    const numbers = numbersOf(state.house);
    const houseBefore = state.house;
    state = check(state, boxes.map((i) => numbers[i]));
    const { result } = state.last;
    // The 3rd miss on a window is 'shown': still a wrong fact.
    if (result === 'wrong' || result === 'shown') misses += 1;

    if (result === 'lit' || result === 'shown') {
      if (result === 'shown') {
        // Put the fact that was filled in into the boxes so it can be read.
        const made = state.lit[houseBefore].at(-1).split(/[+\-=]/).map(Number);
        boxes = made.map((n) => numbers.indexOf(n));
        message.textContent = "Here's one. Let's keep going!";
      } else {
        message.textContent = CHEERS[cheerCount++ % CHEERS.length];
      }
      fact.classList.add(result === 'lit' ? 'ff-fact-good' : 'ff-fact-shown');
      draw(houseBefore, state.lit[houseBefore].length - 1);
    } else {
      message.textContent = result === 'repeat'
        ? 'You made that one! Switch the order.'
        : `Not quite. ${hint(state)}`;
      wiggle(fact);
    }

    setTimeout(() => {
      fact.classList.remove('ff-fact-good', 'ff-fact-shown');
      boxes = [null, null, null];
      busy = false;
      if (state.lit[houseBefore].length === WINDOWS.length) {
        viewHouse = houseBefore; // stay to see all four facts together
        message.textContent = state.status === 'won'
          ? 'The whole street is lit up!'
          : `House ${houseBefore + 1}: one family, four facts!`;
        if (state.status === 'won') {
          container.classList.add('finished');
          draw();
          onDone({ status: state.status, misses, helped: state.revealed.length });
          return;
        }
      }
      draw();
    }, PAUSE);
  }

  // ---------- Drawing ----------

  // `pendingLit` keeps the light for a just-made fact off until the pause ends.
  function draw(h = viewHouse, pendingLit = -1) {
    const numbers = numbersOf(h);
    const facts = state.lit[h];
    const done = facts.length === WINDOWS.length && pendingLit === -1;

    tiles.forEach((tile, i) => {
      tile.textContent = String(numbers[i]);
      tile.disabled = done || state.status !== 'playing';
      tile.classList.toggle('ff-num-used', !done && boxes.includes(i));
    });

    lights.hidden = done;
    fact.hidden = done;
    windowsBox.hidden = !done;
    lightNodes.forEach((light, w) => {
      const lit = w < facts.length && w !== pendingLit;
      const shown = state.revealed.includes(`${h}-${w}`);
      light.className = 'ff-light' + (lit ? (shown ? ' ff-light-shown' : ' ff-light-lit') : '');
    });

    if (!done) {
      const w = pendingLit === -1 ? facts.length : pendingLit;
      op.textContent = windowsFor(puzzle.houses[h])[w].replace('-', '−');
      boxNodes.forEach((box, k) => {
        const filled = boxes[k] !== null;
        box.textContent = filled ? String(numbers[boxes[k]]) : '';
        box.classList.toggle('ff-box-filled', filled);
        box.setAttribute('aria-label', filled ? `${numbers[boxes[k]]}, tap to take it back` : 'Empty box');
      });
    } else {
      windowNodes.forEach((win, w) => {
        const shown = state.revealed.includes(`${h}-${w}`);
        win.className = 'ff-window ' + (shown ? 'ff-window-shown' : 'ff-window-lit');
        win.textContent = pretty(facts[w]);
      });
    }

    house.classList.toggle('ff-house-lit', done);
    promptLine.textContent = done ? '' : prompt(state);
    promptLine.hidden = done;
    clearButton.hidden = done;
    nextButton.hidden = !done || state.status !== 'playing';

    streetHouses.forEach((icon, i) => {
      const lit = state.lit[i].length === WINDOWS.length && (i !== h || done);
      icon.className = 'ff-street-house' + (lit ? ' ff-street-lit' : i === h ? ' ff-street-now' : '');
    });
  }

  message.textContent = '';
  draw();
}
