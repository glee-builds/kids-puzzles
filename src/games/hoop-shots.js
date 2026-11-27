// hoop-shots.js: a just-for-fun game of basketball, seen from the side.
// Swipe up on the court to shoot; reach 20 points and the game is done.
//
// The ball really flies: it starts with the speed and slope the swipe gives
// it, gravity pulls it down, and it can bounce off the rim, the backboard,
// and the floor. It scores when it drops down through the hoop, so a shot
// that hits the backboard or rolls around the rim can still go in.
//
// How a swipe aims (it always shoots toward the hoop):
//   longer swipe = harder shot
//   straight up = a high arc (the easiest); slanted toward the hoop = flatter
// While a finger is down, dots show where the ball will start to go.
//
// A switch picks the shot: "2 points" from close in, or "3 points" from
// farther back. A miss costs nothing: the ball just comes back.
//
// Without swiping: with the court picked (Tab), Left and Right make the shot
// softer or harder, Up and Down make the arc higher or flatter (the dots
// show it), and Enter or Space shoots.
//
// Units: the court is 100 wide and 70 tall, with y counted up from the floor.
// `fly` is the whole of the physics, needs no screen, and moves in fixed
// steps, so the same shot always flies the same way and the tests can check it.

import { make, button, shape, liveMessage } from '../ui.js';

export const TARGET = 20;
export const BALL_R = 4;
export const RIM = { front: 77, back: 91, y: 42 }; // the rim's two ends, seen from the side
const RIM_R = 0.8; // how thick the rim is
const BOARD = { x: 93, bottom: 38, top: 58 }; // the backboard: a wall just behind the rim
export const SPOTS = [{ x: 46, y: 16 }, { x: 16, y: 16 }]; // where the ball starts: 2 points, 3 points
const GRAVITY = 60;
const STEP = 1 / 120; // seconds per step of the flight
const BOUNCE = 0.55; // how much speed a bounce keeps

/**
 * A swipe as a shot: `up` and `toward` are how far the finger moved up and
 * toward the hoop, in court units. Returns the starting speed { vx, vy }.
 */
export function launch({ up, toward }) {
  const slant = Math.atan2(Math.max(up, 0), toward); // 90° is straight up
  const angle = Math.min(Math.max(35 + (slant / (Math.PI / 2)) * 30, 35), 75) * (Math.PI / 180);
  const speed = Math.min(Math.max(40 + Math.hypot(up, toward) * 1.4, 40), 120);
  return { vx: speed * Math.cos(angle), vy: speed * Math.sin(angle) };
}

/** Fly a shot from `spot` with starting speed { vx, vy }. Returns { path: [[x, y], ...], made }. */
export function fly(spot, { vx, vy }) {
  let x = spot.x;
  let y = spot.y;
  const path = [[x, y]];
  let made = false;
  for (let i = 0; i < 480 && x > -BALL_R && x < 100 + BALL_R; i++) {
    const before = y;
    vy -= GRAVITY * STEP;
    x += vx * STEP;
    y += vy * STEP;
    // Through the hoop: the middle of the ball drops past rim height between the rim's ends.
    if (!made && before >= RIM.y && y < RIM.y && x > RIM.front + 0.5 && x < RIM.back - 0.5) made = true;
    // The rim's two ends are round: the ball bounces off them the way it hits them.
    for (const end of [RIM.front, RIM.back]) {
      const dx = x - end;
      const dy = y - RIM.y;
      const apart = Math.hypot(dx, dy);
      const reach = BALL_R + RIM_R;
      if (apart < reach) {
        const nx = dx / apart;
        const ny = dy / apart;
        const into = vx * nx + vy * ny;
        if (into < 0) {
          vx -= (1 + BOUNCE) * into * nx;
          vy -= (1 + BOUNCE) * into * ny;
        }
        x = end + nx * reach;
        y = RIM.y + ny * reach;
      }
    }
    // The backboard.
    if (vx > 0 && x + BALL_R > BOARD.x && y > BOARD.bottom && y < BOARD.top) {
      x = BOARD.x - BALL_R;
      vx = -vx * BOUNCE;
    }
    // The floor: bounce lower each time, and stop when the bounce is tiny.
    if (vy < 0 && y < BALL_R) {
      y = BALL_R;
      vy = -vy * BOUNCE;
      vx *= 0.8;
      if (vy < 6) break;
    }
    path.push([x, y]);
    if (made && y < RIM.y - 14) break; // dropped through the net
  }
  return { path, made };
}

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

const sy = (y) => 70 - y; // court units (y up) to drawing units (y down)

