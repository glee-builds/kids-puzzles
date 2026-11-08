// fact-families.js: light up a house by building its four number facts.
//
// A fact family is three numbers where two parts make a whole, like 7, 8,
// and 15. The same three numbers make four facts:
//   7 + 8 = 15    8 + 7 = 15    15 − 7 = 8    15 − 8 = 7
// Each house has the three numbers on its roof and four dark windows: two
// adding facts and two take-away facts. A true fact lights its window.
// Three houses make a street.

import { createRandom } from '../seed.js';

export const HOUSES = 3;
export const WINDOWS = ['+', '+', '-', '-'];
export const MAX_TRIES = 3; // after this many misses the window fills itself
export const MAX_WHOLE = 100;
export const FIRST_HOUSE_MAX = 20;

/** Make today's street of houses from a seed. */
export function generate(seed) {
  const random = createRandom(seed);
  const houses = [];
  while (houses.length < HOUSES) {
    const easy = houses.length === 0;
    const whole = easy ? random.int(8, FIRST_HOUSE_MAX) : random.int(25, 99);
    const part = random.int(easy ? 2 : 11, whole - (easy ? 2 : 11));
    const house = { a: Math.min(part, whole - part), b: Math.max(part, whole - part), c: whole };
    if (house.a === house.b) continue; // a double makes only 2 facts, not 4
    if (houses.some((h) => h.c === house.c)) continue;
    houses.push(house);
  }
  return { houses };
}

const factKey = (x, op, y, z) => `${x}${op}${y}=${z}`;

/** The four true facts for a house, as strings like "7+8=15". */
export function factsFor({ a, b, c }) {
  return [factKey(a, '+', b, c), factKey(b, '+', a, c), factKey(c, '-', a, b), factKey(c, '-', b, a)];
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
  const op = WINDOWS[currentWindow(state)];
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
  const op = WINDOWS[windowIndex];
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

/**
 * A hint for the current window, stronger after each miss:
 *   0-1 misses: the rule for this kind of fact
 *   2+ misses:  the first number of a fact still to make
 */
export function hint(state) {
  const windowIndex = currentWindow(state);
  const op = WINDOWS[windowIndex];
  const misses = state.tries[`${state.house}-${windowIndex}`] || 0;
  if (misses >= 2) {
    const first = missingFacts(state)[0].split(/[+\-=]/)[0];
    return `Try starting with ${first}.`;
  }
  return op === '+'
    ? 'In an adding fact, the two smaller numbers make the biggest one.'
    : 'In a take-away fact, start with the biggest number.';
}

/** Confirm a street is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { houses } = puzzle;
  if (!Array.isArray(houses) || houses.length !== HOUSES) {
    return { ok: false, problems: [`there must be ${HOUSES} houses`] };
  }
  houses.forEach(({ a, b, c }, i) => {
    if (![a, b, c].every((n) => Number.isInteger(n) && n > 0)) problems.push(`house ${i}: numbers must be whole and above 0`);
    if (a + b !== c) problems.push(`house ${i}: ${a} + ${b} is not ${c}`);
    if (a === b) problems.push(`house ${i}: the two parts must be different`);
    if (c > MAX_WHOLE) problems.push(`house ${i}: ${c} is over ${MAX_WHOLE}`);
  });
  if (houses[0] && houses[0].c > FIRST_HOUSE_MAX) problems.push(`the first house must be ${FIRST_HOUSE_MAX} or less`);
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: the street, the house (roof numbers and four windows), buttons.
// ---------------------------------------------------------------------------

const CHEERS = ['Lights on!', 'True fact!', 'Yes!', 'Bright idea!'];

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let picked = []; // indexes into the roof numbers: 0 = whole, 1 and 2 = parts
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
  const roofButtons = [0, 1, 2].map((i) => {
    const button = make('button', i === 0 ? 'ff-num ff-num-whole' : 'ff-num');
    button.type = 'button';
    button.addEventListener('click', () => pick(i));
    roof.append(button);
    return button;
  });
  const windowsBox = make('div', 'ff-windows');
  const windowNodes = WINDOWS.map(() => {
    const win = make('div', 'ff-window');
    windowsBox.append(win);
    return win;
  });
  house.append(roof, windowsBox);

  const message = make('p', 'ff-message', 'Tap the roof numbers to make a fact in the glowing window.');
  message.setAttribute('aria-live', 'polite');

  const eraseButton = make('button', 'lw-button ff-erase', 'Clear');
  eraseButton.type = 'button';
  eraseButton.addEventListener('click', () => {
    picked = [];
    draw();
  });

  container.append(street, house, message, eraseButton);

  const roofNumbers = () => {
    const { a, b, c } = puzzle.houses[state.house];
    return [c, a, b];
  };

  function pick(i) {
    if (state.status !== 'playing' || picked.includes(i)) return;
    picked.push(i);
    draw();
    if (picked.length === 3) setTimeout(submit, 250);
  }

  function submit() {
    const numbers = picked.map((i) => roofNumbers()[i]);
    picked = [];
    const houseBefore = state.house;
    state = check(state, numbers);
    const { result } = state.last;

    if (result === 'lit') message.textContent = CHEERS[cheerCount++ % CHEERS.length];
    else if (result === 'repeat') message.textContent = 'You made that one! Try switching the order.';
    else if (result === 'shown') message.textContent = "Here's one. On to the next window!";
    else message.textContent = `Not quite. ${hint(state)}`;

    if (state.status === 'won') {
      draw(houseBefore);
      house.classList.add('ff-house-lit');
      message.textContent = 'The whole street is lit up!';
      container.classList.add('ff-finished');
      onDone({ status: state.status });
      return;
    }
    if (state.house !== houseBefore) {
      // Show the fully lit house for a moment, then the next one.
      draw(houseBefore);
      house.classList.add('ff-house-lit');
      message.textContent = `House ${houseBefore + 1} is all lit up!`;
      setTimeout(() => {
        house.classList.remove('ff-house-lit');
        draw();
      }, 1400);
      return;
    }
    draw();
  }

  function draw(houseIndex = state.house) {
    const numbers = (() => {
      const { a, b, c } = puzzle.houses[houseIndex];
      return [c, a, b];
    })();
    roofButtons.forEach((button, i) => {
      button.textContent = String(numbers[i]);
      button.disabled = state.status !== 'playing' || houseIndex !== state.house || picked.includes(i);
    });

    const facts = state.lit[houseIndex];
    windowNodes.forEach((win, w) => {
      const op = WINDOWS[w] === '+' ? '+' : '−';
      let parts;
      let className = 'ff-window';
      if (w < facts.length) {
        parts = facts[w].split(/[+\-=]/);
        className += state.revealed.includes(`${houseIndex}-${w}`) ? ' ff-window-shown' : ' ff-window-lit';
      } else if (w === facts.length && houseIndex === state.house && state.status === 'playing') {
        const typed = picked.map((i) => numbers[i]);
        parts = [0, 1, 2].map((k) => (typed[k] !== undefined ? String(typed[k]) : '?'));
        className += ' ff-window-now';
      } else {
        parts = ['?', '?', '?'];
      }
      win.className = className;
      win.textContent = `${parts[0]} ${op} ${parts[1]} = ${parts[2]}`;
    });

    streetHouses.forEach((icon, i) => {
      const done = i < state.house || state.status === 'won' || (i === houseIndex && facts.length === WINDOWS.length);
      icon.className = 'ff-street-house' + (done ? ' ff-street-lit' : i === state.house ? ' ff-street-now' : '');
    });
  }

  draw();
}
