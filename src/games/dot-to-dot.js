// dot-to-dot.js: join the dots in counting order to draw a picture.
//
// The dots aren't numbered 1, 2, 3: they count by 3s, by 4s, or by 6s (a
// different one each day), so joining them is skip counting: 3, 6, 9, 12...
// Tap each dot in order, or drag a finger from dot to dot. A wrong dot
// wiggles (no penalty); after two misses in a row the next dot glows.
//
// A picture is a list of points around its outline, on a 100 by 100 board
// ([x, y], with y counted down from the top). The last dot joins back to
// the first.

import { dealForDay } from '../seed.js';
import { make, button, shape, liveMessage, wiggle } from '../ui.js';

export const STEPS = [3, 4, 6]; // what the dots count by, one a day in turn
export const MIN_GAP = 15; // dots are at least this far apart, so a finger can hit one
export const MISSES_BEFORE_GLOW = 2;

export const PICTURES = {
  star: [[50, 6], [62, 36], [94, 38], [69, 58], [77, 89], [50, 72], [23, 89], [31, 58], [6, 38], [38, 36]],
  house: [[50, 6], [70, 23], [92, 44], [76, 44], [76, 92], [50, 92], [24, 92], [24, 44], [8, 44], [30, 23]],
  fish: [[6, 50], [26, 32], [50, 26], [72, 40], [94, 22], [94, 78], [72, 60], [50, 74], [26, 68]],
  sailboat: [[50, 6], [86, 52], [60, 52], [60, 68], [94, 68], [76, 92], [24, 92], [6, 68], [40, 68], [40, 50]],
  heart: [[50, 26], [64, 10], [82, 10], [94, 26], [90, 48], [72, 68], [50, 90], [28, 68], [10, 48], [6, 26], [18, 10], [36, 10]],
  rocket: [[50, 4], [68, 28], [68, 60], [86, 84], [64, 78], [58, 94], [42, 94], [36, 78], [14, 84], [32, 60], [32, 28]],
  tree: [[50, 4], [76, 32], [58, 38], [86, 66], [60, 70], [60, 94], [40, 94], [40, 70], [14, 66], [42, 38], [24, 32]],
  crown: [[8, 30], [30, 52], [50, 14], [70, 52], [92, 30], [86, 84], [62, 84], [38, 84], [14, 84]],
  gem: [[28, 12], [50, 12], [72, 12], [94, 38], [72, 66], [50, 92], [28, 66], [6, 38]],
  mushroom: [[6, 52], [14, 28], [34, 10], [66, 10], [86, 28], [94, 52], [64, 52], [66, 90], [34, 90], [36, 52]],
  cat: [[10, 8], [34, 26], [66, 26], [90, 8], [92, 56], [76, 82], [50, 92], [24, 82], [8, 56]],
};

/** Today's picture and what its dots count by. `dayNumber` counts days from a fixed start date. */
export function generate(seed, dayNumber = 0) {
  const [picture] = dealForDay(Object.keys(PICTURES), 1, dayNumber, 'dot-to-dot');
  const step = STEPS[dayNumber % STEPS.length];
  const points = PICTURES[picture];
  return { picture, step, points, labels: points.map((_, i) => step * (i + 1)) };
}

/** The starting state: no dots joined; `next` is the dot to tap. */
export function start(puzzle) {
  return { puzzle, next: 0, tries: 0, status: 'playing', last: null };
}

/** Tap dot number `dot` (0 is the first). The right one joins on; a wrong one doesn't. */
export function check(state, dot) {
  if (state.status !== 'playing') throw new Error('The picture is finished.');
  const correct = dot === state.next;
  const next = correct ? state.next + 1 : state.next;
  return {
    ...state,
    next,
    tries: correct ? 0 : state.tries + 1,
    status: next >= state.puzzle.points.length ? 'won' : 'playing',
    last: { dot, correct },
  };
}

/** A hint about the dot to tap next. */
export function hint(state) {
  const { step, labels } = state.puzzle;
  if (state.next === 0) return `Start at ${step}.`;
  return `After ${labels[state.next - 1]} comes ${labels[state.next]}. Add ${step}.`;
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { points, step, labels } = puzzle;
  if (!STEPS.includes(step)) problems.push(`the dots can't count by ${step}`);
  if (!Array.isArray(points) || points.length < 8 || points.length > 12) return { ok: false, problems: [...problems, 'a picture has 8 to 12 dots'] };
  points.forEach(([x, y], i) => {
    if (!(x >= 4 && x <= 96 && y >= 4 && y <= 96)) problems.push(`dot ${i + 1} is off the board`);
    if (labels[i] !== step * (i + 1)) problems.push(`dot ${i + 1} should say ${step * (i + 1)}`);
    for (let j = 0; j < i; j++) {
      if (Math.hypot(x - points[j][0], y - points[j][1]) < MIN_GAP) problems.push(`dots ${j + 1} and ${i + 1} are too close together`);
    }
  });
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong dots tapped; helped is how many
 * times the next dot glowed.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0;
  let helped = 0;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, next: session.saved.next };
    ({ misses, helped } = session.saved);
  }
  const keep = () => session.save?.({ next: state.next, misses, helped });
  const { points, labels, step, picture } = puzzle;

  container.replaceChildren();
  container.classList.add('dd');
  const message = liveMessage('dd-message', `Count by ${step}s. ${hint(state)}`);
  const board = make('div', 'dd-board');
  const drawing = shape('svg', { viewBox: '0 0 100 100', class: 'dd-drawing', 'aria-hidden': 'true' });
  const line = shape('polyline', { class: 'dd-line' });
  drawing.append(line);
  board.append(drawing);

  const dots = points.map(([x, y], i) => {
    const dot = button('dd-dot', String(labels[i]), () => tap(i));
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    dot.dataset.dot = i;
    board.append(dot);
    return dot;
  });

  // Dragging a finger across the board joins the next dot when it's reached.
  // (A drag never counts as a miss: only a tap on a wrong dot does.)
  board.addEventListener('pointermove', (event) => {
    if (event.buttons === 0 && event.pointerType === 'mouse') return;
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-dot]');
    if (under && Number(under.dataset.dot) === state.next && state.status === 'playing') tap(state.next);
  });

  container.append(message, board);

  function draw() {
    const joined = points.slice(0, state.next).map(([x, y]) => `${x},${y}`);
    if (state.status === 'won') joined.push(`${points[0][0]},${points[0][1]}`); // back to the start
    line.setAttribute('points', joined.join(' '));
    line.classList.toggle('dd-line-done', state.status === 'won');
    dots.forEach((dot, i) => {
      dot.classList.toggle('dd-dot-done', i < state.next);
      dot.classList.toggle('dd-dot-glow', i === state.next && state.tries >= MISSES_BEFORE_GLOW);
      dot.disabled = state.status === 'won';
    });
  }

  function tap(i) {
    if (state.status !== 'playing' || i < state.next) return;
    const glowing = state.tries >= MISSES_BEFORE_GLOW;
    state = check(state, i);
    if (!state.last.correct) {
      misses += 1;
      if (!glowing && state.tries >= MISSES_BEFORE_GLOW) helped += 1;
      message.textContent = `Not that one. ${hint(state)}`;
      wiggle(dots[i]);
    } else if (state.status === 'won') {
      message.textContent = `It's a ${picture}! You counted by ${step}s to ${labels.at(-1)}.`;
      container.classList.add('finished');
      draw();
      onDone({ status: state.status, misses, helped });
      return;
    } else {
      message.textContent = `${labels[i]}! What comes next?`;
    }
    keep();
    draw();
  }

  draw();
}
