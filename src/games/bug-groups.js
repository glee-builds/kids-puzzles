// bug-groups.js: bugs on lily pads in equal groups, leading to times facts.
//
// Each day has 3 rounds, each with its own fact, like 4 groups of 3:
//   1. Match it: which picture shows 4 groups of 3? One choice is 3 groups
//      of 4, and one has groups that aren't the same size.
//   2. Add it, then times it: tap each pad to add its bugs (3 + 3 + 3 + 3
//      = 12), then answer "How many 3s did you add?" That turns the adding
//      into 4 × 3 = 12, read as "4 groups of 3".
//   3. Build it: "Show 2 × 5", with + and − buttons for the pads and for
//      the bugs on each pad.
// The same colors everywhere: orange is how many groups (pads), teal is
// how many in each group (bugs on a pad).
//
// The group sizes grow with the level (see src/times.js). The number of groups
// stays 2 to 5, so the pads fit on a phone screen; Garden Rows has bigger
// facts.

import { createRandom } from '../seed.js';
import { stageFor, STAGES, choicesFor, factKey, parseFact } from '../times.js';
import { make, button, liveMessage, wiggle, roundFrame } from '../ui.js';

export const ROUNDS = ['match', 'add', 'build'];
export const MIN_GROUPS = 2;
export const MAX_GROUPS = 5;
export const MAX_PADS = 5;  // the + button stops here when building
export const MAX_BUGS = 10; // bugs on one pad

/**
 * Make today's 3 rounds. `level` (1 to 3) picks the group sizes. `review`
 * is a list of facts to bring back (see recordReview in src/progress.js).
 */
export function generate(seed, level = 1, review = []) {
  const random = createRandom(seed);
  const stage = stageFor(level);
  const { sizes } = STAGES[stage];
  const facts = [];
  while (facts.length < ROUNDS.length) {
    const groups = random.int(MIN_GROUPS, MAX_GROUPS);
    const size = random.pick(sizes);
    // Different numbers, so "how many groups" and "how many in each" can't
    // be mixed up, and a different fact each round.
    if (groups === size || facts.some((f) => f.groups === groups && f.size === size)) continue;
    facts.push({ groups, size });
  }

  // Facts missed a few days ago (`review`, like "4x3") come back in the
  // add and build rounds, up to 2 of them.
  review.map(parseFact)
    .filter(({ groups, size }) => groups >= MIN_GROUPS && groups <= MAX_GROUPS && size >= 2 && size <= MAX_BUGS && groups !== size)
    .slice(0, 2)
    .forEach((fact, i) => {
      if (!facts.some((f) => f.groups === fact.groups && f.size === fact.size)) facts[1 + i] = { ...fact, review: true };
    });

  const [m, a, b] = facts;
  // Match: the right picture, the turned-around one, and one with uneven groups.
  const uneven = Array(m.groups).fill(m.size);
  uneven[random.int(0, m.groups - 1)] += m.size < MAX_BUGS ? 1 : -1;
  const pictures = random.shuffle([
    Array(m.groups).fill(m.size),
    Array(m.size).fill(m.groups),
    uneven,
  ]);

  return {
    stage,
    rounds: [
      { kind: 'match', ...m, pictures },
      // Near misses for "how many 3s": the size itself, and the total.
      { kind: 'add', ...a, choices: choicesFor(a.groups, [a.size, a.groups * a.size]) },
      { kind: 'build', ...b },
    ],
  };
}

/** True if `pads` (bugs on each pad) shows `groups` equal groups of `size`. */
export const shows = (pads, groups, size) => pads.length === groups && pads.every((n) => n === size);

/** Whether `answer` is right for `round`. */
export function isRight(round, answer) {
  if (round.kind === 'match') return shows(round.pictures[answer] || [], round.groups, round.size);
  if (round.kind === 'add') return answer === round.groups;
  return answer.pads === round.groups && answer.bugs === round.size;
}

/** The starting state: round 0, no misses. */
export function start(puzzle) {
  return { puzzle, round: 0, misses: 0, status: 'playing', last: null };
}

/**
 * Answer the current round. A right answer moves to the next round; a miss
 * stays (no penalty). state.last says what happened: { round, correct }.
 */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  const correct = isRight(round, answer);
  const next = correct ? state.round + 1 : state.round;
  return {
    ...state,
    round: next,
    misses: correct ? 0 : state.misses + 1,
    status: next >= state.puzzle.rounds.length ? 'won' : 'playing',
    last: { round: state.round, correct },
  };
}

