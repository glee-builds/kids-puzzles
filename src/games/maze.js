// maze.js: trace a path through a maze with your finger.
//
// There are two mazes a day, Maze 1 and Maze 2, both about 20 by 20 squares
// (the same code; the app asks for the second one). A maze isn't always a
// square: each has a different outline (a round pond, a lily pad, a
// diamond...), and the day's two never share one. Squares outside the
// outline aren't part of it.
//
// The grid is shaped to fit the screen (`gridFor`): tall and narrow on a
// phone, close to square on an iPad held upright, wide on one held
// sideways. It has about the same number of squares either way, so the
// squares can be as big as the screen allows.
//
// It is a "perfect" maze: every square can be reached, and there is exactly
// one route between any two squares. The star is put on the square that is
// farthest from the start, so the one way there is as long as it can be.
//
// Squares are [row, col] pairs. Walls are stored per square as a number
// made of these flags: N (wall above), E (right), S (below), W (left). A
// square outside the outline has null instead of a number.

import { createRandom } from '../seed.js';
import { make, button, liveMessage, trace } from '../ui.js';

export const SIZE = 30;      // the size the outlines are drawn for, and the size when none is given
export const SMALL_SIZE = 20; // the day's two mazes
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const ALL_WALLS = N | E | S | W;
const HINT_STEPS = 8;

// The outlines. Each says whether a square is inside, given how far it is
// from the middle of the grid: dr rows down and dc columns across, both
// counted as if the grid were 30 by 30 (about -15 to 15), so the same rule
// works at any size, and stretches with a grid that is taller or wider.
export const SHAPES = {
  square: () => true,
  pond: (dr, dc) => Math.hypot(dr, dc) <= 15.2,
  // A lily pad: a pond with a wedge cut out of the top.
  'lily pad': (dr, dc) => Math.hypot(dr, dc) <= 15.2 && !(dr < -2 && Math.abs(dc) < -dr * 0.35),
  diamond: (dr, dc) => Math.abs(dr) + Math.abs(dc) <= 16,
  plus: (dr, dc) => Math.abs(dr) <= 6 || Math.abs(dc) <= 6,
  // A house: a pointed roof on top of a wide box.
  house: (dr, dc) => (dr >= -3 ? Math.abs(dc) <= 12 : Math.abs(dc) <= dr + 16.5),
  egg: (dr, dc) => (dr / 15.2) ** 2 + (dc / 11.5) ** 2 <= 1,
};

const MOVES = [
  { wall: N, opposite: S, dr: -1, dc: 0 },
  { wall: E, opposite: W, dr: 0, dc: 1 },
  { wall: S, opposite: N, dr: 1, dc: 0 },
  { wall: W, opposite: E, dr: 0, dc: -1 },
];

const key = ([r, c]) => `${r}-${c}`;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

/** True if [r, c] is a square of the maze (inside the grid and inside the outline). */
const inMaze = (walls, r, c) => walls[r]?.[c] != null;

/** How far every reachable square is from `from`, in steps, as a Map of "r-c" to steps. */
function distances(puzzle, from) {
  const steps = new Map([[key(from), 0]]);
  const queue = [from];
  while (queue.length > 0) {
    const square = queue.shift();
    for (const next of neighbors(puzzle, square)) {
      if (!steps.has(key(next))) {
        steps.set(key(next), steps.get(key(square)) + 1);
        queue.push(next);
      }
    }
  }
  return steps;
}

/**
 * How many columns and rows a maze of `size` gets, to fill `room`: the
 * space for the maze on the screen, { width, height }. It keeps about
 * size x size squares, in the shape of the room. With no room given (or
 * one that isn't a real size) the grid is size by size.
 */
export function gridFor(size, room) {
  if (!(room?.width > 0) || !(room?.height > 0)) return { cols: size, rows: size };
  // Never more than twice as long one way as the other.
  const shape = Math.min(Math.max(room.width / room.height, 0.5), 2);
  const cols = Math.round(size * Math.sqrt(shape));
  return { cols, rows: Math.round((size * size) / cols) };
}

