// number-pyramid.js: fill in the missing bricks of an addition pyramid.
//
// The pyramid has 4 bricks on the bottom row, then 3, 2, and 1 on top.
// Every brick above the bottom row is the sum of the two bricks under it.
// Some bricks start blank. Each blank can be worked out from numbers that
// are shown or already found, either by adding the two bricks under it, or
// by asking "which number plus this sibling makes the brick above?"
//
// Cells are named by level and position: "0-0" is the bottom-left brick,
// "3-0" is the top brick.

import { createRandom } from '../seed.js';
import { make, button, liveMessage, wiggle } from '../ui.js';

export const LEVEL_SIZES = [4, 3, 2, 1];
export const MIN_TOP = 40;
export const MAX_TOP = 100;
export const BLANKS = 5;
export const MAX_TRIES = 3; // after this many misses the brick fills itself in

export const cellId = (level, index) => `${level}-${index}`;
const parseId = (id) => id.split('-').map(Number);

export function allCells() {
  return LEVEL_SIZES.flatMap((size, level) =>
    Array.from({ length: size }, (_, index) => cellId(level, index)));
}

/** Build every level from the bottom row: each brick is the sum of the two below. */
export function buildValues(base) {
  const values = [base];
  for (let level = 1; level < LEVEL_SIZES.length; level++) {
    const below = values[level - 1];
    values.push(below.slice(0, -1).map((v, i) => v + below[i + 1]));
  }
  return values;
}

/**
 * The ways one brick's value can be worked out from other bricks:
 *   { type: 'add', parts: [left below, right below] }
 *   { type: 'sub', whole: brick above, part: the other brick under it }
 */
function relations(id) {
  const [level, index] = parseId(id);
  const result = [];
  if (level > 0) {
    result.push({ type: 'add', parts: [cellId(level - 1, index), cellId(level - 1, index + 1)] });
  }
  if (level < LEVEL_SIZES.length - 1) {
    const aboveSize = LEVEL_SIZES[level + 1];
    if (index - 1 >= 0) {
      result.push({ type: 'sub', whole: cellId(level + 1, index - 1), part: cellId(level, index - 1) });
    }
    if (index < aboveSize) {
      result.push({ type: 'sub', whole: cellId(level + 1, index), part: cellId(level, index + 1) });
    }
  }
  return result;
}

/** The first way to work out `id` using only bricks in `known`, or null. */
function usableRelation(id, known) {
  return relations(id).find((r) =>
    r.type === 'add' ? r.parts.every((p) => known.has(p)) : known.has(r.whole) && known.has(r.part),
  ) || null;
}

/** True when every blank can be worked out one step at a time. */
export function isSolvable(hidden) {
  const known = new Set(allCells().filter((id) => !hidden.includes(id)));
  let progress = true;
  while (progress) {
    progress = false;
    for (const id of hidden) {
      if (!known.has(id) && usableRelation(id, known)) {
        known.add(id);
        progress = true;
      }
    }
  }
  return hidden.every((id) => known.has(id));
}

/** Make today's pyramid from a seed. */
export function generate(seed) {
  const random = createRandom(seed);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const base = Array.from({ length: LEVEL_SIZES[0] }, () => random.int(2, 25));
    const values = buildValues(base);
    const top = values[LEVEL_SIZES.length - 1][0];
    if (top < MIN_TOP || top > MAX_TOP) continue;

    const hidden = random.shuffle(allCells()).slice(0, BLANKS);
    const inBottom = hidden.some((id) => id.startsWith('0-'));
    const above = hidden.some((id) => !id.startsWith('0-'));
    if (!inBottom || !above || !isSolvable(hidden)) continue;

    return { values, hidden: hidden.sort() };
  }
  throw new Error('Could not make a pyramid for this seed.');
}

export function answerFor(puzzle, id) {
  const [level, index] = parseId(id);
  return puzzle.values[level][index];
}

/** The starting state: nothing entered yet. */
export function start(puzzle) {
  return { puzzle, entries: {}, tries: {}, revealed: [], status: 'playing', last: null };
}

