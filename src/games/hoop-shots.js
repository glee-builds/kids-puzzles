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
// Make 3 in a row and the ball is on fire: it burns until a shot misses.
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
export const ON_FIRE = 3; // baskets in a row that set the ball on fire
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

/**
 * True if a missed shot was too soft: it never got up as high as the rim
 * (from close in, a soft shot can pass under the hoop), or it came down to
 * the floor in front of the hoop.
 */
export function fellShort(path) {
  const peak = Math.max(...path.map(([, y]) => y));
  const landing = path.find(([, y], i) => i > 0 && y <= BALL_R + 0.01) || path.at(-1);
  return peak < RIM.y + BALL_R || landing[0] < RIM.front;
}

/** The puzzle is the same every day: play to 20 points. */
export function generate() {
  return { target: TARGET };
}

/** The starting state: no points yet. */
export function start(puzzle) {
  return { target: puzzle.target, score: 0, streak: 0, status: 'playing', last: null };
}

/**
 * Count one shot: a made basket adds 2 or 3 points and one to the streak
 * (baskets in a row). A miss takes no points away; it only ends the streak.
 */
export function check(state, { made, three }) {
  if (state.status !== 'playing') throw new Error('The game is done.');
  const points = made ? (three ? 3 : 2) : 0;
  const score = state.score + points;
  const streak = made ? (state.streak || 0) + 1 : 0;
  return { ...state, score, streak, status: score >= state.target ? 'won' : 'playing', last: { made, points } };
}

/** True when the ball is on fire: 3 or more baskets in a row. */
export const onFire = (state) => (state.streak || 0) >= ON_FIRE;

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = puzzle?.target === TARGET ? [] : [`the game is played to ${TARGET} points`];
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

const sy = (y) => 70 - y; // court units (y up) to drawing units (y down)

const NET_TOP = sy(RIM.y);
const NET_DEPTH = 11;
const MIDDLE = (RIM.front + RIM.back) / 2;
const RING = { rx: (RIM.back - RIM.front) / 2, ry: 1.6 }; // the rim, seen a little from above

/** Half of the rim's ring: the back half sits behind the ball, the front half in front of it. */
const ringHalf = (front) => shape('path', {
  d: `M${RIM.front} ${NET_TOP} A${RING.rx} ${RING.ry} 0 0 ${front ? 0 : 1} ${RIM.back} ${NET_TOP}`,
  class: `hs-rim ${front ? 'hs-rim-front' : 'hs-rim-back'}`,
});

/**
 * The net: a diamond mesh hanging from the ring, narrowing toward the
 * bottom. Each row has knots; each knot is tied to the two below it.
 */
function netPicture() {
  const net = shape('g', { class: 'hs-net' });
  const rows = 5;
  const knots = Array.from({ length: rows + 1 }, (_, row) => {
    const down = row / rows;
    const half = RING.rx * (1 - 0.38 * down); // narrower toward the bottom
    const sag = RING.ry * (1 - down); // the top row follows the ring's front curve
    return Array.from({ length: 7 }, (_, i) => {
      const across = (i - 3) / 3; // -1 to 1
      return [MIDDLE + across * half, NET_TOP + down * NET_DEPTH + sag * Math.sqrt(1 - across * across) * 0.9];
    });
  });
  const lines = [];
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < 7; i++) {
      const [x, y] = knots[row][i];
      for (const j of [i - 1, i + 1]) {
        if (j >= 0 && j < 7) lines.push(`M${x} ${y} L${knots[row + 1][j][0]} ${knots[row + 1][j][1]}`);
      }
    }
  }
  const [first, last] = [knots[rows][0], knots[rows][6]];
  lines.push(`M${first[0]} ${first[1]} L${last[0]} ${last[1]}`); // the hem along the bottom
  net.append(shape('path', { d: lines.join(' ') }));
  return net;
}

/**
 * The gym from the side: a wall, a wooden floor with the 3-point line, and
 * the hoop (pole, arm, backboard, rim). The drawing reaches 8 units below
 * the floor's surface, to show the floorboards.
 */
