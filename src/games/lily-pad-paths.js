// lily-pad-paths.js: join each pair of matching animals with a path of lily pads.
//
// A grid of pads has pairs of animals on it. A path goes from one animal to
// its match, one pad at a time: up, down, left or right. Paths may not cross
// or share a pad. When every pair is joined the puzzle is solved; the paths
// don't have to cover every pad, and any paths that work are right.
//
// Levels: 1 = 5 by 5 with 3 pairs, 2 = 5 by 5 with 4 pairs, 3 = 6 by 6 with 5 pairs.
//
// A square is a [row, column] pair. A puzzle is
//   { level, size, pairs: [{ emoji, name, ends: [square, square] }], solution: [path, ...] }
// where `solution` has one path (a list of squares) for each pair. It is one
// way to solve the puzzle, kept for the Hint button and the tests.

import { createRandom, forLevel } from '../seed.js';
import { make, button, liveMessage, trace } from '../ui.js';

export const BOARDS = [{ size: 5, count: 3 }, { size: 5, count: 4 }, { size: 6, count: 5 }];
const ANIMALS = [['🐸', 'frog'], ['🦆', 'duck'], ['🐢', 'turtle'], ['🐟', 'fish'], ['🦋', 'butterfly'], ['🐝', 'bee']];
// Each pair's path has its own mark as well as its own color (see .lp-p0 to .lp-p4 in styles.css).
const MARKS = ['●', '▲', '■', '◆', '★'];

const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const nextTo = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
const has = (path, square) => path.some((other) => same(other, square));
const plural = (name) => (name.endsWith('y') ? `${name.slice(0, -1)}ies` : name.endsWith('h') ? name : `${name}s`);

/**
 * Make today's puzzle, solved first. One long path snakes back and forth
 * over every square (flipped or turned by the seed), then it is cut into one
 * piece for each pair. The two ends of a piece get a pair of animals, so the
 * pieces themselves are a way to solve it.
 */
export function generate(seed, level = 1) {
  const { size, count } = forLevel(BOARDS, level);
  const random = createRandom(seed);
  const [upsideDown, mirrored, turned] = [0, 0, 0].map(() => random.int(0, 1) === 1);
  const snake = Array.from({ length: size * size }, (_, i) => {
    const r = Math.floor(i / size);
    const c = r % 2 ? size - 1 - (i % size) : i % size; // every other row runs backwards
    const square = [upsideDown ? size - 1 - r : r, mirrored ? size - 1 - c : c];
    return turned ? square.reverse() : square;
  });

  // Cut at random places until every piece is at least 3 squares long and
  // its two ends aren't neighbours (that pair would already be joined).
  let solution;
  do {
    const cuts = random.shuffle(snake.map((_, i) => i).slice(1)).slice(0, count - 1).sort((a, b) => a - b);
    solution = [0, ...cuts].map((from, i) => snake.slice(from, cuts[i] ?? snake.length));
  } while (solution.some((path) => path.length < 3 || nextTo(path[0], path.at(-1))));

  const animals = random.shuffle(ANIMALS).slice(0, count);
  const pairs = solution.map((path, i) => ({ emoji: animals[i][0], name: animals[i][1], ends: [path[0], path.at(-1)] }));
  return { level, size, pairs, solution };
}

/** The starting state: no paths yet. */
export function start(puzzle) {
  return { puzzle, paths: puzzle.pairs.map(() => []), status: 'playing' };
}

/** True when pair number `pair` has a path from one animal to the other. */
export function isJoined(state, pair) {
  const path = state.paths[pair];
  return path.length > 1 && has(state.puzzle.pairs[pair].ends, path.at(-1));
}

/** True when every pair is joined. */
export const isSolved = (state) => state.paths.every((_, pair) => isJoined(state, pair));

/**
 * Move the end of pair number `pair`'s path to `square`. Returns the new
 * state, or the same state when nothing changes.
 *   - No path yet: it starts on one of the pair's own animals.
 *   - The square just before the end: the path gets shorter (tracing back).
 *   - A free square next to the end, or the matching animal: the path grows.
 *   - Anything else (another animal, another path, too far): nothing changes.
 */