/** Bricks whose numbers are on screen: shown from the start, or entered. */
function knownCells(state) {
  const { hidden } = state.puzzle;
  return new Set(allCells().filter((id) => !hidden.includes(id) || id in state.entries));
}

/** Blank bricks that can be worked out right now. */
export function workable(state) {
  const known = knownCells(state);
  return state.puzzle.hidden.filter((id) => !(id in state.entries) && usableRelation(id, known));
}

/**
 * Try a number in a blank brick. Returns the new state; state.last says
 * what happened: { cell, correct, revealed }.
 */
export function check(state, { cell, value }) {
  if (state.status !== 'playing') throw new Error('This pyramid is already finished.');
  if (!state.puzzle.hidden.includes(cell) || cell in state.entries) {
    throw new Error(`Brick ${cell} is not an open blank.`);
  }

  const answer = answerFor(state.puzzle, cell);
  const entries = { ...state.entries };
  const tries = { ...state.tries };
  const revealed = [...state.revealed];
  const correct = Number(value) === answer;
  let wasRevealed = false;

  if (correct) {
    entries[cell] = answer;
  } else {
    tries[cell] = (tries[cell] || 0) + 1;
    if (tries[cell] >= MAX_TRIES) {
      entries[cell] = answer;
      revealed.push(cell);
      wasRevealed = true;
    }
  }

  const done = state.puzzle.hidden.every((id) => id in entries);
  return {
    ...state,
    entries,
    tries,
    revealed,
    status: done ? 'won' : 'playing',
    last: { cell, correct, revealed: wasRevealed },
  };
}

/**
 * A hint for a blank brick, stronger after each miss:
 *   0-1 misses: the rule ("Add the two bricks under it.")
 *   2+ misses:  the number sentence ("12 + 15 = ?")
 */
export function hint(state, cell) {
  const known = knownCells(state);
  const rel = usableRelation(cell, known);
  if (!rel) return 'Try a different brick first. This one needs more numbers.';

  const value = (id) => answerFor(state.puzzle, id);
  const misses = state.tries[cell] || 0;
  if (rel.type === 'add') {
    const [a, b] = rel.parts.map(value);
    return misses >= 2 ? `${a} + ${b} = ?` : 'Add the two bricks under it.';
  }
  const whole = value(rel.whole);
  const part = value(rel.part);
  return misses >= 2 ? `${whole} − ${part} = ?` : `What number plus ${part} makes ${whole}?`;
}