/** The court from the side: floor, 3-point mark, pole, backboard, rim, and net. */
function courtPicture() {
  const picture = shape('svg', { viewBox: '0 0 100 70', class: 'hs-picture', 'aria-hidden': 'true' });
  picture.append(
    shape('rect', { x: 0, y: sy(1.5), width: 100, height: 1.5, class: 'hs-floor' }),
    shape('rect', { x: SPOTS[1].x - 5, y: sy(1.5), width: 10, height: 0.7, class: 'hs-mark' }), // the 3-point line
    shape('rect', { x: 95, y: sy(BOARD.bottom), width: 2, height: BOARD.bottom - 1.5, class: 'hs-pole' }),
    shape('rect', { x: BOARD.x, y: sy(BOARD.top), width: 2, height: BOARD.top - BOARD.bottom, class: 'hs-board' }),
    shape('path', { d: `M${RIM.front} ${sy(RIM.y)} L${RIM.front + 3} ${sy(RIM.y - 9)} L${RIM.back - 3} ${sy(RIM.y - 9)} L${RIM.back} ${sy(RIM.y)} M${(RIM.front + RIM.back) / 2} ${sy(RIM.y)} L${(RIM.front + RIM.back) / 2} ${sy(RIM.y - 9)}`, class: 'hs-net' }),
    shape('line', { x1: RIM.front, y1: sy(RIM.y), x2: BOARD.x, y2: sy(RIM.y), class: 'hs-rim' }),
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
  let flying = false;
  let grab = null; // where a finger went down, in court units
  let aim = { up: 20, toward: 0 }; // the keyboard's shot, changed with the arrow keys

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
  const picture = courtPicture();
  const dots = shape('g', { class: 'hs-dots' });
  const ball = shape('g', { class: 'hs-ball' });
  ball.append(
    shape('circle', { r: BALL_R, class: 'hs-skin' }),
    shape('path', { d: `M0 ${-BALL_R} V${BALL_R} M${-BALL_R} 0 H${BALL_R} M-2.8 -2.8 Q0 0 -2.8 2.8 M2.8 -2.8 Q0 0 2.8 2.8`, class: 'hs-seams' }),
  );
  picture.append(dots, ball);
  const court = make('div', 'hs-court');
  court.tabIndex = 0;
  court.setAttribute('role', 'application');
  court.setAttribute('aria-label', 'Basketball court. Swipe up to shoot. Or use Left and Right for softer or harder, Up and Down for a higher or flatter arc, and Enter to shoot.');
  court.append(picture);
  const message = liveMessage('hs-message', 'Swipe up on the court to shoot!');
  container.append(picks, board, court, message);

  const spot = () => SPOTS[three ? 1 : 0];
  const put = ([x, y]) => ball.setAttribute('transform', `translate(${x} ${sy(y)})`);

  /** Show where a shot starts to go: the first part of its flight, as dots. */
  function showAim(swipe) {
    const { path } = fly(spot(), launch(swipe));
    dots.replaceChildren(...path.slice(6, 54).filter((_, i) => i % 8 === 0)
      .map(([x, y]) => shape('circle', { cx: x, cy: sy(y), r: 1, class: 'hs-dot' })));
  }

  function draw() {
    pickButtons.forEach((pick, i) => {
      const on = i === (three ? 1 : 0);
      pick.classList.toggle('hs-pick-on', on);
      pick.setAttribute('aria-pressed', String(on));
    });
    board.textContent = `${state.score} of ${state.target}`;
    dots.replaceChildren();
    put([spot().x, spot().y]);
  }

  /** Take a shot: fly it, show the flight, then count it. */
  function shoot(swipe) {
    if (flying || state.status !== 'playing') return;
    const { path, made } = fly(spot(), launch(swipe));
    dots.replaceChildren();

    function land() {
      flying = false;
      state = check(state, { made, three });
      if (!made) {
        const [x] = path.at(-1);
        message.textContent = x < RIM.front - 4 ? 'Not far enough. Try a longer swipe!' : 'Too far! Try a shorter swipe.';
      } else if (state.status === 'won') {
        message.textContent = `✓ ${state.score} points! Nothing but net!`;
        container.classList.add('finished');
        onDone({ status: 'won', misses: 0, helped: 0 });
      } else {
        message.textContent = `✓ Swish! ${state.last.points} points!`;
        session.save?.({ score: state.score });
      }
      draw();
    }

    // Some players ask their device for less motion: show the result with no flight.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return land();
    flying = true;
    let at = 0;
    const frame = () => {
      at = Math.min(at + 2, path.length - 1); // the path has 120 points a second; the screen shows 60
      put(path[at]);
      if (at < path.length - 1) requestAnimationFrame(frame);
      else setTimeout(land, 250);
    };
    requestAnimationFrame(frame);
  }

  // Swiping: a finger anywhere on the court, moved up, then lifted.
  const units = (event) => {
    const box = court.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * 100, y: ((box.bottom - event.clientY) / box.height) * 70 };
  };
  const swipeTo = (event) => {
    const now = units(event);
    return { up: now.y - grab.y, toward: now.x - grab.x };
  };
  court.addEventListener('pointerdown', (event) => {
    if (flying || state.status !== 'playing') return;
    grab = units(event);
    // Keep getting the finger even after it slides off the court.
    try { court.setPointerCapture(event.pointerId); } catch { /* fine without it */ }
  });
  court.addEventListener('pointermove', (event) => { if (grab) showAim(swipeTo(event)); });
  court.addEventListener('pointerup', (event) => {
    if (!grab) return;
    const swipe = swipeTo(event);
    grab = null;
    if (swipe.up > 4) shoot(swipe);
    else dots.replaceChildren(); // a tap, not a swipe
  });
  court.addEventListener('pointercancel', () => {
    grab = null;
    dots.replaceChildren();
  });

  // The keyboard: arrows change the shot (the dots show it), Enter or Space shoots.
  court.addEventListener('keydown', (event) => {
    if (flying || state.status !== 'playing') return;
    const change = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      shoot(aim);
    } else if (change) {
      event.preventDefault();
      // Harder or softer moves along the swipe; higher or flatter turns it.
      const length = Math.min(Math.max(Math.hypot(aim.up, aim.toward) + change[0] * 1.5, 5), 60);
      const turn = Math.min(Math.max(Math.atan2(aim.toward, aim.up) + change[1] * 0.12, 0), Math.PI / 2);
      aim = { up: length * Math.cos(turn), toward: length * Math.sin(turn) };
      showAim(aim);
    }
  });

  draw();
}
