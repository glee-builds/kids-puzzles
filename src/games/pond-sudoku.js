// pond-sudoku.js: fill a 4 by 4 pond so no animal repeats in a line or a box.
//
// There are four animals. Every row, every column, and each of the four
// 2 by 2 boxes must have each animal once. Some squares start empty; the
// player taps an empty square, then the animal that belongs there. Each
// day's puzzle has exactly one answer, so it can always be worked out
// without guessing.
//   level 1: 6 empty squares     level 2: 8     level 3: 10
//
// Squares are named by row and column: "0-0" is the top left, "3-3" the
// bottom right. An animal is a number from 0 to 3 (its place in ANIMALS).

import { createRandom } from '../seed.js';
import { make, button, liveMessage, wiggle } from '../ui.js';

export const SIZE = 4;
export const ANIMALS = [['🐸', 'frog'], ['🦆', 'duck'], ['🐢', 'turtle'], ['🐟', 'fish']];
export const BLANKS = [6, 8, 10]; // empty squares at each level
export const MAX_TRIES = 3; // after this many misses the square fills itself in
const blanksFor = (level = 1) => BLANKS[Math.min(Math.max(level, 1), BLANKS.length) - 1];

// One finished pond. Every other one is made by shuffling this.
const BASE = [[0, 1, 2, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 2, 1, 0]];

const cellId = (row, col) => `${row}-${col}`;
const parseId = (id) => id.split('-').map(Number);
const ALL_CELLS = BASE.flatMap((line, r) => line.map((_, c) => cellId(r, c)));

/** The squares that share a row, a column, or a box with [row, col], each tagged with which. */
function neighbors(row, col) {
  const list = [];
  for (let i = 0; i < SIZE; i++) {
    if (i !== col) list.push({ row, col: i, where: 'row' });
    if (i !== row) list.push({ row: i, col, where: 'column' });
  }
  const top = row - (row % 2);
  const left = col - (col % 2);
  for (let r = top; r < top + 2; r++) {
    for (let c = left; c < left + 2; c++) if (r !== row && c !== col) list.push({ row: r, col: c, where: 'box' });
  }
  return list;
}

/** How many ways `grid` (null for an empty square) can be finished: 0, 1, or 2 (meaning "more than one"). */
function countAnswers(grid) {
  const r = grid.findIndex((line) => line.includes(null));
  if (r < 0) return 1;
  const c = grid[r].indexOf(null);
  let count = 0;
  for (let animal = 0; animal < SIZE && count < 2; animal++) {
    if (neighbors(r, c).some((n) => grid[n.row][n.col] === animal)) continue;
    grid[r][c] = animal;
    count += countAnswers(grid);
    grid[r][c] = null;
  }
  return count;
}

/** True if the pond with these squares emptied has exactly one answer. */
function oneAnswer(solution, hidden) {
  const grid = solution.map((line, r) => line.map((animal, c) => (hidden.includes(cellId(r, c)) ? null : animal)));
  return countAnswers(grid) === 1;
}

/** Make today's pond from a seed, at a level from 1 to 3. */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  // Shuffle the base pond in ways that keep it a valid one: swap the rows
  // inside each pair, swap the pairs, the same for columns, and rename the animals.
  const order = () => random.shuffle([random.shuffle([0, 1]), random.shuffle([2, 3])]).flat();
  const rows = order();
  const cols = order();
  const names = random.shuffle([0, 1, 2, 3]);
  const solution = rows.map((r) => cols.map((c) => names[BASE[r][c]]));

  // Empty squares one at a time, keeping only those that leave one answer.
  const wanted = blanksFor(level);
  let hidden = [];
  for (let attempt = 0; attempt < 50 && hidden.length < wanted; attempt++) {
    hidden = [];
    for (const id of random.shuffle(ALL_CELLS)) {
      if (hidden.length < wanted && oneAnswer(solution, [...hidden, id])) hidden.push(id);
    }
  }
  return { solution, hidden: hidden.sort(), level };
}

export function answerFor(puzzle, id) {
  const [r, c] = parseId(id);
  return puzzle.solution[r][c];
}

/** The starting state: nothing filled in yet. */
export function start(puzzle) {
  return { puzzle, entries: {}, tries: {}, shown: [], status: 'playing', last: null };
}

/** The animal showing in a square right now, or null if it's still empty. */
function showing(state, row, col) {
  const id = cellId(row, col);
  if (!state.puzzle.hidden.includes(id)) return state.puzzle.solution[row][col];
  return id in state.entries ? state.entries[id] : null;
}

/**
 * Put an animal in an empty square. Returns the new state; state.last says
 * what happened: { cell, value, correct, shown }.
 */