function courtPicture() {
  const picture = shape('svg', { viewBox: '0 0 100 78', class: 'hs-picture', 'aria-hidden': 'true' });
  const boards = [72, 74.6, 77].map((y) => shape('line', { x1: 0, y1: y, x2: 100, y2: y, class: 'hs-plank' }));
  picture.append(
    shape('rect', { x: 0, y: 0, width: 100, height: 70, class: 'hs-wall' }),
    shape('rect', { x: 0, y: 62, width: 100, height: 8, class: 'hs-pad' }), // the padded strip along the bottom of the wall
    shape('rect', { x: 0, y: 70, width: 100, height: 8, class: 'hs-floor' }),
    ...boards,
    shape('rect', { x: SPOTS[1].x - 1, y: 70, width: 2, height: 8, class: 'hs-mark' }), // the 3-point line
    shape('rect', { x: 96, y: sy(38), width: 2.4, height: 38, class: 'hs-pole' }),
    shape('path', { d: `M97.2 ${sy(37.5)} L${BOARD.x + 1.4} ${sy(BOARD.bottom + 3)}`, class: 'hs-arm' }), // the arm from the pole to the backboard
    // The backboard, turned a little toward us so its face and target square show.
    shape('path', { d: `M${BOARD.x - 3} ${sy(BOARD.top) + 1.5} L${BOARD.x + 1.5} ${sy(BOARD.top)} L${BOARD.x + 1.5} ${sy(BOARD.bottom)} L${BOARD.x - 3} ${sy(BOARD.bottom) + 1.5} Z`, class: 'hs-board' }),
    shape('path', { d: `M${BOARD.x - 2.2} ${sy(RIM.y + 6) + 1} L${BOARD.x + 0.6} ${sy(RIM.y + 6) + 0.3} L${BOARD.x + 0.6} ${sy(RIM.y + 0.5) + 0.3} L${BOARD.x - 2.2} ${sy(RIM.y + 0.5) + 1}`, class: 'hs-target' }),
    shape('rect', { x: RIM.back - 0.4, y: NET_TOP - 0.6, width: BOARD.x - RIM.back - 1.6, height: 1.2, class: 'hs-bracket' }),
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
  const shadow = shape('ellipse', { cy: 70.2, rx: BALL_R, ry: 0.9, class: 'hs-shadow' });
  // The ball: `ball` moves it, `spin` turns it as it rolls through the air.
  const ball = shape('g', { class: 'hs-ball' });
  const spin = shape('g', {});
  spin.append(
    shape('circle', { r: BALL_R, class: 'hs-skin' }),
    shape('path', { d: `M0 ${-BALL_R} V${BALL_R} M${-BALL_R} 0 H${BALL_R} M-2.8 -2.8 Q0 0 -2.8 2.8 M2.8 -2.8 Q0 0 2.8 2.8`, class: 'hs-seams' }),
    shape('circle', { cx: -1.3, cy: -1.5, r: 1.3, class: 'hs-shine' }),
  );
  // Flames, behind the ball. They don't spin; they point away from where the ball is going.
  const flames = shape('g', { class: 'hs-flames' });
  const fire = shape('g', { class: 'hs-fire-shape' });
  fire.append(
    shape('path', { d: 'M-4.6 0 C-5 -5 -2 -7 -1.5 -11 C0 -8 1 -9.5 1.2 -13 C3 -9 5.2 -6 4.6 0 Z', class: 'hs-flame-outer' }),
    shape('path', { d: 'M-2.8 0 C-3 -3.5 -1 -4.5 -0.6 -7.5 C0.6 -5.5 1.4 -6.5 1.6 -8.5 C2.6 -6 3.2 -3.5 2.8 0 Z', class: 'hs-flame-inner' }),
  );
  flames.append(fire);
  ball.append(flames, spin);
  // The rim, then the ball, then the net in front: a ball dropping through shows through the net.
  const net = netPicture();
  const points = shape('text', { x: 84, y: NET_TOP - 8, class: 'hs-points' });
  picture.append(shadow, dots, ringHalf(false), ball, net, ringHalf(true), points);
  const court = make('div', 'hs-court');
  court.tabIndex = 0;
  court.setAttribute('role', 'application');
  court.setAttribute('aria-label', 'Basketball court. Swipe up to shoot. Or use Left and Right for softer or harder, Up and Down for a higher or flatter arc, and Enter to shoot.');
  court.append(picture);
  const message = liveMessage('hs-message', 'Swipe up on the court to shoot!');
  container.append(picks, board, court, message);

  const spot = () => SPOTS[three ? 1 : 0];
  let turn = 0; // how far the ball has turned, in degrees
  /** Put the ball at [x, y], turned `turn` degrees, with its shadow on the floor below. */
  const put = ([x, y]) => {
    ball.setAttribute('transform', `translate(${x} ${sy(y)})`);
    spin.setAttribute('transform', `rotate(${turn})`);
    // The higher the ball, the smaller and fainter its shadow.
    const high = Math.min(Math.max((y - BALL_R) / 50, 0), 1);
    shadow.setAttribute('cx', x);
    shadow.setAttribute('rx', BALL_R * (1 - 0.6 * high));
    shadow.style.opacity = 0.35 * (1 - 0.8 * high);
  };
  /** Play a short CSS animation on a node (named by a class), even if it just played. */
  const play = (node, name) => {
    node.classList.remove(name);
    void node.getBoundingClientRect(); // makes the browser notice the class was removed
    node.classList.add(name);
  };

  /** Show where a shot starts to go: the first part of its flight, as dots. */
  function showAim(swipe) {
    const { path } = fly(spot(), launch(swipe));
    // Each dot a little smaller and fainter than the one before.
    dots.replaceChildren(...path.slice(6, 62).filter((_, i) => i % 8 === 0)
      .map(([x, y], i) => shape('circle', { cx: x, cy: sy(y), r: 1.1 - i * 0.1, class: 'hs-dot', style: `opacity: ${0.6 - i * 0.07}` })));
  }

  function draw() {
    pickButtons.forEach((pick, i) => {
      const on = i === (three ? 1 : 0);
      pick.classList.toggle('hs-pick-on', on);
      pick.setAttribute('aria-pressed', String(on));
    });
    board.textContent = `${state.score} of ${state.target}`;
    dots.replaceChildren();
    turn = 0;
    flames.removeAttribute('transform'); // flames point up while the ball waits
    container.classList.toggle('hs-on-fire', onFire(state));
    put([spot().x, spot().y]);
  }

  /** Take a shot: fly it, show the flight, then count it. */
  function shoot(swipe) {
    if (flying || state.status !== 'playing') return;
    const { path, made } = fly(spot(), launch(swipe));
    dots.replaceChildren();

    function land() {
      flying = false;
      const wasOnFire = onFire(state);
      state = check(state, { made, three });
      if (!made) {
        message.textContent = fellShort(path) ? 'Not far enough. Try a longer swipe!' : 'Too far! Try a shorter swipe.';
      } else if (state.status === 'won') {
        message.textContent = `✓ ${state.score} points! Nothing but net!`;
        container.classList.add('finished');
        onDone({ status: 'won', misses: 0, helped: 0 });
      } else if (state.streak === ON_FIRE) {
        message.textContent = `🔥 ${ON_FIRE} in a row! You're on fire!`;
        session.save?.({ score: state.score });
      } else {
        message.textContent = onFire(state) ? `🔥 ${state.streak} in a row! Still on fire!` : `✓ Swish! ${state.last.points} points!`;
        session.save?.({ score: state.score });
      }
      if (wasOnFire && !made) message.textContent += ' The fire went out.';
      draw();
      if (made) play(board, 'hs-bump');
      play(ball, 'hs-back'); // the ball drops gently back into place
    }

    // Some players ask their device for less motion: show the result with no flight.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return land();
    flying = true;
    let at = 0;
    let swished = false;
    const frame = () => {
      const was = path[at];
      at = Math.min(at + 2, path.length - 1); // the path has 120 points a second; the screen shows 60
      const now = path[at];
      // It turns as far as it travels, like a ball rolling with backspin.
      turn -= ((now[0] - was[0]) / BALL_R) * (180 / Math.PI);
      put(now);
      // The flames trail behind: they point the opposite way to the ball's motion.
      const heading = Math.atan2(-(now[1] - was[1]), now[0] - was[0]) * (180 / Math.PI); // in drawing units, y down
      flames.setAttribute('transform', `rotate(${heading + 90 + 180})`);
      // Dropping through the hoop: the net swishes and the points float up.
      if (made && !swished && now[1] < RIM.y && now[0] > RIM.front && now[0] < RIM.back) {
        swished = true;
        play(net, 'hs-swish');
        points.textContent = `+${three ? 3 : 2}`;
        play(points, 'hs-float');
      }
      if (at < path.length - 1) requestAnimationFrame(frame);
      else setTimeout(land, 250);
    };
    requestAnimationFrame(frame);
  }

  // Swiping: a finger anywhere on the court, moved up, then lifted.
  const units = (event) => {
    const box = court.getBoundingClientRect();
    // The drawing is 78 units tall and its bottom 8 are below the floor.
    return { x: ((event.clientX - box.left) / box.width) * 100, y: ((box.bottom - event.clientY) / box.height) * 78 - 8 };
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
