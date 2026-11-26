// pattern-train.js: find the rule in a train of cars and fill in the empty one.
//
// Each car carries a shape or a number, and the cars follow a rule: shapes
// that repeat, or numbers that grow or shrink the same way each time. One
// car is empty. The player picks what belongs in it from 3 choices. Each
// day has 4 trains.
//   level 1: shapes that repeat; adding 1, 2, 5, or 10; the last car is empty
//   level 2: adding 3, 4, or 6; taking away; an empty car in the middle
//   level 3: adding 1 more each time; doubling; harder repeating shapes
// Numbers stay at 100 or less.
//
// A rule is one of:
//   { type: 'repeat', unit: ['🔴', '⭐'] }   the unit, again and again
//   { type: 'add', step: 4 }   { type: 'take', step: 5 }
//   { type: 'grow' }  add 1, then 2, then 3...   { type: 'double' }

import { createRandom, forLevel } from '../seed.js';
import { nextRound } from '../rounds.js';
import { make, button, wiggle, roundFrame, markRight } from '../ui.js';

export const ROUNDS = 4;
// Shapes that differ in shape as well as color.
export const SHAPES = ['🔴', '🔷', '⭐', '🟩', '🔺', '💛'];

// What each of a level's 4 trains is: a kind of rule, and where the empty car is.
export const LEVELS = [
  [
    { type: 'repeat', units: ['AB', 'ABB', 'AAB'], empty: 'last' },
    { type: 'add', steps: [1, 2, 5, 10], empty: 'last' },
    { type: 'repeat', units: ['ABC', 'AABB'], empty: 'last' },
    { type: 'add', steps: [2, 5, 10], empty: 'last' },
  ],
  [
    { type: 'repeat', units: ['ABC', 'ABB', 'AAB', 'AABB'], empty: 'middle' },
    { type: 'add', steps: [3, 4, 6], empty: 'last' },
    { type: 'take', steps: [2, 5, 10], empty: 'last' },
    { type: 'add', steps: [3, 4, 6], empty: 'middle' },
  ],
  [
    { type: 'grow', empty: 'last' },
    { type: 'double', empty: 'last' },
    { type: 'take', steps: [3, 4, 6], empty: 'middle' },
    { type: 'repeat', units: ['ABAC', 'AABC', 'ABCB'], empty: 'middle' },
  ],
];
const settingsFor = (level) => forLevel(LEVELS, level);

/** Every car of a train that follows `rule`, starting from `first` (numbers only). */
export function carsFor(rule, length, first) {
  const cars = [];
  for (let i = 0; i < length; i++) {
    if (rule.type === 'repeat') cars.push(rule.unit[i % rule.unit.length]);
    else if (i === 0) cars.push(first);
    else if (rule.type === 'add') cars.push(cars[i - 1] + rule.step);
    else if (rule.type === 'take') cars.push(cars[i - 1] - rule.step);
    else if (rule.type === 'grow') cars.push(cars[i - 1] + i);
    else cars.push(cars[i - 1] * 2);
  }
  return cars;
}

/** A rule in words, for the message after a right answer and the stronger hint. */
export function ruleText(rule) {
  if (rule.type === 'repeat') return `${rule.unit.join(' ')} again and again`;
  if (rule.type === 'add') return `add ${rule.step} each time`;
  if (rule.type === 'take') return `take away ${rule.step} each time`;
  if (rule.type === 'grow') return 'add 1, then 2, then 3: one more each time';
  return 'double each time';
}

