// tangram-pond.js: fit the pieces into an outline to make a picture.
//
// A picture is made of 5 to 7 pieces on a 6 by 6 grid of squares. The board
// shows the pale outline of the whole picture, with a dashed place for each
// piece. The player taps a piece in the tray, then taps its place. Nothing
// turns: every piece is already the right way up. Two pieces with the same
// shape can swap places; either place is right. After two misses in a row
// with the same piece, a place that fits it glows.
//
// A shape is a list of corners, [x, y], counted in grid squares from the top
// left. Every edge is flat, upright, or a diagonal across whole squares.
// Pieces and places are named by their index in the picture's `pieces`.

import { createRandom, dealForDay } from '../seed.js';
import { make, button, shape, liveMessage, wiggle } from '../ui.js';

export const SIZE = 6;
const COLORS = ['go', 'here', 'star', 'elsewhere', 'pad', 'blush'];
const piece = (color, ...corners) => ({ shape: corners, color });

export const PICTURES = [
  { name: 'fish', pieces: [
    piece('go', [0, 2], [1, 2], [1, 3]), piece('go', [0, 4], [1, 4], [1, 3]), // the tail
    piece('here', [1, 2], [3, 2], [3, 4], [1, 4]), piece('star', [3, 2], [4, 2], [4, 4], [3, 4]),
    piece('here', [4, 2], [5, 3], [4, 4]), // the nose
    piece('blush', [1, 2], [2, 1], [3, 2]), piece('blush', [2, 4], [3, 4], [2, 5]), // fins
  ] },
  { name: 'sailboat', pieces: [
    piece('here', [0, 4], [1, 4], [1, 5]), piece('here', [1, 4], [5, 4], [5, 5], [1, 5]), piece('here', [5, 4], [6, 4], [5, 5]),
    piece('elsewhere', [3, 3], [4, 3], [4, 4], [3, 4]), // the mast
    piece('star', [3, 1], [3, 3], [1, 3]), piece('go', [3, 2], [4, 3], [3, 3]), // sails
  ] },
  { name: 'house', pieces: [
    piece('go', [1, 3], [3, 1], [5, 3]), // the roof
    piece('star', [1, 3], [3, 3], [3, 4], [1, 4]), piece('star', [3, 3], [5, 3], [5, 4], [3, 4]),
    piece('here', [1, 4], [3, 4], [3, 6], [1, 6]),
    piece('elsewhere', [3, 4], [4, 4], [4, 6], [3, 6]), piece('blush', [4, 4], [5, 4], [5, 6], [4, 6]),
  ] },
  { name: 'tree', pieces: [
    piece('pad', [2, 1], [3, 0], [4, 1]), piece('pad', [0, 3], [2, 1], [2, 3]),
    piece('here', [2, 1], [4, 1], [4, 3], [2, 3]), piece('pad', [4, 1], [6, 3], [4, 3]),
    piece('go', [2, 3], [4, 3], [4, 5], [2, 5]), // the trunk
    piece('star', [1, 5], [5, 5], [5, 6], [1, 6]), // the ground
  ] },
  { name: 'frog', pieces: [
    piece('star', [1, 1], [2, 1], [2, 2], [1, 2]), piece('star', [4, 1], [5, 1], [5, 2], [4, 2]), // eyes
    piece('pad', [1, 2], [3, 2], [3, 4], [1, 4]), piece('pad', [3, 2], [5, 2], [5, 4], [3, 4]),
    piece('here', [0, 5], [1, 4], [2, 4], [1, 5]), piece('here', [4, 4], [5, 4], [6, 5], [5, 5]), // feet
    piece('blush', [2, 4], [4, 4], [4, 5], [2, 5]),
  ] },
  { name: 'duck', pieces: [
    piece('star', [3, 1], [4, 1], [4, 2], [3, 2]), piece('go', [4, 1], [5, 2], [4, 2]), // the beak
    piece('star', [3, 2], [4, 2], [4, 3], [3, 3]),
    piece('star', [2, 3], [4, 3], [4, 5], [2, 5]), piece('blush', [1, 3], [2, 3], [2, 5], [1, 5]),
    piece('go', [0, 3], [1, 3], [1, 4]), piece('here', [4, 3], [5, 4], [4, 5]),
  ] },
  { name: 'rocket', pieces: [
    piece('go', [2, 1], [3, 0], [4, 1]),
    piece('here', [2, 1], [4, 1], [4, 3], [2, 3]), piece('elsewhere', [2, 3], [4, 3], [4, 5], [2, 5]),
    piece('blush', [0, 5], [2, 3], [2, 5]), piece('blush', [4, 3], [6, 5], [4, 5]), // fins
    piece('star', [2, 5], [4, 5], [3, 6]), // the flame
  ] },
  { name: 'cat', pieces: [
    piece('go', [1, 0], [1, 2], [3, 2]), piece('go', [5, 0], [5, 2], [3, 2]), // ears
    piece('star', [1, 2], [3, 2], [3, 4], [1, 4]), piece('star', [3, 2], [5, 2], [5, 4], [3, 4]),
    piece('blush', [1, 4], [3, 4], [3, 6]), piece('elsewhere', [3, 4], [5, 4], [3, 6]),
  ] },
  { name: 'turtle', pieces: [
    piece('pad', [0, 3], [2, 1], [2, 3]), piece('star', [2, 1], [3, 1], [3, 3], [2, 3]), piece('pad', [3, 1], [5, 3], [3, 3]),
    piece('here', [1, 3], [5, 3], [5, 4], [1, 4]),
    piece('go', [5, 3], [6, 3], [6, 4], [5, 4]), // the head
    piece('go', [1, 4], [2, 4], [2, 5], [1, 5]), piece('go', [4, 4], [5, 4], [5, 5], [4, 5]), // feet
  ] },
  { name: 'heart', pieces: [
    piece('blush', [1, 2], [2, 1], [3, 2]), piece('blush', [3, 2], [4, 1], [5, 2]),
    piece('go', [1, 2], [3, 2], [3, 3], [1, 3]), piece('go', [3, 2], [5, 2], [5, 3], [3, 3]),
    piece('elsewhere', [1, 3], [3, 3], [3, 5]), piece('blush', [3, 3], [5, 3], [3, 5]),
  ] },
];

