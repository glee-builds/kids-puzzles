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

// The pictures. There are 38, and the dots count 3 ways, so the same picture
// with the same numbers comes back only every 114 days. (Keep the number of
// pictures from being a multiple of 3, or each picture would always get the
// same numbers.)
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
  arrow: [[6, 38], [30, 38], [54, 38], [54, 14], [94, 50], [54, 86], [54, 62], [30, 62], [6, 62]],
  butterfly: [[50, 34], [72, 8], [94, 22], [80, 48], [92, 76], [68, 90], [50, 66], [32, 90], [8, 76], [20, 48], [6, 22], [28, 8]],
  shirt: [[30, 8], [50, 18], [70, 8], [94, 28], [84, 48], [68, 38], [68, 92], [32, 92], [32, 38], [16, 48], [6, 28]],
  mug: [[14, 14], [70, 14], [70, 30], [92, 34], [92, 62], [70, 66], [66, 90], [18, 90]],
  flag: [[10, 6], [30, 6], [94, 32], [30, 58], [30, 94], [10, 94], [10, 64], [10, 34]],
  'lightning bolt': [[60, 4], [41, 28], [22, 52], [46, 52], [32, 96], [80, 40], [56, 40], [78, 4]],
  moon: [[62, 6], [34, 14], [14, 36], [10, 62], [26, 84], [52, 94], [80, 86], [58, 72], [44, 50], [46, 26]],
  tent: [[50, 8], [71, 48], [92, 88], [64, 88], [50, 60], [36, 88], [8, 88], [29, 48]],
  'plus sign': [[36, 6], [64, 6], [64, 36], [94, 36], [94, 64], [64, 64], [64, 94], [36, 94], [36, 64], [6, 64], [6, 36], [36, 36]],
  'stop sign': [[34, 6], [66, 6], [94, 34], [94, 66], [66, 94], [34, 94], [6, 66], [6, 34]],
  'ice cream cone': [[50, 96], [30, 56], [14, 48], [12, 26], [30, 8], [50, 4], [70, 8], [88, 26], [86, 48], [70, 56]],
  bow: [[6, 18], [40, 40], [60, 40], [94, 18], [94, 82], [60, 60], [40, 60], [6, 82]],
  tulip: [[42, 94], [42, 58], [18, 44], [14, 10], [34, 26], [50, 6], [66, 26], [86, 10], [82, 44], [58, 58], [58, 94]],
  truck: [[6, 36], [54, 36], [54, 20], [76, 20], [94, 46], [94, 80], [70, 80], [40, 80], [6, 80]],
  bottle: [[40, 6], [60, 6], [60, 28], [76, 46], [76, 94], [24, 94], [24, 46], [40, 28]],
  shield: [[12, 12], [50, 6], [88, 12], [88, 52], [72, 78], [50, 94], [28, 78], [12, 52]],
  castle: [[10, 94], [10, 24], [26, 24], [26, 40], [42, 40], [42, 24], [58, 24], [58, 40], [74, 40], [74, 24], [90, 24], [90, 94]],
  egg: [[50, 6], [76, 24], [88, 52], [74, 78], [50, 94], [26, 78], [12, 52], [24, 24]],
  kite: [[50, 4], [68, 20], [86, 36], [68, 58], [50, 80], [32, 58], [14, 36], [32, 20]],
  ghost: [[50, 6], [76, 16], [88, 40], [88, 92], [70, 76], [50, 92], [30, 76], [12, 92], [12, 40], [24, 16]],
  'pair of pants': [[20, 6], [50, 6], [80, 6], [90, 94], [62, 94], [50, 46], [38, 94], [10, 94]],
  boot: [[30, 6], [60, 6], [60, 30], [60, 54], [92, 70], [92, 92], [60, 92], [30, 92], [30, 50]],
  'pizza slice': [[50, 96], [30, 56], [10, 16], [30, 8], [50, 4], [70, 8], [90, 16], [70, 56]],
  hat: [[26, 10], [74, 10], [74, 62], [94, 62], [94, 80], [6, 80], [6, 62], [26, 62]],
  table: [[6, 20], [94, 20], [94, 40], [78, 40], [78, 92], [62, 92], [62, 40], [38, 40], [38, 92], [22, 92], [22, 40], [6, 40]],
  stairs: [[6, 94], [6, 72], [28, 72], [28, 50], [50, 50], [50, 28], [72, 28], [72, 6], [94, 6], [94, 94]],
  'paper plane': [[6, 44], [50, 26], [94, 6], [78, 50], [62, 94], [54, 76], [46, 60], [26, 52]],
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
      message.textContent = `It's ${/^[aeiou]/.test(picture) ? 'an' : 'a'} ${picture}! You counted by ${step}s to ${labels.at(-1)}.`;
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
