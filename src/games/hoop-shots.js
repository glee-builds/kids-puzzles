// hoop-shots.js: a just-for-fun game of basketball. Swipe up on the ball to
// shoot; reach 20 points and the game is done.
//
// A switch picks the shot: "2 points" from close in, or "3 points" from
// farther back, where the hoop looks smaller and the swipe has to be longer
// and straighter. A miss costs nothing: the ball just comes back.
//
// Without swiping: with the ball picked (Tab), the left and right arrow keys
// slide it sideways, and Enter or Space takes a straight shot. So a keyboard
// shot goes in when the ball is under the hoop.
//
// A shot is { dx, dy }: how far the swipe went sideways and up, as parts of
// the court's width and height (so 0.5 up is half the court). `judge` is the
// whole of the "physics", and it needs no screen, so the tests can check it.

import { make, button, shape, liveMessage, wiggle } from '../ui.js';

export const TARGET = 20;
// What a shot needs: at least `long` up, and at most `wide` off to the side.
// The hoop is drawn `wide` across on each side, so what you see is what counts.
const NEEDS = [{ long: 0.2, wide: 0.12 }, { long: 0.35, wide: 0.07 }]; // 2 points, 3 points
const HOOP = { x: 0.5, y: 0.2 }; // the middle of the rim, as parts of the court
const BALL_Y = [0.68, 0.86]; // where the ball waits: close in, farther back
const SLIDE = 0.05; // one arrow-key press moves the ball this far
const MOST_SLIDES = 6;
const FLIGHT_MS = 420; // up to the hoop; the drop after it takes half as long

/** How a shot ends: 'in', 'short' (not a long enough swipe), or 'wide' (off to the side). */
export function judge({ dx, dy }, three) {
  const needs = NEEDS[three ? 1 : 0];
  if (dy < needs.long) return 'short';
  return Math.abs(dx) <= needs.wide ? 'in' : 'wide';
}

/** True if a shot drops through the hoop. */
export const shotGoesIn = (shot, three) => judge(shot, three) === 'in';

/** The puzzle is the same every day: play to 20 points. */
export function generate() {
  return { target: TARGET };
}

/** The starting state: no points yet. */
export function start(puzzle) {
  return { target: puzzle.target, score: 0, status: 'playing', last: null };
}