// ---------- Shapes ----------

/** The box around a shape: its left and top edge, and how wide and tall it is. */
function box(corners) {
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  return { left, top, wide: Math.max(...xs) - left, tall: Math.max(...ys) - top };
}

/** Each corner with the corner after it: the shape's edges. */
const edges = (corners) => corners.map((corner, i) => [corner, corners[(i + 1) % corners.length]]);

/** A shape's area, by the shoelace formula. */
const area = (corners) => Math.abs(edges(corners).reduce((sum, [[x, y], [nx, ny]]) => sum + x * ny - nx * y, 0)) / 2;

/** True if the point is inside the shape (a line going right from it crosses the edge an odd number of times). */
function inside([px, py], corners) {
  const crossings = edges(corners).filter(([[x1, y1], [x2, y2]]) => (y1 > py) !== (y2 > py) && px < x1 + ((py - y1) / (y2 - y1)) * (x2 - x1));
  return crossings.length % 2 === 1;
}

/** Every grid point along a shape's edge, as text like "2,3". */
function border(corners) {
  return edges(corners).flatMap(([[x, y], [nx, ny]]) => {
    const steps = Math.max(Math.abs(nx - x), Math.abs(ny - y));
    return Array.from({ length: steps }, (_, k) => `${x + ((nx - x) / steps) * k},${y + ((ny - y) / steps) * k}`);
  });
}

// Each grid square cut into 4 triangles by its diagonals: one point inside
// each. No edge crosses a triangle, so counting the points inside a picture
// gives its area exactly (4 points to a square).
const QUARTERS = Array.from({ length: SIZE * SIZE }, (_, i) => [i % SIZE, Math.floor(i / SIZE)])
  .flatMap(([x, y]) => [[x + 0.5, y + 0.2], [x + 0.5, y + 0.8], [x + 0.2, y + 0.5], [x + 0.8, y + 0.5]]);

/** A shape moved to the top left corner, as text: the same for two shapes that match. */
function outlineOf(corners) {
  const { left, top } = box(corners);
  return corners.map(([x, y]) => `${x - left},${y - top}`).sort().join(' ');
}