/** A friendly hint after a miss, about what was picked. */
export function hint(round, answer) {
  const { groups, size } = round;
  if (round.kind === 'match') {
    const pads = round.pictures[answer];
    if (shows(pads, size, groups)) return `That's ${size} groups of ${groups}. Count the pads: you need ${groups}.`;
    return 'Look closely: every pad needs the same number of bugs.';
  }
  if (round.kind === 'add') {
    if (answer === groups * size) return `${answer} is all the bugs. How many ${size}s did you add?`;
    return `Count the ${size}s you added, one for each pad.`;
  }
  if (answer.pads !== groups) return `Pads are the groups. Make ${groups} pad${groups === 1 ? '' : 's'}.`;
  return `Put ${size} bugs on each pad.`;
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, stage } = puzzle;
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS.length) {
    return { ok: false, problems: [`there must be ${ROUNDS.length} rounds`] };
  }
  const sizes = STAGES[stage]?.sizes || [];
  const seen = new Set();
  rounds.forEach((round, i) => {
    const { kind, groups, size } = round;
    if (kind !== ROUNDS[i]) problems.push(`round ${i + 1} should be ${ROUNDS[i]}`);
    if (groups < MIN_GROUPS || groups > MAX_GROUPS) problems.push(`round ${i + 1}: ${groups} groups`);
    // A fact that came back for review can be from any level.
    const sizeOk = round.review ? size >= 2 && size <= MAX_BUGS : sizes.includes(size);
    if (!sizeOk) problems.push(`round ${i + 1}: size ${size} isn't in stage ${stage + 1}`);
    if (groups === size) problems.push(`round ${i + 1}: groups and size are both ${size}`);
    seen.add(`${groups}x${size}`);
    if (kind === 'match') {
      const right = round.pictures.filter((pads) => shows(pads, groups, size));
      if (round.pictures.length !== 3 || right.length !== 1) problems.push('match needs 3 pictures, exactly one right');
      if (round.pictures.some((pads) => pads.length > MAX_PADS * 2 || pads.some((n) => n < 1 || n > MAX_BUGS))) {
        problems.push('a match picture is too big');
      }
    }
    if (kind === 'add') {
      const { choices } = round;
      if (choices.length !== 3 || new Set(choices).size !== 3 || !choices.includes(groups)) {
        problems.push('add needs 3 different choices, one right');
      }
    }
  });
  if (seen.size !== rounds.length) problems.push('two rounds use the same fact');
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

// For messages like "Four threes make 12!"
const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
const SIZE_WORDS = ['', 'ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens'];

const groupsText = (n) => make('span', 'grp-groups', String(n)); // orange
const sizeText = (n) => make('span', 'grp-size', String(n));     // teal

/** A line of text with numbers colored: parts are strings or nodes. */
function line(className, ...parts) {
  const node = make('p', className);
  node.append(...parts);
  return node;
}