/** Confirm a pyramid is valid and solvable. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { values, hidden } = puzzle;

  if (!Array.isArray(values) || values.length !== LEVEL_SIZES.length
    || values.some((row, l) => !Array.isArray(row) || row.length !== LEVEL_SIZES[l])) {
    return { ok: false, problems: ['pyramid must have rows of 4, 3, 2, and 1 bricks'] };
  }
  if (values.flat().some((v) => !Number.isInteger(v) || v < 1)) {
    problems.push('every brick must be a whole number of at least 1');
  }
  for (let level = 1; level < values.length; level++) {
    values[level].forEach((v, i) => {
      if (v !== values[level - 1][i] + values[level - 1][i + 1]) {
        problems.push(`brick ${cellId(level, i)} is not the sum of the two under it`);
      }
    });
  }
  const top = values[values.length - 1][0];
  if (top > MAX_TOP) problems.push(`top brick ${top} is over ${MAX_TOP}`);

  const cells = allCells();
  if (!Array.isArray(hidden) || hidden.length !== BLANKS || hidden.some((id) => !cells.includes(id))) {
    problems.push(`there must be ${BLANKS} blank bricks`);
  } else if (!isSolvable(hidden)) {
    problems.push('the blanks cannot all be worked out');
  }

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: pyramid of bricks, message line, and number pad.
// ---------------------------------------------------------------------------

const CHEERS = ['Yes!', 'Great adding!', 'You got it!', 'Nice work!', 'Correct!'];

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let selected = null;
  let typed = '';
  let cheerCount = 0;

  container.replaceChildren();
  container.classList.add('np');

  // Pyramid: drawn top row first.
  const pyramid = make('div', 'np-pyramid');
  const bricks = {};
  for (let level = LEVEL_SIZES.length - 1; level >= 0; level--) {
    const row = make('div', 'np-row');
    for (let index = 0; index < LEVEL_SIZES[level]; index++) {
      const id = cellId(level, index);
      const brick = button('np-brick', '', () => select(id));
      row.append(brick);
      bricks[id] = brick;
    }
    pyramid.append(row);
  }

  const message = liveMessage('np-message', 'Tap a ? brick and type its number.');

  // Number pad.
  const pad = make('div', 'np-pad');
  for (const label of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Check']) {
    const key = button('np-key', label);
    if (label === 'Check') {
      key.classList.add('np-key-check');
      key.addEventListener('click', submit);
    } else if (label === '⌫') {
      key.setAttribute('aria-label', 'Erase a digit');
      key.addEventListener('click', erase);
    } else {
      key.addEventListener('click', () => typeDigit(label));
    }
    pad.append(key);
  }

  container.append(pyramid, message, pad);

  function isOpen(id) {
    return puzzle.hidden.includes(id) && !(id in state.entries);
  }

  function select(id) {
    if (state.status !== 'playing' || !isOpen(id)) return;
    if (!workable(state).includes(id)) {
      // Not ready yet: say so, and keep the current brick selected.
      message.textContent = hint(state, id);
      return;
    }
    selected = id;
    typed = '';
    draw();
  }

  function selectNext() {
    selected = workable(state)[0] || null;
  }

  function typeDigit(digit) {
    if (state.status !== 'playing' || !selected || typed.length >= 3) return;
    typed = typed === '0' ? digit : typed + digit;
    draw();
  }

  function erase() {
    typed = typed.slice(0, -1);
    draw();
  }

  function submit() {
    if (state.status !== 'playing') return;
    if (!selected) {
      message.textContent = 'Tap a blank brick first.';
      return;
    }
    if (typed === '') {
      message.textContent = 'Type a number, then press Check.';
      return;
    }
    const cell = selected;
    state = check(state, { cell, value: Number(typed) });
    typed = '';

    if (state.last.correct) {
      message.textContent = CHEERS[cheerCount++ % CHEERS.length];
      selectNext();
    } else if (state.last.revealed) {
      message.textContent = `It's ${answerFor(puzzle, cell)}. On to the next one!`;
      selectNext();
    } else {
      message.textContent = `Not quite. ${hint(state, cell)}`;
      wiggle(bricks[cell]);
    }
    draw();

    if (state.status === 'won') {
      message.textContent = 'You built the pyramid!';
      document.removeEventListener('keydown', onKeydown);
      container.classList.add('np-finished');
      onDone({ status: state.status });
    }
  }

  function draw() {
    for (const [id, brick] of Object.entries(bricks)) {
      const hidden = puzzle.hidden.includes(id);
      let text;
      let className = 'np-brick';
      let label;
      if (!hidden) {
        text = String(answerFor(puzzle, id));
        className += ' np-given';
        label = text;
      } else if (id in state.entries) {
        text = String(state.entries[id]);
        const shown = state.revealed.includes(id);
        className += shown ? ' np-shown' : ' np-found';
        label = shown ? `${text}, shown` : `${text}, correct`;
      } else if (id === selected) {
        text = typed || '?';
        className += ' np-blank np-selected';
        label = typed ? `typing ${typed}` : 'selected blank brick';
      } else {
        text = '?';
        className += ' np-blank';
        label = 'blank brick';
      }
      brick.textContent = text;
      brick.className = className + (brick.classList.contains('np-wiggle') ? ' np-wiggle' : '');
      brick.setAttribute('aria-label', label);
      brick.disabled = !hidden || id in state.entries;
    }
  }

  // A computer keyboard works too, which helps when testing on a laptop.
  function onKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (container.closest('[hidden]')) return; // only while this game is on screen
    if (/^[0-9]$/.test(event.key)) typeDigit(event.key);
    else if (event.key === 'Backspace') erase();
    else if (event.key === 'Enter') submit();
  }
  document.addEventListener('keydown', onKeydown);

  selectNext();
  draw();
}