/** True if the piece has the same shape as the place, after sliding it there (no turning). */
export const fits = (a, place) => outlineOf(a.shape) === outlineOf(place.shape);

// ---------- The game ----------

/** Today's picture (none repeats until all have been used), with the tray in a shuffled order. */
export function generate(seed, dayNumber = 0) {
  const [picture] = dealForDay(PICTURES, 1, dayNumber, 'tangram-pond');
  return { ...picture, tray: createRandom(seed).shuffle(picture.pieces.map((_, i) => i)) };
}

/** The starting state. `placed` says which piece is in each filled place. */
export function start(puzzle) {
  return { puzzle, placed: {}, misses: 0, helped: 0, streak: { piece: null, count: 0 }, glow: null, status: 'playing', last: null };
}

/**
 * Try a piece in a place. Returns the new state; state.last says what
 * happened: { piece, place, correct, hinted }.
 */
export function check(state, { piece: tried, place }) {
  if (state.status !== 'playing') throw new Error('The picture is already finished.');
  const { pieces } = state.puzzle;
  if (!pieces[tried] || Object.values(state.placed).includes(tried)) throw new Error(`Piece ${tried} is not in the tray.`);
  if (!pieces[place] || place in state.placed) throw new Error(`Place ${place} is not empty.`);
  const correct = fits(pieces[tried], pieces[place]);
  const placed = correct ? { ...state.placed, [place]: tried } : state.placed;
  // Misses in a row with this same piece; the second one earns a hint.
  const count = correct ? 0 : state.streak.piece === tried ? state.streak.count + 1 : 1;
  const hinted = count === 2;
  return {
    ...state,
    placed,
    misses: state.misses + (correct ? 0 : 1),
    helped: state.helped + (hinted ? 1 : 0),
    streak: { piece: correct ? null : tried, count },
    glow: hinted ? pieces.findIndex((spot, j) => !(j in placed) && fits(pieces[tried], spot)) : state.glow,
    status: Object.keys(placed).length === pieces.length ? 'won' : 'playing',
    last: { piece: tried, place, correct, hinted },
  };
}