export function step(state, pair, square) {
  const { puzzle, paths } = state;
  const path = paths[pair];
  if (state.status !== 'playing' || !path) return state;
  const mine = has(puzzle.pairs[pair].ends, square);
  const taken = paths.some((other) => has(other, square)) || (!mine && puzzle.pairs.some(({ ends }) => has(ends, square)));

  let changed;
  if (path.length === 0) changed = mine ? [square] : null;
  else if (path.length > 1 && same(square, path.at(-2))) changed = path.slice(0, -1);
  else if (!isJoined(state, pair) && !taken && nextTo(path.at(-1), square)) changed = [...path, square];
  if (!changed) return state;

  const next = { ...state, paths: paths.map((other, i) => (i === pair ? changed : other)) };
  return isSolved(next) ? { ...next, status: 'won' } : next;
}

/** The same move in the shape every game has: check(state, { pair, square }). */
export const check = (state, { pair, square }) => step(state, pair, square);

/** Confirm a puzzle is valid, and that its stored solution really solves it. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { size, pairs, solution } = puzzle;
  const inside = (square) => Array.isArray(square) && square.every((n) => Number.isInteger(n) && n >= 0 && n < size);
  if (!Array.isArray(pairs) || !Array.isArray(solution) || pairs.length !== solution.length || pairs.length === 0) {
    return { ok: false, problems: ['there must be one solution path for each pair'] };
  }
  const ends = pairs.flatMap((pair) => pair.ends);
  if (!ends.every(inside)) problems.push('an animal is outside the grid');
  if (new Set(ends.map(String)).size !== ends.length) problems.push('two animals are on the same square');

  solution.forEach((path, i) => {
    const [a, b] = pairs[i].ends;
    const joins = path.length > 1 && ((same(path[0], a) && same(path.at(-1), b)) || (same(path[0], b) && same(path.at(-1), a)));
    if (!joins) problems.push(`path ${i} doesn't go from one ${pairs[i].name} to the other`);
    if (!path.every(inside)) problems.push(`path ${i} leaves the grid`);
    if (path.some((square, k) => k > 0 && !nextTo(path[k - 1], square))) problems.push(`path ${i} jumps between squares that aren't neighbours`);
  });
  const used = solution.flat().map(String);
  if (new Set(used).size !== used.length) problems.push('a square is used twice');
  return { ok: problems.length === 0, problems };
}

// ---------- The screen: a message line, the grid of pads, and a Hint button. ----------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when every pair is joined: misses is always 0 (tracing has no wrong
 * answers) and helped is how many times Hint was pressed.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let selected = null; // the number of the pair whose path is being drawn
  let hint = null;     // the number of the pair whose solution path is glowing
  let helped = 0;

  // Pick up where a half-done puzzle left off: draw each saved path again, one
  // square at a time, and keep it only if every step is allowed.
  const savedPaths = Array.isArray(session.saved?.paths) ? session.saved.paths : [];
  puzzle.pairs.forEach((_, pair) => {
    const path = Array.isArray(savedPaths[pair]) ? savedPaths[pair].filter(Array.isArray) : [];
    const walked = path.reduce((now, square) => step(now, pair, square), state);
    if (walked.paths[pair].length === path.length && walked.status === 'playing') state = walked;
  });
  if (savedPaths.length > 0) helped = Number(session.saved.helped) || 0;
  const keep = () => {
    if (state.status === 'playing') session.save?.({ paths: state.paths, helped });
  };

  container.replaceChildren();
  container.classList.add('lp');
  const message = liveMessage('lp-message', 'Put your finger on an animal and trace to its match.');
  const grid = make('div', 'lp-grid');
  grid.style.setProperty('--n', puzzle.size);
  const cells = [];
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      const cell = button('lp-cell');
      cell.dataset.r = r;
      cell.dataset.c = c;
      cells.push({ cell, square: [r, c], home: puzzle.pairs.findIndex(({ ends }) => has(ends, [r, c])) });
      grid.append(cell);
    }
  }

  const hintButton = button('lw-button hint-button', 'Hint', () => {
    hint = state.paths.findIndex((_, pair) => !isJoined(state, pair));
    if (state.status !== 'playing' || hint === -1) return;
    helped += 1;
    const blocked = puzzle.solution[hint].some((square) => state.paths.some((path, pair) => pair !== hint && has(path, square)));
    message.textContent = blocked
      ? 'Clear the path that is in the way first.'
      : `Follow the glowing pads to join the ${plural(puzzle.pairs[hint].name)}.`;
    keep();
    draw();
  });
  container.append(message, grid, hintButton);

  /** Try a move for the picked pair. Returns true if the path changed. */
  function move(square) {
    const before = state;
    state = step(state, selected, square);
    if (state === before) return false;
    if (isJoined(state, selected)) {
      if (hint === selected) hint = null;
      message.textContent = `The ${plural(puzzle.pairs[selected].name)} are joined!`;
    }
    draw();
    if (state.status === 'won') {
      message.textContent = 'Every pair is joined!';
      container.classList.add('finished');
      onDone({ status: 'won', misses: 0, helped });
    }
    return true;
  }

  /**
   * A finger going down on `square`, or a tap or key press on it.
   *   - An animal: picks that pair and starts its path again from there
   *     (unless it is the match the picked path has just reached).
   *   - A square on a path: picks that pair and cuts its path back to there.
   *   - Any other square: the picked path tries to move there.
   */
  function touch(square) {
    if (state.status !== 'playing') return false;
    const home = puzzle.pairs.findIndex(({ ends }) => has(ends, square));
    const owner = state.paths.findIndex((path) => has(path, square));
    if (home >= 0 && home === selected && move(square)) return true;
    if (home >= 0 || owner >= 0) {
      selected = home >= 0 ? home : owner;
      const path = home >= 0 ? [square] : state.paths[owner].slice(0, state.paths[owner].findIndex((other) => same(other, square)) + 1);
      state = { ...state, paths: state.paths.map((other, i) => (i === selected ? path : other)) };
      draw();
    } else if (selected !== null) {
      move(square);
    }
    return selected !== null;
  }

  trace(grid, {
    onStart: touch,
    onMove(square) {
      // A finger that cuts a corner skips a square: go through a free corner square first.
      const end = state.paths[selected].at(-1);
      if (end && Math.abs(square[0] - end[0]) === 1 && Math.abs(square[1] - end[1]) === 1) {
        if (!move([end[0], square[1]])) move([square[0], end[1]]);
      }
      move(square);
    },
    onEnd: keep, // the finger lifted: save the paths so far
  });
  // Tapping with a keyboard or a switch works too. A finger's tap has already
  // been handled by the tracing above; only its click has a count (detail) above 0.
  grid.addEventListener('click', (event) => {
    const cell = event.detail === 0 && event.target.closest('[data-r]');
    if (!cell) return;
    touch([Number(cell.dataset.r), Number(cell.dataset.c)]);
    keep();
  });

  function draw() {
    for (const { cell, square, home } of cells) {
      const owner = home >= 0 ? home : state.paths.findIndex((path) => has(path, square));
      const onPath = owner >= 0 && has(state.paths[owner], square);
      const name = owner >= 0 ? puzzle.pairs[owner].name : '';
      cell.className = `lp-cell${owner >= 0 ? ` lp-p${owner}` : ''}`;
      cell.classList.toggle('lp-end', home >= 0);
      cell.classList.toggle('lp-path', onPath);
      cell.classList.toggle('lp-joined', onPath && isJoined(state, owner));
      cell.classList.toggle('lp-tip', onPath && owner === selected && same(state.paths[owner].at(-1), square));
      cell.classList.toggle('lp-glow', hint !== null && has(puzzle.solution[hint], square));
      cell.textContent = home >= 0 ? puzzle.pairs[home].emoji : onPath ? MARKS[owner] : '';
      const where = `row ${square[0] + 1}, column ${square[1] + 1}`;
      cell.setAttribute('aria-label', home >= 0
        ? `${name}${isJoined(state, home) ? ', joined' : ''}, ${where}`
        : `${onPath ? `${name} path` : 'empty pad'}, ${where}`);
    }
  }

  if (state.paths.some((path) => path.length > 0)) message.textContent = 'Keep going: join each animal to its match.';
  draw();
}