/** One train: its rule, its cars (null for the empty one), the answer, and 3 choices. */
function makeRound(random, recipe) {
  let rule;
  let full;
  if (recipe.type === 'repeat') {
    const letters = random.pick(recipe.units);
    const shapes = random.shuffle(SHAPES);
    rule = { type: 'repeat', unit: [...letters].map((letter) => shapes[letter.charCodeAt(0) - 65]) };
    full = carsFor(rule, 6);
  } else {
    const step = recipe.steps ? random.pick(recipe.steps) : 0;
    rule = recipe.steps ? { type: recipe.type, step } : { type: recipe.type };
    // A first number that keeps all 5 cars between 1 and 100.
    const first = {
      add: () => random.pick([step, random.int(1, 100 - 4 * step)]),
      take: () => random.int(4 * step + 1, 100),
      grow: () => random.int(1, 20),
      double: () => random.pick([1, 2, 3, 5, 6]),
    }[recipe.type]();
    full = carsFor(rule, 5, first);
  }
  const hidden = recipe.empty === 'last' ? full.length - 1 : random.int(2, full.length - 2);
  const answer = full[hidden];

  // Wrong choices: other shapes from the train, or numbers close to the answer.
  let wrong;
  if (rule.type === 'repeat') {
    wrong = [...new Set(rule.unit.filter((shape) => shape !== answer)), ...SHAPES.filter((shape) => !rule.unit.includes(shape))];
  } else {
    const step = rule.step || 2;
    wrong = random.shuffle([answer + 1, answer - 1, answer + step, answer - step, answer + 10]).filter((n, i, all) => n > 0 && n !== answer && all.indexOf(n) === i);
  }
  const cars = full.map((car, i) => (i === hidden ? null : car));
  return { rule, cars, hidden, answer, choices: random.shuffle([answer, ...wrong.slice(0, 2)]) };
}

/** Make today's 4 trains from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  return { level, rounds: settingsFor(level).map((recipe) => makeRound(random, recipe)) };
}

/** The starting state: train 0. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/** Pick what goes in the empty car. A miss stays on the train (no penalty). */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the trains are done.');
  return nextRound(state, answer === state.puzzle.rounds[state.round].answer, { canShow: false });
}

/** A hint after a miss: first where to look, then (from the second miss) the rule itself. */
export function hint(round, tries) {
  if (tries >= 2) return `The rule: ${ruleText(round.rule)}.`;
  return round.rule.type === 'repeat'
    ? 'Say the shapes out loud. Where does the pattern start again?'
    : 'How do the numbers change from one car to the next?';
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  const recipes = settingsFor(level);
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS) return { ok: false, problems: [`there must be ${ROUNDS} trains`] };
  rounds.forEach(({ rule, cars, hidden, answer, choices }, i) => {
    const where = `train ${i + 1}`;
    if (rule?.type !== recipes[i].type) problems.push(`${where} should follow a "${recipes[i].type}" rule`);
    if (!Array.isArray(cars) || cars[hidden] !== null || cars.filter((car) => car === null).length !== 1) {
      problems.push(`${where} needs exactly one empty car`);
      return;
    }
    const full = cars.map((car, at) => (at === hidden ? answer : car));
    if (JSON.stringify(carsFor(rule, full.length, full[0])) !== JSON.stringify(full)) problems.push(`${where} doesn't follow its rule`);
    if (rule.type !== 'repeat' && full.some((n) => !Number.isInteger(n) || n < 1 || n > 100)) problems.push(`${where} has a number that isn't from 1 to 100`);
    if (choices?.length !== 3 || new Set(choices).size !== 3 || !choices.includes(answer)) problems.push(`${where} needs 3 different choices, one right`);
  });
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

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
  container.classList.add('pt');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'pt',
    draw(i) {
      const round = puzzle.rounds[i];
      question.textContent = 'What goes in the empty car?';
      // The train: an engine, then the cars in order. The empty car shows "?".
      const train = make('div', `pt-train${round.rule.type === 'repeat' ? ' pt-shapes' : ''}`);
      train.setAttribute('role', 'img');
      train.setAttribute('aria-label', `A train. Its cars: ${round.cars.map((car) => (car === null ? 'an empty car' : car)).join(', ')}.`);
      train.append(make('span', 'pt-engine', '🚂'));
      const cars = round.cars.map((car) => train.appendChild(make('span', `pt-car${car === null ? ' pt-empty' : ''}`, car === null ? '?' : String(car))));

      const row = make('div', 'pt-choices');
      for (const value of round.choices) {
        const choice = row.appendChild(button('lw-button pt-choice', String(value), () => {
          if (state.round !== i) return;
          state = check(state, value);
          if (!state.last.correct) {
            misses += 1;
            message.textContent = `Not quite. ${hint(round, state.tries)}`;
            wiggle(choice);
            return;
          }
          markRight(choice);
          cars[round.hidden].textContent = String(value);
          cars[round.hidden].classList.replace('pt-empty', 'pt-filled');
          keep();
          frame.finish(`✓ The rule: ${ruleText(round.rule)}.`, state.round, () => onDone({ status: state.status, misses, helped: 0 }));
        }));
      }
      stage.append(train, row);
    },
  });
  const { question, stage, message } = frame;
  frame.begin(state.round);
}