/** Confirm a picture is well made and can be finished. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { pieces, tray } = puzzle;
  if (!Array.isArray(pieces) || pieces.length < 5 || pieces.length > 7) return { ok: false, problems: ['a picture needs 5 to 7 pieces'] };
  pieces.forEach(({ shape: corners, color }, i) => {
    if (!COLORS.includes(color)) problems.push(`piece ${i} has no color`);
    if (corners.flat().some((n) => !Number.isInteger(n) || n < 0 || n > SIZE)) problems.push(`piece ${i} is off the grid`);
    const slanted = ([[x, y], [nx, ny]]) => x !== nx && y !== ny && Math.abs(nx - x) !== Math.abs(ny - y);
    if (corners.length < 3 || edges(corners).some(slanted)) problems.push(`piece ${i} has an edge that is not flat, upright, or a square's diagonal`);
  });
  if (problems.length) return { ok: false, problems };

  // No overlaps: the pieces' areas add up to the area the picture covers,
  // and no piece's middle is inside another piece.
  const covered = QUARTERS.filter((point) => pieces.some((p) => inside(point, p.shape))).length / 4;
  if (pieces.reduce((sum, p) => sum + area(p.shape), 0) !== covered) problems.push('pieces overlap');
  pieces.forEach(({ shape: corners }, i) => {
    const middle = [0, 1].map((k) => corners.reduce((sum, corner) => sum + corner[k], 0) / corners.length);
    const under = pieces.findIndex((other, j) => j !== i && inside(middle, other.shape));
    if (under >= 0) problems.push(`piece ${i} sits on piece ${under}`);
  });
  // One picture: starting from the first piece, every piece can be reached through pieces that touch.
  const borders = pieces.map((p) => border(p.shape));
  const joined = [0];
  for (const i of joined) {
    borders.forEach((points, j) => { if (!joined.includes(j) && points.some((point) => borders[i].includes(point))) joined.push(j); });
  }
  if (joined.length < pieces.length) problems.push('the pieces do not all touch');
  if (!Array.isArray(tray) || [...tray].sort().join() !== pieces.map((_, i) => i).join()) problems.push('the tray must hold every piece once');
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

const TRAY_UNIT = 18; // px for one grid square of a tray piece

/** What to call a shape out loud (for screen readers). */
function shapeName(corners) {
  if (corners.length === 3) return 'triangle';
  const { wide, tall } = box(corners);
  if (area(corners) < wide * tall) return 'slanted shape';
  return wide === tall ? 'square' : 'rectangle';
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong places tried; helped is the hints
 * (glowing places) given.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) state = { ...state, ...session.saved };
  const keep = () => session.save?.({ placed: state.placed, misses: state.misses, helped: state.helped, streak: state.streak, glow: state.glow });
  let selected = null;

  container.replaceChildren();
  container.classList.add('tp');
  const message = liveMessage('tp-message', 'Tap a piece, then tap where it goes.');
  const board = shape('svg', { class: 'tp-board', viewBox: `0 0 ${SIZE} ${SIZE}` });
  const points = (corners) => corners.join(' ');
  // The pale picture first, then a place for each piece on top of it.
  for (const { shape: corners } of puzzle.pieces) board.append(shape('polygon', { class: 'tp-outline', points: points(corners) }));
  const places = puzzle.pieces.map(({ shape: corners }, j) => {
    const place = board.appendChild(shape('polygon', { points: points(corners), 'data-place': j, role: 'button', tabindex: 0 }));
    place.addEventListener('click', () => drop(j));
    place.addEventListener('keydown', (event) => { if (event.key === 'Enter') drop(j); });
    return place;
  });
  const tray = make('div', 'tp-tray');
  const tiles = {};
  for (const i of puzzle.tray) {
    const { shape: corners, color } = puzzle.pieces[i];
    const { left, top, wide, tall } = box(corners);
    const tile = tiles[i] = tray.appendChild(button('tp-piece', '', () => pick(i)));
    tile.dataset.piece = i;
    tile.setAttribute('aria-label', `${shapeName(corners)} piece`);
    const drawing = shape('svg', { viewBox: `${left} ${top} ${wide} ${tall}`, width: wide * TRAY_UNIT, height: tall * TRAY_UNIT });
    drawing.append(shape('polygon', { class: `tp-${color}`, points: points(corners) }));
    tile.append(drawing);
  }
  container.append(message, board, tray);

  function pick(i) {
    if (state.status !== 'playing') return;
    selected = i;
    message.textContent = 'Now tap its place in the picture.';
    draw();
  }

  function drop(place) {
    if (state.status !== 'playing' || place in state.placed) return;
    if (selected === null) {
      message.textContent = 'Tap a piece in the tray first.';
      return;
    }
    const tried = selected;
    state = check(state, { piece: tried, place });
    if (state.last.correct) {
      selected = null;
      message.textContent = '✓ It fits!';
    } else {
      message.textContent = state.last.hinted ? 'Not quite. Try the glowing place!' : 'Not quite. Look for a place with the same shape.';
      wiggle(tiles[tried]);
    }
    if (state.status === 'playing') keep();
    draw();
    if (state.status === 'won') {
      message.textContent = `It's a ${puzzle.name}!`;
      container.classList.add('finished');
      onDone({ status: state.status, misses: state.misses, helped: state.helped });
    }
  }

  function draw() {
    places.forEach((place, j) => {
      const filled = j in state.placed;
      place.setAttribute('class', filled ? `tp-place-done tp-${puzzle.pieces[state.placed[j]].color}` : 'tp-place' + (state.glow === j ? ' tp-glow' : ''));
      place.setAttribute('aria-label', `Place ${j + 1}: ${filled ? 'filled' : state.glow === j ? 'empty, glowing' : 'empty'}`);
    });
    for (const [i, tile] of Object.entries(tiles)) {
      const used = Object.values(state.placed).includes(Number(i));
      tile.className = 'tp-piece' + (used ? ' tp-piece-used' : '') + (Number(i) === selected ? ' tp-selected' : '')
        + (tile.classList.contains('np-wiggle') ? ' np-wiggle' : '');
      tile.setAttribute('aria-pressed', Number(i) === selected);
      tile.disabled = used || state.status !== 'playing';
    }
  }

  draw();
}
