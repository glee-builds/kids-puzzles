// skip-maze.js: trace a path by skip counting.
//
// A 5x5 grid of numbers. Hidden in it is a path that counts by 2s, 5s, or
// 10s, like 7, 17, 27, 37 ... The player starts on the first number and
// traces the path with a finger to the star. Every other square holds a
// number that breaks the pattern (counting by 2s from an even number, the
// other squares are odd), so there is exactly one way through.

import { createRandom } from '../seed.js';

export const SIZE = 5;
export const STEPS = [2, 5, 10];
export const MIN_LENGTH = 9;
export const MAX_LENGTH = 11;
export const MAX = 100;

const MOVES = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const adjacent = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

/** A random path of `length` squares from the top-left that never crosses itself. */
function randomPath(random, length) {
  const path = [[0, 0]];
  const used = new Set(['0-0']);
  function grow() {
    if (path.length === length) return true;
    const [r, c] = path[path.length - 1];
    for (const [dr, dc] of random.shuffle(MOVES)) {
      const next = [r + dr, c + dc];
      const k = `${next[0]}-${next[1]}`;
      if (next[0] < 0 || next[0] >= SIZE || next[1] < 0 || next[1] >= SIZE || used.has(k)) continue;
      path.push(next);
      used.add(k);
      if (grow()) return true;
      path.pop();
      used.delete(k);
    }
    return false;
  }
  grow();
  return path;
}

/** The first number for a count by `step` that stays at or under 100. */
function firstNumber(random, step, length) {
  const top = MAX - (length - 1) * step;
  if (step === 10) return random.int(1, Math.min(9, top)); // 7, 17, 27 ...: the ones digit stays
  if (step === 5) return 5 * random.int(1, Math.floor(top / 5));
  return 2 * random.int(1, Math.floor(Math.min(top, 50) / 2));
}

/** True when `n` belongs to the count (same remainder as the first number). */
export const onPattern = (n, first, step) => ((n - first) % step + step) % step === 0;

/** Make today's grid from a seed. */
export function generate(seed) {
  const random = createRandom(seed);
  const step = random.pick(STEPS);
  const length = step === 10 ? random.int(MIN_LENGTH, 10) : random.int(MIN_LENGTH, MAX_LENGTH);
  const first = firstNumber(random, step, length);
  const path = randomPath(random, length);
  const values = path.map((_, i) => first + i * step);

  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  path.forEach(([r, c], i) => { grid[r][c] = values[i]; });

  // Every other square: a near miss, a little off a number in the count.
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== null) continue;
      let n;
      do {
        n = random.pick(values) + (random.int(0, 1) ? 1 : -1) * random.int(1, step - 1);
      } while (n < 0 || n > MAX || onPattern(n, first, step));
      grid[r][c] = n;
    }
  }
  return { step, first, grid, path };
}

/** The starting state: the first square is already traced. */
export function start(puzzle) {
  return { puzzle, trail: [puzzle.path[0]], hints: 0, status: 'playing', last: null };
}

const head = (state) => state.trail[state.trail.length - 1];
export const valueAt = (puzzle, [r, c]) => puzzle.grid[r][c];
export const nextValue = (state) => state.puzzle.first + state.trail.length * state.puzzle.step;

/**
 * The finger moved onto `square`. Returns the new state; state.last.result:
 *   'grow'   the next number in the count: the trail grows
 *   'back'   the square before the head: the trail shrinks (sliding back)
 *   'cut'    a square further back on the trail: cut back to it
 *   'wrong'  next to the head but not the next number
 *   'stay'   the head itself, or too far away to mean anything
 */
export function step(state, square) {
  if (state.status !== 'playing') return state;
  const { puzzle, trail } = state;
  const at = trail.findIndex((t) => same(t, square));
  let result = 'stay';
  let next = trail;

  if (at === trail.length - 1) {
    result = 'stay';
  } else if (at >= 0) {
    result = at === trail.length - 2 ? 'back' : 'cut';
    next = trail.slice(0, at + 1);
  } else if (adjacent(head(state), square)) {
    if (valueAt(puzzle, square) === nextValue(state)) {
      result = 'grow';
      next = [...trail, square];
    } else {
      result = 'wrong';
    }
  }

  const won = next.length === puzzle.path.length;
  return { ...state, trail: next, status: won ? 'won' : 'playing', last: { square, result } };
}

/**
 * A hint, stronger each time:
 *   1st: the counting question ("Counting by 5s: what comes after 30?")
 *   2nd+: also lights the next square (returned as `square`)
 */
export function hint(state) {
  const hints = state.hints + 1;
  const { step: by } = state.puzzle;
  const now = valueAt(state.puzzle, head(state));
  const text = `Counting by ${by}s: what comes after ${now}?`;
  const square = hints >= 2 ? state.puzzle.path[state.trail.length] : null;
  return { state: { ...state, hints }, text, square };
}