/** Count one shot: a made basket adds 2 or 3 points. A miss changes nothing (no penalty). */
export function check(state, { made, three }) {
  if (state.status !== 'playing') throw new Error('The game is done.');
  const points = made ? (three ? 3 : 2) : 0;
  const score = state.score + points;
  return { ...state, score, status: score >= state.target ? 'won' : 'playing', last: { made, points } };
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = puzzle?.target === TARGET ? [] : [`the game is played to ${TARGET} points`];
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/** The court's picture: floor lines, and the hoop (backboard, rim, net) as one group so it can shrink. */
function courtPicture() {
  const picture = shape('svg', { viewBox: '0 0 300 290', class: 'hs-picture', 'aria-hidden': 'true' });
  const hoop = shape('g', { class: 'hs-hoop' });
  hoop.append(
    shape('rect', { x: 108, y: 8, width: 84, height: 44, rx: 4, class: 'hs-board' }),
    shape('rect', { x: 136, y: 24, width: 28, height: 22, class: 'hs-square' }),
    shape('path', { d: 'M116 58 L130 96 L170 96 L184 58 M133 58 L140 96 M150 58 L150 96 M167 58 L160 96 M123 77 L177 77', class: 'hs-net' }),
    shape('ellipse', { cx: 150, cy: 58, rx: 36, ry: 9, class: 'hs-rim' }),
  );
  picture.append(
    shape('path', { d: 'M100 290 L100 170 L200 170 L200 290 M100 170 A50 22 0 0 1 200 170', class: 'hs-lines' }),
    shape('path', { d: 'M14 290 L14 250 A136 120 0 0 1 286 250 L286 290', class: 'hs-lines' }),
    hoop,
  );
  return picture;
}

/** The ball's picture: an orange circle with its dark seams. */
function ballPicture() {
  const picture = shape('svg', { viewBox: '0 0 56 56', 'aria-hidden': 'true' });
  picture.append(
    shape('circle', { cx: 28, cy: 28, r: 26, class: 'hs-skin' }),
    shape('path', { d: 'M28 2 L28 54 M2 28 L54 28 M9 10 Q24 28 9 46 M47 10 Q32 28 47 46', class: 'hs-seams' }),
  );
  return picture;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once at 20 points. It is just for fun, so misses and helped are always 0.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  // Pick up a half-done game: put the points back.
  if (session.saved) state = { ...state, score: session.saved.score };
  let three = false;
  let slides = 0; // how many arrow-key steps the ball sits to the side
  let flying = false;
  let grab = null; // where a finger went down on the ball

  container.replaceChildren();
  container.classList.add('hs');

  const picks = make('div', 'hs-picks');
  picks.setAttribute('role', 'group');
  picks.setAttribute('aria-label', 'Which shot?');
  const pickButtons = [false, true].map((far) => picks.appendChild(button('hs-pick', far ? '3 points' : '2 points', () => {
    if (flying || state.status !== 'playing') return;
    three = far;
    draw();
  })));
  const board = make('p', 'hs-score');
  const court = make('div', 'hs-court');
  const ball = button('hs-ball');
  ball.setAttribute('aria-label', 'Basketball. Swipe up to shoot. Or use the arrow keys to slide it, and Enter to shoot.');
  ball.append(ballPicture());
  court.append(courtPicture(), ball);
  const message = liveMessage('hs-message', 'Swipe up on the ball to shoot!');
  container.append(picks, board, court, message);

  /** Put the ball at a spot on the court (parts of its width and height) at a size (1 is full size). */
  function place(x, y, size = 1) {
    ball.style.left = `${x * 100}%`;
    ball.style.top = `${y * 100}%`;
    ball.style.transform = `translate(-50%, -50%) scale(${size})`;
  }

  const home = () => ({ x: HOOP.x + slides * SLIDE, y: BALL_Y[three ? 1 : 0] });

  function draw() {
    pickButtons.forEach((pick, i) => {
      const on = i === (three ? 1 : 0);
      pick.classList.toggle('hs-pick-on', on);
      pick.setAttribute('aria-pressed', String(on));
    });
    court.classList.toggle('hs-far', three);
    board.textContent = `${state.score} of ${state.target}`;
    const { x, y } = home();
    place(x, y);
  }

  /** Take a shot: judge it, show the ball's flight, then count it. */
  function shoot(swipe) {
    if (flying || state.status !== 'playing') return;
    const from = home();
    // Where the ball comes down is where it started plus the swipe's sideways push.
    const shot = { dx: from.x - HOOP.x + swipe.dx, dy: swipe.dy };
    const result = judge(shot, three);
    const side = shot.dx < 0 ? -1 : 1;
    // A made shot ends in the hoop; a wide one beside it; a short one below it.
    const to = {
      x: result === 'in' ? HOOP.x : Math.min(Math.max(HOOP.x + shot.dx, 0.08), 0.92),
      y: result === 'short' ? HOOP.y + 0.2 : HOOP.y,
    };

    function land() {
      flying = false;
      state = check(state, { made: result === 'in', three });
      draw();
      if (result !== 'in') {
        message.textContent = result === 'short' ? 'Not far enough. Try a longer swipe!' : 'Off to the side. Aim straight at the hoop!';
        wiggle(ball.firstChild); // the picture, not the button: the button's own transform holds its place
      } else if (state.status === 'won') {
        message.textContent = `✓ ${state.score} points! Nothing but net!`;
        ball.disabled = true;
        container.classList.add('finished');
        onDone({ status: 'won', misses: 0, helped: 0 });
      } else {
        message.textContent = `✓ Swish! ${state.last.points} points!`;
        session.save?.({ score: state.score });
      }
    }

    // Some players ask their device for less motion: show the result with no flight.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return land();
    flying = true;
    const began = performance.now();
    const frame = (now) => {
      const t = Math.min((now - began) / FLIGHT_MS, 1.5);
      if (t <= 1) {
        // Up in an arc: a straight line to the hoop, lifted most in the middle.
        place(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - t * (1 - t), 1 - 0.4 * t);
      } else {
        // Then down: through the net, or bouncing off to the side.
        const fall = (t - 1) * 2;
        place(to.x + (result === 'in' ? 0 : side * 0.2 * fall), to.y + 0.25 * fall, 0.6);
      }
      if (t < 1.5) requestAnimationFrame(frame);
      else land();
    };
    requestAnimationFrame(frame);
  }

  // Swiping: finger down on the ball, drag, lift.
  ball.addEventListener('pointerdown', (event) => {
    grab = { x: event.clientX, y: event.clientY };
    // Keep getting the finger even after it slides off the ball.
    try { ball.setPointerCapture(event.pointerId); } catch { /* fine without it */ }
  });
  ball.addEventListener('pointerup', (event) => {
    if (!grab) return;
    const box = court.getBoundingClientRect();
    shoot({ dx: (event.clientX - grab.x) / box.width, dy: (grab.y - event.clientY) / box.height });
    grab = null;
  });
  ball.addEventListener('pointercancel', () => { grab = null; });

  // The keyboard: arrows slide the ball, and Enter or Space (a click with no finger) shoots straight up.
  ball.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step || flying || state.status !== 'playing') return;
    event.preventDefault();
    slides = Math.min(Math.max(slides + step, -MOST_SLIDES), MOST_SLIDES);
    draw();
  });
  ball.addEventListener('click', (event) => { if (event.detail === 0) shoot({ dx: 0, dy: 1 }); });

  draw();
}
