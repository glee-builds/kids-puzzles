// magic-square.js: fill in a 3x3 grid where every line adds to the same total.
//
// Every row, every column, and both diagonals add up to the same number
// (the "target"). Some squares start blank. Each blank can be worked out
// from a line whose other two numbers are known: target minus those two.
//
// The numbers are evenly spaced, like 5, 10, 15 ... 45, arranged in the
// classic 3x3 magic square pattern. Cells are named by row and column:
// "0-0" is the top-left square, "2-2" is the bottom-right.

import { createRandom, combinations } from '../seed.js';
import { make, button, liveMessage, wiggle } from '../ui.js';

export const SIZE = 3;
export const BLANKS = 4;
export const MIN_TARGET = 30;
export const MAX_TARGET = 99;
export const MAX_TRIES = 3; // after this many misses the square fills itself in

// The classic magic square of 1-9: every line adds to 15.
const BASE_SQUARE = [
  [2, 7, 6],
  [9, 5, 1],
  [4, 3, 8],
];

export const cellId = (row, col) => `${row}-${col}`;
const parseId = (id) => id.split('-').map(Number);

export function allCells() {
  const cells = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells.push(cellId(r, c));
  return cells;
}

// The 8 lines that must add to the target: 3 rows, 3 columns, 2 diagonals.
export const LINES = [
  ...[0, 1, 2].map((r) => [0, 1, 2].map((c) => cellId(r, c))),
  ...[0, 1, 2].map((c) => [0, 1, 2].map((r) => cellId(r, c))),
  [0, 1, 2].map((i) => cellId(i, i)),
  [0, 1, 2].map((i) => cellId(i, 2 - i)),
];

/** Turn and flip the base square into one of its 8 arrangements. */
function arrange(square, turns, flip) {
  let grid = square.map((row) => [...row]);
  for (let t = 0; t < turns; t++) {
    grid = grid[0].map((_, c) => grid.map((row) => row[c]).reverse());
  }
  return flip ? grid.map((row) => [...row].reverse()) : grid;
}

/** The first line through `id` whose other two squares are in `known`, or null. */
function usableLine(id, known) {
  return LINES.find((line) => line.includes(id) && line.every((c) => c === id || known.has(c))) || null;
}

/** True when every blank can be worked out one line at a time. */
export function isSolvable(hidden) {
  const known = new Set(allCells().filter((id) => !hidden.includes(id)));
  let progress = true;
  while (progress) {
    progress = false;
    for (const id of hidden) {
      if (!known.has(id) && usableLine(id, known)) {
        known.add(id);
        progress = true;
      }
    }
  }
  return hidden.every((id) => known.has(id));
}

// Every set of blank squares that can be worked out, listed once.
const BLANK_SETS = combinations(allCells(), BLANKS).filter(isSolvable);

/** Make today's magic square from a seed. */
export function generate(seed) {
  const random = createRandom(seed);
  // The target is 3 times the middle number (first + 4 steps), so pick the
  // step, then a first number that keeps the target in range.
  const step = random.pick([1, 2, 3, 4, 5]);
  const middle = random.int(Math.max(MIN_TARGET / 3, 1 + 4 * step), Math.floor(MAX_TARGET / 3));
  const first = middle - 4 * step;
  const shape = arrange(BASE_SQUARE, random.int(0, 3), random.int(0, 1) === 1);
  const grid = shape.map((row) => row.map((n) => first + (n - 1) * step));
  return { grid, target: 3 * middle, hidden: [...random.pick(BLANK_SETS)].sort() };
}

export function answerFor(puzzle, id) {
  const [r, c] = parseId(id);
  return puzzle.grid[r][c];
}

/** The starting state: nothing entered yet. */
export function start(puzzle) {
  return { puzzle, entries: {}, tries: {}, revealed: [], status: 'playing', last: null };
}

function knownCells(state) {
  const { hidden } = state.puzzle;
  return new Set(allCells().filter((id) => !hidden.includes(id) || id in state.entries));
}

/** Blank squares that can be worked out right now. */
export function workable(state) {
  const known = knownCells(state);
  return state.puzzle.hidden.filter((id) => !(id in state.entries) && usableLine(id, known));
}

/** The line to use for a hint about `cell`, or null if none is ready. */
export function hintLine(state, cell) {
  return usableLine(cell, knownCells(state));
}

/**
 * Try a number in a blank square. Returns the new state; state.last says
 * what happened: { cell, correct, revealed }.
 */
