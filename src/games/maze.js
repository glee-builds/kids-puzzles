// maze.js: trace a path through a maze with your finger.
//
// The maze is a grid of squares with walls between some of them. It is a
// "perfect" maze: every square can be reached, and there is exactly one
// route between any two squares, so there is exactly one way from the
// start (top-left) to the star (bottom-right).
//
// Squares are [row, col] pairs. Walls are stored per square as a number
// made of these flags: N (wall above), E (right), S (below), W (left).

import { createRandom } from '../seed.js';

export const SIZE = 8;
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const ALL_WALLS = N | E | S | W;
const HINT_STEPS = 3;

const MOVES = [
  { wall: N, opposite: S, dr: -1, dc: 0 },
  { wall: E, opposite: W, dr: 0, dc: 1 },
  { wall: S, opposite: N, dr: 1, dc: 0 },
  { wall: W, opposite: E, dr: 0, dc: -1 },
];

const key = ([r, c]) => `${r}-${c}`;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

/**
 * Make today's maze. It starts with every wall up, then wanders from the
 * start, knocking down walls into squares it hasn't visited yet, and backs
 * up when stuck. This always makes a perfect maze.
 */
export function generate(seed, size = SIZE) {
  const random = createRandom(seed);
  const walls = Array.from({ length: size }, () => Array(size).fill(ALL_WALLS));
  const visited = new Set([key([0, 0])]);
  const stack = [[0, 0]];

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const options = MOVES.filter(({ dr, dc }) => {
      const nr = r + dr;
      const nc = c + dc;
      return nr >= 0 && nr < size && nc >= 0 && nc < size && !visited.has(key([nr, nc]));
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const move = random.pick(options);
    const next = [r + move.dr, c + move.dc];
    walls[r][c] &= ~move.wall;
    walls[next[0]][next[1]] &= ~move.opposite;
    visited.add(key(next));
    stack.push(next);
  }

  return { size, walls, start: [0, 0], goal: [size - 1, size - 1] };
}

/** True when you can step from square `a` to square `b` (next to it, no wall). */
export function canMove(puzzle, a, b) {
  const move = MOVES.find(({ dr, dc }) => a[0] + dr === b[0] && a[1] + dc === b[1]);
  if (!move) return false;
  const inside = b[0] >= 0 && b[0] < puzzle.size && b[1] >= 0 && b[1] < puzzle.size;
  return inside && (puzzle.walls[a[0]][a[1]] & move.wall) === 0;
}

function neighbors(puzzle, square) {
  return MOVES
    .map(({ dr, dc }) => [square[0] + dr, square[1] + dc])
    .filter((next) => canMove(puzzle, square, next));
}

/** The one route from start to goal, as a list of squares. */
export function solution(puzzle) {
  const cameFrom = new Map([[key(puzzle.start), null]]);
  const queue = [puzzle.start];
  while (queue.length > 0) {
    const square = queue.shift();
    if (same(square, puzzle.goal)) break;
    for (const next of neighbors(puzzle, square)) {
      if (!cameFrom.has(key(next))) {
        cameFrom.set(key(next), square);
        queue.push(next);
      }
    }
  }
  if (!cameFrom.has(key(puzzle.goal))) return null;
  const route = [];
  for (let square = puzzle.goal; square; square = cameFrom.get(key(square))) route.unshift(square);
  return route;
}

/** The starting state: the path is just the start square. */
export function start(puzzle) {
  return { puzzle, path: [puzzle.start], hints: 0, status: 'playing' };
}

/**
 * Move the end of the path to `square`. Returns the new state.
 *   - A square next to the end, with no wall between: the path grows.
 *   - The square just before the end: the path shrinks (tracing back).
 *   - Anything else: nothing changes (walls just stop the path).
 */
export function step(state, square) {
  if (state.status !== 'playing') return state;
  const { path, puzzle } = state;
  const end = path[path.length - 1];

  if (path.length > 1 && same(square, path[path.length - 2])) {
    return { ...state, path: path.slice(0, -1) };
  }
  if (path.some((p) => same(p, square)) || !canMove(puzzle, end, square)) return state;

  const grown = [...path, square];
  return { ...state, path: grown, status: same(square, puzzle.goal) ? 'won' : 'playing' };
}

/**
 * Squares to light up as a hint: the next few squares of the right route
 * after the last square of the path that is still on the route. If the
 * path has wandered off the route, the hint starts where it went wrong.
 */
export function hintSquares(state) {
  const route = solution(state.puzzle);
  let onRoute = 0;
  while (onRoute < state.path.length && onRoute < route.length && same(state.path[onRoute], route[onRoute])) {
    onRoute++;
  }
  return route.slice(onRoute, onRoute + HINT_STEPS);
}

/** True when the path has left the right route (a wrong turn to trace back from). */
export function offRoute(state) {
  const route = solution(state.puzzle);
  return state.path.some((p, i) => !route[i] || !same(p, route[i]));
}

/** Confirm a maze is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { size, walls } = puzzle;
  if (!Array.isArray(walls) || walls.length !== size || walls.some((row) => row.length !== size)) {
    return { ok: false, problems: [`walls must be ${size} by ${size}`] };
  }

  // Walls must match on both sides, and the outside edge must be closed.
  let openings = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const { wall, opposite, dr, dc } of MOVES) {
        const nr = r + dr;
        const nc = c + dc;
        const open = (walls[r][c] & wall) === 0;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
          if (open) problems.push(`square ${r},${c} has a hole in the outside wall`);
        } else if (open !== ((walls[nr][nc] & opposite) === 0)) {
          problems.push(`wall between ${r},${c} and ${nr},${nc} doesn't match`);
        } else if (open) {
          openings++;
        }
      }
    }
  }

  // A perfect maze: every square reachable, and exactly (squares - 1) openings.
  const seen = new Set([key(puzzle.start)]);
  const queue = [puzzle.start];
  while (queue.length > 0) {
    for (const next of neighbors(puzzle, queue.shift())) {
      if (!seen.has(key(next))) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  if (seen.size !== size * size) problems.push('some squares cannot be reached');
  if (openings / 2 !== size * size - 1) problems.push('there is more than one route somewhere (a loop)');
  if (!solution(puzzle)) problems.push('there is no route from start to star');

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: the maze grid, a message line, and a Hint button.
// ---------------------------------------------------------------------------

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let hint = [];
  let tracing = false;
  let wrongTurnSaid = false;

  container.replaceChildren();
  container.classList.add('mz');

  const message = make('p', 'mz-message', 'Put your finger on the green dot and trace to the star.');
  message.setAttribute('aria-live', 'polite');

  const grid = make('div', 'mz-grid');
  grid.style.setProperty('--size', puzzle.size);
  const squares = {};
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      const square = make('div', 'mz-cell');
      square.dataset.r = r;
      square.dataset.c = c;
      const w = puzzle.walls[r][c];
      // Each square draws its top and left walls; the last row and column
      // also draw the bottom and right edges.
      if (w & N) square.classList.add('mz-n');
      if (w & W) square.classList.add('mz-w');
      if (c === puzzle.size - 1 && w & E) square.classList.add('mz-e');
      if (r === puzzle.size - 1 && w & S) square.classList.add('mz-s');
      grid.append(square);
      squares[key([r, c])] = square;
    }
  }

  const hintButton = make('button', 'lw-button mz-hint', 'Hint');
  hintButton.type = 'button';
  hintButton.addEventListener('click', () => {
    if (state.status !== 'playing') return;
    hint = hintSquares(state);
    state = { ...state, hints: state.hints + 1 };
    message.textContent = offRoute(state)
      ? 'Trace back to where the glow starts, then follow it.'
      : 'Follow the glowing squares.';
    draw();
  });

  container.append(message, grid, hintButton);

  function squareAt(x, y) {
    const node = document.elementFromPoint(x, y);
    const cell = node && node.closest('.mz-cell');
    return cell && grid.contains(cell) ? [Number(cell.dataset.r), Number(cell.dataset.c)] : null;
  }

  function moveTo(square) {
    const before = state.path.length;
    state = step(state, square);
    if (state.path.length === before) return;
    hint = hint.filter((h) => !state.path.some((p) => same(p, h)));
    if (state.status === 'won') {
      tracing = false;
      message.textContent = 'You made it to the star!';
      draw();
      container.classList.add('mz-finished');
      onDone({ status: state.status });
      return;
    }
    if (offRoute(state) && !wrongTurnSaid && neighbors(puzzle, square).length === 1) {
      message.textContent = 'Dead end! Trace back and try another way.';
      wrongTurnSaid = true;
    } else if (!offRoute(state)) {
      wrongTurnSaid = false;
    }
    draw();
  }

  // Finger (or mouse) tracing. Moving fast can skip squares, so fill in the
  // squares between the last one and the finger, one step at a time.
  function follow(event) {
    const target = squareAt(event.clientX, event.clientY);
    if (!target) return;
    // Only fill small gaps (a quick finger). A big jump is ignored, so the
    // maze never walks itself toward a far-away finger.
    const end = state.path[state.path.length - 1];
    if (Math.abs(target[0] - end[0]) + Math.abs(target[1] - end[1]) > 2) return;
    for (let guard = 0; guard < puzzle.size * 2; guard++) {
      const end = state.path[state.path.length - 1];
      if (same(end, target)) break;
      const prev = state.path[state.path.length - 2];
      if (prev && same(prev, target)) {
        moveTo(target);
        break;
      }
      const dr = Math.sign(target[0] - end[0]);
      const dc = Math.sign(target[1] - end[1]);
      // Step one square toward the finger, trying the bigger direction first.
      const tryFirst = Math.abs(target[0] - end[0]) >= Math.abs(target[1] - end[1])
        ? [[end[0] + dr, end[1]], [end[0], end[1] + dc]]
        : [[end[0], end[1] + dc], [end[0] + dr, end[1]]];
      const next = tryFirst.find((sq) => (sq[0] !== end[0] || sq[1] !== end[1]) && canMove(puzzle, end, sq));
      if (!next) break;
      const lengthBefore = state.path.length;
      moveTo(next);
      if (state.path.length === lengthBefore) break;
    }
  }

  grid.addEventListener('pointerdown', (event) => {
    if (state.status !== 'playing') return;
    const square = squareAt(event.clientX, event.clientY);
    if (!square) return;
    const end = state.path[state.path.length - 1];
    if (same(square, end) || canMove(puzzle, end, square) || state.path.some((p) => same(p, square))) {
      tracing = true;
      try {
        // Keep receiving finger moves even if the finger slides off the grid.
        grid.setPointerCapture(event.pointerId);
      } catch {
        // Some browsers refuse; tracing still works while over the grid.
      }
      // Tapping a square already on the path cuts the path back to it.
      const onPath = state.path.findIndex((p) => same(p, square));
      if (onPath >= 0 && onPath < state.path.length - 1) {
        state = { ...state, path: state.path.slice(0, onPath + 1) };
        draw();
      } else {
        follow(event);
      }
    } else {
      message.textContent = 'Start from the end of your path.';
    }
  });
  grid.addEventListener('pointermove', (event) => {
    if (tracing) follow(event);
  });
  const stop = () => { tracing = false; };
  grid.addEventListener('pointerup', stop);
  grid.addEventListener('pointercancel', stop);

  function draw() {
    const pathKeys = new Set(state.path.map(key));
    const hintKeys = new Set(hint.map(key));
    const endKey = key(state.path[state.path.length - 1]);
    for (const [k, square] of Object.entries(squares)) {
      square.classList.toggle('mz-path', pathKeys.has(k));
      square.classList.toggle('mz-head', k === endKey);
      square.classList.toggle('mz-glow', hintKeys.has(k));
      square.classList.toggle('mz-goal', k === key(puzzle.goal));
      square.classList.toggle('mz-start', k === key(puzzle.start));
    }
  }

  draw();
}