/**
 * Make today's maze. It picks an outline, then starts with every wall up
 * and wanders from the start, knocking down walls into squares it hasn't
 * visited yet, and backs up when stuck. This always makes a perfect maze.
 * `size` is how many squares across a square one would be (30 if left
 * out). `shape` picks the outline by name; left out, the seed picks one.
 * `room` is the space on the screen ({ width, height }); see gridFor.
 * `second` makes the day's second maze: other paths, and another outline.
 */
export function generate(seed, size = SIZE, shape, room, second = false) {
  // A different size gets different random numbers.
  const names = Object.keys(SHAPES);
  const first = createRandom(seed + (size - SIZE)).pick(names); // the first maze's outline
  const random = createRandom(seed + (size - SIZE) + (second ? 1 : 0));
  const picked = random.pick(second ? names.filter((other) => other !== first) : names);
  const name = SHAPES[shape] ? shape : picked;
  const { cols, rows } = gridFor(size, room);
  const walls = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) =>
    (SHAPES[name]((r - (rows - 1) / 2) * (SIZE / rows), (c - (cols - 1) / 2) * (SIZE / cols)) ? ALL_WALLS : null)));

  // Start at the first square of the top row of the outline.
  const top = walls.findIndex((row) => row.some((w) => w != null));
  const startSquare = [top, walls[top].findIndex((w) => w != null)];
  const visited = new Set([key(startSquare)]);
  const stack = [startSquare];

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const options = MOVES.filter(({ dr, dc }) => inMaze(walls, r + dr, c + dc) && !visited.has(key([r + dr, c + dc])));
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

  // The star goes on the square that takes the most steps to reach.
  const puzzle = { size, cols, rows, shape: name, walls, start: startSquare, goal: startSquare };
  let far = 0;
  for (const [square, steps] of distances(puzzle, startSquare)) {
    if (steps > far) {
      far = steps;
      puzzle.goal = square.split('-').map(Number);
    }
  }
  return puzzle;
}

/** True when you can step from square `a` to square `b` (next to it, no wall). */
export function canMove(puzzle, a, b) {
  const move = MOVES.find(({ dr, dc }) => a[0] + dr === b[0] && a[1] + dc === b[1]);
  if (!move) return false;
  return inMaze(puzzle.walls, b[0], b[1]) && inMaze(puzzle.walls, a[0], a[1]) && (puzzle.walls[a[0]][a[1]] & move.wall) === 0;
}

function neighbors(puzzle, square) {
  return MOVES
    .map(({ dr, dc }) => [square[0] + dr, square[1] + dc])
    .filter((next) => canMove(puzzle, square, next));
}

// The route for each puzzle, kept once it has been worked out: a big maze
// asks for it on every step.
const routes = new WeakMap();

/** The one route from start to goal, as a list of squares. */
export function solution(puzzle) {
  if (!routes.has(puzzle)) routes.set(puzzle, findRoute(puzzle));
  return routes.get(puzzle);
}

function findRoute(puzzle) {
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
  const { walls } = puzzle;
  const { cols = puzzle.size, rows = puzzle.size } = puzzle;
  if (!Array.isArray(walls) || walls.length !== rows || walls.some((row) => row.length !== cols)) {
    return { ok: false, problems: [`walls must be ${cols} across and ${rows} down`] };
  }

  // Walls must match on both sides, and the outside edge must be closed.
  let openings = 0;
  let squares = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inMaze(walls, r, c)) continue;
      squares++;
      for (const { wall, opposite, dr, dc } of MOVES) {
        const nr = r + dr;
        const nc = c + dc;
        const open = (walls[r][c] & wall) === 0;
        if (!inMaze(walls, nr, nc)) {
          if (open) problems.push(`square ${r},${c} has a hole in the outside wall`);
        } else if (open !== ((walls[nr][nc] & opposite) === 0)) {
          problems.push(`wall between ${r},${c} and ${nr},${nc} doesn't match`);
        } else if (open) {
          openings++;
        }
      }
    }
  }
  if (!inMaze(walls, ...puzzle.start) || !inMaze(walls, ...puzzle.goal)) {
    return { ok: false, problems: [...problems, 'the start and the star must be inside the maze'] };
  }

  // A perfect maze: every square reachable, and exactly (squares - 1) openings.
  const seen = distances(puzzle, puzzle.start);
  if (seen.size !== squares) problems.push('some squares cannot be reached');
  if (openings / 2 !== squares - 1) problems.push('there is more than one route somewhere (a loop)');
  if (!solution(puzzle)) problems.push('there is no route from start to star');

  return { ok: problems.length === 0, problems };
}