export function check(state, { cell, value }) {
  if (state.status !== 'playing') throw new Error('The pond is already full.');
  if (!state.puzzle.hidden.includes(cell) || cell in state.entries) throw new Error(`Square ${cell} is not empty.`);
  const answer = answerFor(state.puzzle, cell);
  const correct = value === answer;
  const tries = { ...state.tries, [cell]: (state.tries[cell] || 0) + (correct ? 0 : 1) };
  const shown = !correct && tries[cell] >= MAX_TRIES;
  const entries = correct || shown ? { ...state.entries, [cell]: answer } : state.entries;
  return {
    ...state,
    entries,
    tries,
    shown: shown ? [...state.shown, cell] : state.shown,
    status: state.puzzle.hidden.every((id) => id in entries) ? 'won' : 'playing',
    last: { cell, value, correct, shown },
  };
}

/** A hint after a wrong animal: where that animal already is, if it can be seen. */
export function hint(state, cell, value) {
  const [row, col] = parseId(cell);
  const clash = neighbors(row, col).find((n) => showing(state, n.row, n.col) === value);
  const name = ANIMALS[value][1];
  if (clash) return `There's already a ${name} in this ${clash.where}.`;
  return `Not the ${name}. Which animals are missing from this row and this column?`;
}

/** Confirm a pond is valid and has one answer. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { solution, hidden, level = 1 } = puzzle;
  const square = Array.isArray(solution) && solution.length === SIZE && solution.every((line) => Array.isArray(line) && line.length === SIZE);
  if (!square) return { ok: false, problems: ['the pond must be 4 by 4'] };
  if (solution.flat().some((animal) => !Number.isInteger(animal) || animal < 0 || animal >= SIZE)) {
    return { ok: false, problems: ['every square must hold one of the 4 animals'] };
  }
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const clash = neighbors(r, c).find((n) => solution[n.row][n.col] === solution[r][c]);
      if (clash) problems.push(`square ${cellId(r, c)} repeats in its ${clash.where}`);
    }
  }
  if (!Array.isArray(hidden) || hidden.length !== blanksFor(level) || hidden.some((id) => !ALL_CELLS.includes(id))) {
    problems.push(`level ${level} needs ${blanksFor(level)} empty squares`);
  } else if (problems.length === 0 && !oneAnswer(solution, hidden)) {
    problems.push('the pond has more than one answer');
  }
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong animals tried; helped is the
 * squares that filled themselves in.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) state = { ...state, ...session.saved };
  const keep = () => session.save?.({ entries: state.entries, tries: state.tries, shown: state.shown });
  const empty = () => puzzle.hidden.filter((id) => !(id in state.entries));
  let selected = empty()[0] ?? null;

  container.replaceChildren();
  container.classList.add('ps');
  const message = liveMessage('ps-message', 'Tap an empty square, then the animal that goes there.');
  const grid = make('div', 'ps-grid');
  const cells = {};
  for (const id of ALL_CELLS) {
    cells[id] = grid.appendChild(button('ps-cell', '', () => {
      if (state.status !== 'playing' || !empty().includes(id)) return;
      selected = id;
      draw();
    }));
  }
  const picks = make('div', 'ps-picks');
  ANIMALS.forEach(([picture, name], value) => {
    const pick = picks.appendChild(button('lw-button ps-pick', picture, () => place(value)));
    pick.setAttribute('aria-label', name);
  });
  container.append(message, grid, picks);

  function place(value) {
    if (state.status !== 'playing') return;
    if (!selected) {
      message.textContent = 'Tap an empty square first.';
      return;
    }
    const cell = selected;
    state = check(state, { cell, value });
    const name = ANIMALS[answerFor(puzzle, cell)][1];
    if (state.last.correct) {
      message.textContent = `✓ Yes, the ${name} goes there!`;
    } else if (state.last.shown) {
      message.textContent = `It's the ${name}. On to the next one!`;
    } else {
      message.textContent = `Not quite. ${hint(state, cell, value)}`;
      wiggle(cells[cell]);
    }
    if (state.last.correct || state.last.shown) selected = empty()[0] ?? null;
    if (state.status === 'playing') keep();
    draw();
    if (state.status === 'won') {
      message.textContent = 'The pond is full. Every animal has its place!';
      container.classList.add('finished');
      const misses = Object.values(state.tries).reduce((sum, n) => sum + n, 0);
      onDone({ status: state.status, misses, helped: state.shown.length });
    }
  }

  function draw() {
    for (const [id, cell] of Object.entries(cells)) {
      const [row, col] = parseId(id);
      const animal = showing(state, row, col);
      const given = !puzzle.hidden.includes(id);
      cell.textContent = animal === null ? '' : ANIMALS[animal][0];
      cell.className = 'ps-cell'
        + (given ? ' ps-given' : animal === null ? ' ps-empty' : state.shown.includes(id) ? ' ps-shown' : ' ps-found')
        + (id === selected ? ' ps-selected' : '')
        + (cell.classList.contains('np-wiggle') ? ' np-wiggle' : '');
      const what = animal === null ? (id === selected ? 'empty, selected' : 'empty') : ANIMALS[animal][1];
      cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}: ${what}`);
      cell.disabled = animal !== null || state.status !== 'playing';
    }
    for (const pick of picks.children) pick.disabled = state.status !== 'playing';
  }

  draw();
}