/** Confirm a grid is valid with exactly one way through. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { step: by, first, grid, path } = puzzle;
  if (!STEPS.includes(by)) problems.push(`step ${by} is not allowed`);
  if (grid.length !== SIZE || grid.some((row) => row.length !== SIZE)) problems.push(`grid must be ${SIZE}x${SIZE}`);
  if (path.length < MIN_LENGTH || path.length > MAX_LENGTH) problems.push(`path length ${path.length}`);
  if (!same(path[0], [0, 0])) problems.push('path must start top-left');

  const onPath = new Set();
  path.forEach((square, i) => {
    onPath.add(`${square[0]}-${square[1]}`);
    if (i > 0 && !adjacent(path[i - 1], square)) problems.push(`path step ${i} is not next to the one before`);
    if (valueAt(puzzle, square) !== first + i * by) problems.push(`path square ${i} should be ${first + i * by}`);
  });
  if (onPath.size !== path.length) problems.push('path crosses itself');

  grid.forEach((row, r) => row.forEach((n, c) => {
    if (!Number.isInteger(n) || n < 0 || n > MAX) problems.push(`square ${r},${c} has ${n}`);
    if (!onPath.has(`${r}-${c}`) && onPattern(n, first, by)) problems.push(`square ${r},${c} (${n}) fits the count but is off the path`);
  }));
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: the message, the number grid, and a Hint button.
// ---------------------------------------------------------------------------

const WRONG_SHOW = 700; // ms a wrong square shows its ✗

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let glow = null;
  let tracing = false;
  let lastSquare = null;
  const goal = puzzle.path[puzzle.path.length - 1];
  const intro = `Count by ${puzzle.step}s from ${puzzle.first}. Trace to the ★`;

  container.replaceChildren();
  container.classList.add('sk');

  const message = make('p', 'sk-message', intro);
  message.setAttribute('aria-live', 'polite');

  const grid = make('div', 'sk-grid');
  const cells = puzzle.grid.map((row, r) => row.map((n, c) => {
    const cell = make('div', 'sk-cell', String(n));
    cell.dataset.r = r;
    cell.dataset.c = c;
    grid.append(cell);
    return cell;
  }));

  const hintButton = make('button', 'lw-button sk-hint', 'Hint');
  hintButton.type = 'button';
  hintButton.addEventListener('click', () => {
    if (state.status !== 'playing') return;
    const result = hint(state);
    state = result.state;
    glow = result.square;
    message.textContent = result.text;
    draw();
  });

  container.append(message, grid, hintButton);

  function squareAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const cell = hit && hit.closest('.sk-cell');
    return cell && grid.contains(cell) ? [Number(cell.dataset.r), Number(cell.dataset.c)] : null;
  }

  function enter(square) {
    if (!square || (lastSquare && same(square, lastSquare))) return;
    lastSquare = square;
    state = step(state, square);
    const { result } = state.last;
    if (result === 'grow') {
      if (glow && state.trail.some((t) => same(t, glow))) glow = null;
      message.textContent = state.status === 'won' ? 'You counted all the way to the star!' : intro;
    } else if (result === 'wrong') {
      const n = valueAt(puzzle, square);
      message.textContent = `${n} isn't next. What comes after ${valueAt(puzzle, state.trail.at(-1))}?`;
      const cell = cells[square[0]][square[1]];
      cell.classList.add('sk-wrong');
      setTimeout(() => cell.classList.remove('sk-wrong'), WRONG_SHOW);
    }
    draw();
    if (state.status === 'won') {
      tracing = false;
      container.classList.add('sk-finished');
      onDone({ status: state.status });
    }
  }

  grid.addEventListener('pointerdown', (event) => {
    if (state.status !== 'playing') return;
    event.preventDefault();
    tracing = true;
    lastSquare = null;
    try { grid.setPointerCapture(event.pointerId); } catch { /* fine without it */ }
    enter(squareAt(event.clientX, event.clientY));
  });
  grid.addEventListener('pointermove', (event) => {
    if (tracing) enter(squareAt(event.clientX, event.clientY));
  });
  const stop = () => { tracing = false; lastSquare = null; };
  grid.addEventListener('pointerup', stop);
  grid.addEventListener('pointercancel', stop);

  function draw() {
    const headSquare = state.trail[state.trail.length - 1];
    cells.forEach((row, r) => row.forEach((cell, c) => {
      const onTrail = state.trail.some((t) => same(t, [r, c]));
      cell.classList.toggle('sk-path', onTrail);
      cell.classList.toggle('sk-head', same(headSquare, [r, c]) && state.status === 'playing');
      cell.classList.toggle('sk-goal', same(goal, [r, c]));
      cell.classList.toggle('sk-glow', !!glow && same(glow, [r, c]));
    }));
    hintButton.disabled = state.status !== 'playing';
  }

  draw();
}