/** A lily pad with `count` bugs. */
function pad(count, className = 'grp-pad') {
  const node = make('span', className);
  for (let i = 0; i < count; i++) node.append(make('span', 'grp-bug'));
  return node;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many wrong answers were given, and
 * helped is always 0 (this game never gives an answer away).
 */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let misses = 0; // wrong answers in the whole puzzle (state.misses starts over each round)
  const missed = new Set(); // the facts that had a wrong answer, so they come back another day
  container.replaceChildren();
  container.classList.add('grp');

  const frame = roundFrame(container, {
    count: ROUNDS.length,
    prefix: 'grp',
    draw(i) {
      const round = puzzle.rounds[i];
      ({ match: drawMatch, add: drawAdd, build: drawBuild })[round.kind](round);
    },
  });
  const { question, stage, message } = frame;

  const finishRound = (text) => frame.finish(text, state.round, () => onDone({
    status: state.status, misses, helped: 0,
    practiced: puzzle.rounds.map((round) => factKey(round.groups, round.size)), missed: [...missed],
  }));

  function answer(value, node) {
    const round = puzzle.rounds[state.round];
    state = check(state, value);
    if (!state.last.correct) {
      misses += 1;
      missed.add(factKey(round.groups, round.size));
      message.textContent = `Not quite. ${hint(round, value)}`;
      if (node) wiggle(node);
    }
    return state.last.correct;
  }

  // 1. Which picture shows the groups?
  function drawMatch(round) {
    const { groups, size } = round;
    question.append(line('grp-ask', 'Which picture shows ', groupsText(groups), ' groups of ', sizeText(size), '?'));
    const list = make('div', 'grp-pictures');
    round.pictures.forEach((pads, i) => {
      const choice = button('grp-picture');
      choice.setAttribute('aria-label', `${pads.length} pads with ${pads.join(', ')} bugs`);
      for (const count of pads) choice.append(pad(count, 'grp-pad grp-pad-small'));
      choice.addEventListener('click', () => {
        if (state.round !== puzzle.rounds.indexOf(round)) return;
        if (answer(i, choice)) {
          choice.classList.add('grp-right');
          for (const other of list.children) other.disabled = true;
          finishRound(`✓ ${groups} pads, ${size} bugs on each!`);
        }
      });
      list.append(choice);
    });
    stage.append(list);
  }

  // 2. Tap each pad to add it, then: how many of that number did you add?
  function drawAdd(round) {
    const { groups, size } = round;
    question.append(line('grp-ask', 'Tap each pad to add up its bugs.'));
    const pads = make('div', 'grp-pads');
    const sum = make('p', 'grp-sum');
    const counted = [];
    const ask = make('div', 'grp-then');
    for (let i = 0; i < groups; i++) {
      const lily = button('grp-pad');
      lily.setAttribute('aria-label', `Lily pad with ${size} bugs`);
      for (let k = 0; k < size; k++) lily.append(make('span', 'grp-bug'));
      lily.addEventListener('click', () => {
        if (counted.includes(i)) return;
        counted.push(i);
        lily.classList.add('grp-pad-lit');
        sum.replaceChildren();
        counted.forEach((_, k) => sum.append(...(k ? [' + '] : []), sizeText(size)));
        sum.append(` = ${counted.length * size}`);
        if (counted.length === groups) askHowMany();
      });
      pads.append(lily);
    }
    stage.append(pads, sum, ask);

    function askHowMany() {
      ask.append(line('grp-ask', `How many ${size}s did you add?`));
      const row = make('div', 'grp-choices');
      for (const n of round.choices) {
        const choice = button('lw-button grp-choice', String(n), () => {
          if (state.round !== puzzle.rounds.indexOf(round)) return;
          if (answer(n, choice)) {
            // Keep the adding on screen and put the times fact under it,
            // so the two line up: 5 + 5 = 10, then 2 × 5 = 10.
            ask.replaceChildren(
              line('grp-sum', groupsText(groups), ' × ', sizeText(size), ` = ${groups * size}`),
              line('grp-says', groupsText(groups), ' groups of ', sizeText(size), '. The × says "groups of."'),
            );
            finishRound(`✓ ${COUNT_WORDS[groups]} ${SIZE_WORDS[size]} make ${groups * size}!`);
          }
        });
        row.append(choice);
      }
      ask.append(row);
    }
  }

  // 3. Build the fact with + and − buttons.
  function drawBuild(round) {
    const { groups, size } = round;
    question.append(line('grp-ask', 'Now you make it. Show ', groupsText(groups), ' × ', sizeText(size), '.'));
    let pads = 1;
    let bugs = 1;
    const picture = make('div', 'grp-pads');
    const controls = make('div', 'grp-steppers');
    const padCount = make('span', 'grp-groups');
    const bugCount = make('span', 'grp-size');

    function stepper(label, count, change) {
      const row = make('div', 'grp-stepper');
      const step = (d) => { message.textContent = ''; change(d); };
      const less = button('lw-button grp-step', '−', () => step(-1));
      const more = button('lw-button grp-step', '+', () => step(1));
      less.setAttribute('aria-label', `Fewer ${label}`);
      more.setAttribute('aria-label', `More ${label}`);
      const text = make('span', 'grp-step-label');
      text.append(count, ` ${label}`);
      row.append(less, text, more);
      return row;
    }
    const draw = () => {
      picture.replaceChildren(...Array.from({ length: pads }, () => pad(bugs)));
      picture.setAttribute('aria-label', `${pads} pads with ${bugs} bugs on each`);
      padCount.textContent = String(pads);
      bugCount.textContent = String(bugs);
    };
    controls.append(
      stepper('pads', padCount, (d) => { pads = Math.min(MAX_PADS, Math.max(1, pads + d)); draw(); }),
      stepper('bugs on each', bugCount, (d) => { bugs = Math.min(MAX_BUGS, Math.max(1, bugs + d)); draw(); }),
    );
    const checkButton = button('lw-button lw-enter grp-check', 'Check', () => {
      if (state.round !== puzzle.rounds.indexOf(round)) return;
      if (answer({ pads, bugs }, picture)) {
        controls.remove();
        checkButton.remove();
        stage.append(line('grp-sum', groupsText(groups), ' × ', sizeText(size), ` = ${groups * size}`));
        finishRound(`✓ ${groups} groups of ${size}. You made a times fact!`);
      }
    });
    draw();
    stage.append(picture, controls, checkButton);
  }

  frame.begin(0);
}