export function check(state, { cell, value }) {
  if (state.status !== 'playing') throw new Error('This square is already finished.');
  if (!state.puzzle.hidden.includes(cell) || cell in state.entries) {
    throw new Error(`Square ${cell} is not an open blank.`);
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
 * A hint for a blank square, stronger after each miss:
 *   0-1 misses: which line to use ("What number makes this line add to 75?")
 *   2+ misses:  the number sentence ("20 + 30 + ? = 75")
 */
export function hint(state, cell) {
  const line = hintLine(state, cell);
  if (!line) return 'Try a different square first. This one needs more numbers.';
  const { target } = state.puzzle;
  if ((state.tries[cell] || 0) < 2) return `What number makes this line add to ${target}?`;
  const others = line.filter((id) => id !== cell).map((id) => answerFor(state.puzzle, id));
  return `${others[0]} + ${others[1]} + ? = ${target}`;
}

/** Confirm a magic square is valid and solvable. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { grid, target, hidden } = puzzle;

  if (!Array.isArray(grid) || grid.length !== SIZE || grid.some((row) => !Array.isArray(row) || row.length !== SIZE)) {
    return { ok: false, problems: ['grid must be 3 by 3'] };
  }
  const numbers = grid.flat();
  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 100)) {
    problems.push('every square must be a whole number from 1 to 100');
  }
  if (new Set(numbers).size !== numbers.length) problems.push('no number may appear twice');
  if (!Number.isInteger(target) || target < MIN_TARGET || target > MAX_TARGET) {
    problems.push(`target ${target} must be from ${MIN_TARGET} to ${MAX_TARGET}`);
  }
  for (const line of LINES) {
    const sum = line.reduce((total, id) => total + answerFor(puzzle, id), 0);
    if (sum !== target) problems.push(`line ${line.join(', ')} adds to ${sum}, not ${target}`);
  }

  const cells = allCells();
  if (!Array.isArray(hidden) || hidden.length !== BLANKS || hidden.some((id) => !cells.includes(id))) {
    problems.push(`there must be ${BLANKS} blank squares`);
  } else if (!isSolvable(hidden)) {
    problems.push('the blanks cannot all be worked out');
  }

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: target, 3x3 grid, message line, and number pad.
// ---------------------------------------------------------------------------

const CHEERS = ['Yes!', 'Great adding!', 'You got it!', 'Nice work!', 'Correct!'];

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let selected = null;
  let typed = '';
  let highlight = []; // squares in the hinted line
  let cheerCount = 0;

  container.replaceChildren();
  container.classList.add('ms');

  const target = make('p', 'ms-target');
  target.append('Every line adds to ', make('strong', 'ms-target-number', String(puzzle.target)));

  const grid = make('div', 'ms-grid');
  const squares = {};
  for (const id of allCells()) {
    const square = button('ms-cell', '', () => select(id));
    grid.append(square);
    squares[id] = square;
  }

  const message = liveMessage('ms-message', 'Tap a ? square and type its number.');

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

  container.append(target, grid, message, pad);

  function isOpen(id) {
    return puzzle.hidden.includes(id) && !(id in state.entries);
  }

  function select(id) {
    if (state.status !== 'playing' || !isOpen(id)) return;
    if (!workable(state).includes(id)) {
      message.textContent = hint(state, id);
      return;
    }
    selected = id;
    typed = '';
    highlight = [];
    draw();
  }

  function selectNext() {
    selected = workable(state)[0] || null;
    highlight = [];
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
      message.textContent = 'Tap a blank square first.';
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
      highlight = hintLine(state, cell) || [];
      wiggle(squares[cell]);
    }
    draw();

    if (state.status === 'won') {
      message.textContent = 'Every line adds up. Magic!';
      document.removeEventListener('keydown', onKeydown);
      container.classList.add('finished');
      onDone({ status: state.status });
    }
  }

  function draw() {
    for (const [id, square] of Object.entries(squares)) {
      const hidden = puzzle.hidden.includes(id);
      let text;
      let className = 'ms-cell';
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
        label = typed ? `typing ${typed}` : 'selected blank square';
      } else {
        text = '?';
        className += ' np-blank';
        label = 'blank square';
      }
      if (highlight.includes(id)) className += ' ms-hint-line';
      square.textContent = text;
      square.className = className + (square.classList.contains('np-wiggle') ? ' np-wiggle' : '');
      square.setAttribute('aria-label', label);
      square.disabled = !hidden || id in state.entries;
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
