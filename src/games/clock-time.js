// clock-time.js: read the time on a clock with hands.
//
// Each day has 5 clocks. The player picks the time each one shows from 3
// choices. The short hand (orange) shows the hour and the long hand (teal)
// shows the minutes.
//   level 1: on the hour and half past (3:00, 3:30)
//   level 2: quarter hours too (3:15, 3:45)
//   level 3: any 5 minutes (3:05, 3:40)
// The wrong choices are the mistakes kids really make: mixing up the two
// hands, and being an hour off.

import { createRandom } from '../seed.js';
import { make, button, wiggle, roundFrame } from '../ui.js';

export const CLOCKS = 5;
// The minutes a clock can show at each level.
export const MINUTES = [
  [0, 30],
  [0, 15, 30, 45],
  [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
];
const minutesFor = (level = 1) => MINUTES[Math.min(Math.max(level, 1), MINUTES.length) - 1];

/** A time as text: timeText(3, 5) is "3:05". */
export const timeText = (hour, minute) => `${hour}:${String(minute).padStart(2, '0')}`;

/** The hour before or after, staying on a 12-hour clock (12 then 1). */
const hourPlus = (hour, by) => ((hour - 1 + by + 12) % 12) + 1;

/**
 * Three times to choose from, in a mixed order: the right one, the time
 * you'd read with the two hands mixed up, and an hour off (or two).
 */
function choicesFor(random, hour, minute) {
  const right = timeText(hour, minute);
  // Mixed-up hands: the long hand's number read as the hour, and the short
  // hand's number read as minutes.
  const mixed = timeText(minute === 0 ? 12 : minute / 5, (hour % 12) * 5);
  const picked = [right];
  for (const wrong of [mixed, timeText(hourPlus(hour, 1), minute), timeText(hourPlus(hour, -1), minute)]) {
    if (picked.length < 3 && !picked.includes(wrong)) picked.push(wrong);
  }
  return random.shuffle(picked);
}

/** Make today's 5 clocks from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const minutes = minutesFor(level);
  const rounds = [];
  while (rounds.length < CLOCKS) {
    const hour = random.int(1, 12);
    const minute = random.pick(minutes);
    if (rounds.some((r) => r.hour === hour && r.minute === minute)) continue;
    rounds.push({ hour, minute, choices: choicesFor(random, hour, minute) });
  }
  return { level, rounds };
}

/** The starting state: clock 0. */
export function start(puzzle) {
  return { puzzle, round: 0, status: 'playing', last: null };
}

/** Pick a time for the current clock. A miss stays on the clock (no penalty). */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the clocks are done.');
  const { hour, minute } = state.puzzle.rounds[state.round];
  const correct = answer === timeText(hour, minute);
  const next = correct ? state.round + 1 : state.round;
  return {
    ...state,
    round: next,
    status: next >= state.puzzle.rounds.length ? 'won' : 'playing',
    last: { round: state.round, correct },
  };
}

/** A hint after a miss, about the hand that was read wrong. */
export function hint(round, answer) {
  const { hour, minute } = round;
  const [pickedHour] = answer.split(':').map(Number);
  if (pickedHour !== hour) {
    return minute === 0
      ? `The short hand shows the hour. It points right at ${hour}.`
      : `The short hand shows the hour. It's past ${hour}, but not at ${hourPlus(hour, 1)} yet.`;
  }
  return `The long hand shows the minutes. Count by 5s from the top to where it points.`;
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  if (!Array.isArray(rounds) || rounds.length !== CLOCKS) return { ok: false, problems: [`there must be ${CLOCKS} clocks`] };
  const minutes = minutesFor(level);
  rounds.forEach(({ hour, minute, choices }, i) => {
    if (!Number.isInteger(hour) || hour < 1 || hour > 12) problems.push(`clock ${i + 1}: hour ${hour}`);
    if (!minutes.includes(minute)) problems.push(`clock ${i + 1}: ${minute} minutes isn't in level ${level}`);
    if (choices.length !== 3 || new Set(choices).size !== 3 || !choices.includes(timeText(hour, minute))) {
      problems.push(`clock ${i + 1} needs 3 different choices, one right`);
    }
  });
  if (new Set(rounds.map((r) => timeText(r.hour, r.minute))).size !== rounds.length) problems.push('two clocks show the same time');
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

const SVG = 'http://www.w3.org/2000/svg';

/** A piece of the clock drawing, e.g. shape('circle', { r: 46 }). */
function shape(tag, attributes) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** A clock face showing hour:minute, drawn in a 100 by 100 box. */
function clockFace(hour, minute) {
  const svg = shape('svg', { viewBox: '0 0 100 100', class: 'ct-clock', role: 'img', 'aria-label': 'A clock. Read its hands.' });
  svg.append(shape('circle', { cx: 50, cy: 50, r: 47, class: 'ct-face' }));
  for (let n = 1; n <= 12; n++) {
    const angle = (n * 30 * Math.PI) / 180;
    const number = shape('text', { x: 50 + 37 * Math.sin(angle), y: 50 - 37 * Math.cos(angle), class: 'ct-number' });
    number.textContent = String(n);
    svg.append(number);
  }
  for (let tick = 0; tick < 60; tick++) {
    const angle = (tick * 6 * Math.PI) / 180;
    const from = tick % 5 === 0 ? 43.5 : 45;
    svg.append(shape('line', {
      x1: 50 + from * Math.sin(angle), y1: 50 - from * Math.cos(angle),
      x2: 50 + 46.5 * Math.sin(angle), y2: 50 - 46.5 * Math.cos(angle), class: 'ct-tick',
    }));
  }
  // The hour hand moves a little past its number as the minutes go by.
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  svg.append(
    shape('line', { x1: 50, y1: 50, x2: 50, y2: 30, class: 'ct-hand ct-hour', transform: `rotate(${hourAngle} 50 50)` }),
    shape('line', { x1: 50, y1: 50, x2: 50, y2: 17, class: 'ct-hand ct-minute', transform: `rotate(${minute * 6} 50 50)` }),
    shape('circle', { cx: 50, cy: 50, r: 3, class: 'ct-pin' }),
  );
  return svg;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong picks; helped is always 0.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round };
    misses = session.saved.misses;
  }
  const keep = () => session.save?.({ round: state.round, misses });
  container.replaceChildren();
  container.classList.add('ct');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'ct',
    draw(i) {
      const round = puzzle.rounds[i];
      question.textContent = 'What time is it?';
      const key = make('p', 'ct-key');
      key.append(make('span', 'ct-key-hour', 'short hand: hour'), ' · ', make('span', 'ct-key-minute', 'long hand: minutes'));
      const row = make('div', 'ct-choices');
      for (const time of round.choices) {
        const choice = button('lw-button ct-choice', time, () => {
          if (state.round !== i) return;
          state = check(state, time);
          if (!state.last.correct) {
            misses += 1;
            message.textContent = `Not quite. ${hint(round, time)}`;
            wiggle(choice);
            return;
          }
          choice.classList.add('grp-right');
          for (const other of row.children) other.disabled = true;
          keep();
          frame.finish(`✓ It's ${time}!`, state.round, () => onDone({ status: state.status, misses, helped: 0 }));
        });
        row.append(choice);
      }
      stage.append(clockFace(round.hour, round.minute), key, row);
    },
  });
  const { question, stage, message } = frame;
  frame.begin(state.round);
}