// ---------- The screen: the maze grid, a message line, and a Hint button. ----------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is always 0 (tracing has no wrong answers)
 * and helped is how many times Hint was pressed.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let hint = [];
  let wrongTurnSaid = false;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js):
  // walk the saved path again, one square at a time, and use it only if every step is allowed.
  const saved = session.saved;
  const savedPath = Array.isArray(session.saved?.path) ? session.saved.path : [];
  if (savedPath.length > 0 && savedPath.every(Array.isArray) && same(savedPath[0], puzzle.start)) {
    let walked = state;
    for (const square of savedPath.slice(1)) walked = step(walked, square);
    if (walked.path.length === savedPath.length && walked.status === 'playing') {
      state = { ...walked, hints: Number(session.saved.hints) || 0 };
    }
  }
  const keep = () => {
    if (state.status === 'playing') session.save?.({ path: state.path, hints: state.hints });
  };

  container.replaceChildren();
  container.classList.add('mz');

  const message = liveMessage('mz-message', 'Put your finger on the green dot and trace to the star.');

  const grid = make('div', 'mz-grid');
  const { cols = puzzle.size, rows = puzzle.size } = puzzle;
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--rows', rows);
  const squares = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const w = puzzle.walls[r][c];
      if (w == null) {
        grid.append(make('div', 'mz-out')); // outside the outline: an empty spot
        continue;
      }
      const square = make('div', 'mz-cell');
      square.dataset.r = r;
      square.dataset.c = c;
      // Each square draws its top and left walls. A square on the right or
      // bottom edge of the outline also draws that edge.
      if (w & N) square.classList.add('mz-n');
      if (w & W) square.classList.add('mz-w');
      if (w & E && puzzle.walls[r][c + 1] == null) square.classList.add('mz-e');
      if (w & S && puzzle.walls[r + 1]?.[c] == null) square.classList.add('mz-s');
      grid.append(square);
      squares[key([r, c])] = square;
    }
  }

  const hintButton = button('lw-button hint-button', 'Hint', () => {
    if (state.status !== 'playing') return;
    hint = hintSquares(state);
    state = { ...state, hints: state.hints + 1 };
    message.textContent = offRoute(state)
      ? 'Trace back to where the glow starts, then follow it.'
      : 'Follow the glowing squares.';
    keep();
    draw();
  });

  container.append(message, grid, hintButton);

  function moveTo(square) {
    const before = state.path.length;
    state = step(state, square);
    if (state.path.length === before) return;
    hint = hint.filter((h) => !state.path.some((p) => same(p, h)));
    if (state.status === 'won') {
      message.textContent = 'You made it to the star!';
      draw();
      container.classList.add('finished');
      onDone({ status: state.status, misses: 0, helped: state.hints });
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
  function follow(target) {
    if (state.status !== 'playing') return;
    // Only fill small gaps (a quick finger). A big jump is ignored, so the
    // maze never walks itself toward a far-away finger.
    const end = state.path[state.path.length - 1];
    if (Math.abs(target[0] - end[0]) + Math.abs(target[1] - end[1]) > 2) return;
    for (let guard = 0; guard < 8; guard++) {
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

  trace(grid, {
    // Tracing starts from the end of the path, a square next to it, or a
    // square on the path (which cuts the path back to it).
    onStart(square) {
      if (state.status !== 'playing') return false;
      const end = state.path[state.path.length - 1];
      const onPath = state.path.findIndex((p) => same(p, square));
      if (onPath === -1 && !canMove(puzzle, end, square)) {
        message.textContent = 'Start from the end of your path.';
        return false;
      }
      if (onPath >= 0 && onPath < state.path.length - 1) {
        state = { ...state, path: state.path.slice(0, onPath + 1) };
        draw();
      }
      return true;
    },
    onMove: follow,
    onEnd: keep, // the finger lifted: save the path so far
  });

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

  if (state.path.length > 1) message.textContent = 'Start from the end of your path.';
  draw();
}
