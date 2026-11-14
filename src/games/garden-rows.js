// garden-rows.js: seeds planted in rows, where each row is a group.
//
// It follows Bug Groups and uses the same colors: orange is how many rows
// (groups), teal is how many seeds in each row. Each day has 3 rounds:
//   1. Rows are groups: tap each row to add it (5 + 5 + 5 = 15), then
//      answer 3 × 5 = ?
//   2. Turn it: the garden turns, so 3 rows of 5 becomes 5 rows of 3. Same
//      seeds, so 3 × 5 = 5 × 3.
//   3. Split it: a bigger fact like 7 × 6 is split into 5 rows and 2 rows,
//      5 × 6 + 2 × 6, which are easier.
// Row sizes grow with the level (see src/times.js). Up to 9 rows, so this one
// reaches the harder facts like 7 × 8.

import { createRandom } from '../seed.js';
import { stageFor, STAGES, choicesFor, factKey, parseFact } from '../times.js';
import { make, button, liveMessage, wiggle, roundFrame } from '../ui.js';

export const ROUNDS = ['add', 'turn', 'split'];
// Level 4: sharing (the start of dividing) takes the place of turning.
export const SHARE_ROUNDS = ['add', 'share', 'split'];
const roundsFor = (level) => (level >= 4 ? SHARE_ROUNDS : ROUNDS);
export const SMALL_ROWS = [2, 5];  // rows in the first two rounds (from, to)
export const BIG_ROWS = [6, 9];    // rows in the split round
export const SPLIT_AT = 5;         // the split round always splits off 5 rows

/**
 * Make today's 3 rounds. `level` picks the row sizes (1 to 3), and at
 * level 4 a sharing round takes the place of turning. `review` is
 * a list of facts to bring back (see recordReview in src/progress.js).
 */
export function generate(seed, level = 1, review = []) {
  const random = createRandom(seed);
  const stage = stageFor(level);
  const { sizes } = STAGES[stage];

  // Facts missed a few days ago (like "7x6": 7 rows of 6) come back: one
  // with up to 5 rows in the first round, a bigger one in the split round.
  const back = {};
  for (const { groups: rows, size } of review.map(parseFact)) {
    const kind = rows > SMALL_ROWS[1] ? 'split' : 'add';
    const fits = rows >= SMALL_ROWS[0] && rows <= BIG_ROWS[1] && size >= 2 && size <= 10 && rows !== size;
    if (fits && !back[kind]) back[kind] = { rows, size, review: true };
  }

  const rounds = [];
  for (const kind of roundsFor(level)) {
    const [low, high] = kind === 'split' ? BIG_ROWS : SMALL_ROWS;
    let fact = back[kind];
    while (!fact || rounds.some((r) => r.rows === fact.rows && r.size === fact.size)) {
      const rows = random.int(low, high);
      const size = random.pick(sizes);
      fact = rows === size ? null : { rows, size };
    }
    const total = fact.rows * fact.size;
    // Near misses: one row too few or too many (or, after turning, the
    // count of the turned rows).
    const misses = kind === 'turn' ? [total - fact.rows, total + fact.rows] : [total - fact.size, total + fact.size];
    // Sharing asks how many in each row, so its near misses are one more or one fewer.
    const choices = kind === 'share' ? choicesFor(fact.size, [fact.size - 1, fact.size + 1]) : choicesFor(total, misses);
    rounds.push({ kind, ...fact, choices });
  }
  return { stage, level, rounds };
}

export const total = (round) => round.rows * round.size;

/** The right answer to a round: the seeds in each row when sharing, else all the seeds. */
export const answerOf = (round) => (round.kind === 'share' ? round.size : total(round));

/** The starting state: round 0, no misses. */
export function start(puzzle) {
  return { puzzle, round: 0, misses: 0, status: 'playing', last: null };
}

/** Answer the current round (a number). A miss stays on the round. */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  const correct = answer === answerOf(round);
  const next = correct ? state.round + 1 : state.round;
  return {
    ...state,
    round: next,
    misses: correct ? 0 : state.misses + 1,
    status: next >= state.puzzle.rounds.length ? 'won' : 'playing',
    last: { round: state.round, correct },
  };
}

/** A friendly hint after a miss. */
export function hint(round, answer) {
  const { kind, rows, size } = round;
  if (kind === 'turn') return `Turning doesn't add or take away seeds. How many were there before it turned?`;
  if (kind === 'share') return `Every row gets the same number. Count the seeds in one row.`;
  if (kind === 'split') {
    const rest = rows - SPLIT_AT;
    return `Add the two parts: ${SPLIT_AT * size} + ${rest * size}.`;
  }
  if (answer < total(round)) return `Count the rows: there are ${rows}, with ${size} in each.`;
  return `That's too many. There are ${rows} rows of ${size}.`;
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, stage, level = 1 } = puzzle;
  const kinds = roundsFor(level);
  if (!Array.isArray(rounds) || rounds.length !== kinds.length) {
    return { ok: false, problems: [`there must be ${kinds.length} rounds`] };
  }
  const sizes = STAGES[stage]?.sizes || [];
  rounds.forEach((round, i) => {
    const { kind, rows, size, choices } = round;
    const [low, high] = kind === 'split' ? BIG_ROWS : SMALL_ROWS;
    if (kind !== kinds[i]) problems.push(`round ${i + 1} should be ${kinds[i]}`);
    if (rows < low || rows > high) problems.push(`round ${i + 1}: ${rows} rows`);
    // A fact that came back for review can be from any level.
    const sizeOk = round.review ? size >= 2 && size <= 10 : sizes.includes(size);
    if (!sizeOk) problems.push(`round ${i + 1}: size ${size} isn't in stage ${stage + 1}`);
    if (rows === size) problems.push(`round ${i + 1}: rows and size are both ${size}`);
    if (choices.length !== 3 || new Set(choices).size !== 3 || !choices.includes(answerOf(round))) {
      problems.push(`round ${i + 1} needs 3 different choices, one right`);
    }
  });
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen (styles are shared with Bug Groups: .grp-*)
// ---------------------------------------------------------------------------

const rowsText = (n) => make('span', 'grp-groups', String(n)); // orange
const sizeText = (n) => make('span', 'grp-size', String(n));   // teal

function line(className, ...parts) {
  const node = make('p', className);
  node.append(...parts);
  return node;
}

/** A garden of `rows` rows with `size` seeds each. Returns the rows. */
function garden(rows, size, { tappable = false, splitAt = 0 } = {}) {
  // Tall gardens (more than 6 rows) use smaller seeds so they fit a phone.
  const node = make('div', 'gr-garden' + (tappable ? ' gr-garden-tap' : '') + (rows > 6 ? ' gr-garden-tall' : ''));
  node.setAttribute('aria-label', `${rows} rows of ${size} seeds`);
  const rowNodes = [];
  for (let r = 0; r < rows; r++) {
    const row = tappable ? button('gr-row') : make('div', 'gr-row');
    if (tappable) row.setAttribute('aria-label', `Row of ${size} seeds`);
    if (splitAt && r >= splitAt) row.classList.add('gr-row-part');
    if (splitAt && r === splitAt) row.classList.add('gr-row-split');
    for (let s = 0; s < size; s++) row.append(make('span', 'gr-seed'));
    node.append(row);
    rowNodes.push(row);
  }
  return { node, rowNodes };
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many wrong answers were given, and
 * helped is always 0 (this game never gives an answer away).
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0; // wrong answers in the whole puzzle (state.misses starts over each round)
  const missed = new Set(); // the facts that had a wrong answer, so they come back another day
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round };
    misses = session.saved.misses;
    for (const item of session.saved.missed || []) missed.add(item);
  }
  const keep = () => session.save?.({ round: state.round, misses, missed: [...missed] });
  container.replaceChildren();
  container.classList.add('grp', 'gr');

  const frame = roundFrame(container, {
    count: ROUNDS.length,
    prefix: 'grp',
    draw(i) {
      const round = puzzle.rounds[i];
      ({ add: drawAdd, turn: drawTurn, split: drawSplit, share: drawShare })[round.kind](round);
    },
  });
  const { question, stage, message } = frame;

  const roundNumber = (round) => puzzle.rounds.indexOf(round);

  const finishRound = (text) => {
    keep();
    frame.finish(text, state.round, () => onDone({
      status: state.status, misses, helped: 0,
      practiced: puzzle.rounds.map((round) => factKey(round.rows, round.size)), missed: [...missed],
    }));
  };

  /** Three answer buttons. `onRight` runs after a right answer. */
  function choices(round, onRight) {
    const row = make('div', 'grp-choices');
    for (const n of round.choices) {
      const choice = button('lw-button grp-choice', String(n), () => {
        if (state.round !== roundNumber(round)) return;
        state = check(state, n);
        if (!state.last.correct) {
          misses += 1;
          missed.add(factKey(round.rows, round.size));
          message.textContent = `Not quite. ${hint(round, n)}`;
          wiggle(choice);
          return;
        }
        choice.classList.add('grp-right');
        for (const other of row.children) other.disabled = true;
        onRight();
      });
      row.append(choice);
    }
    return row;
  }

  // 1. Each row is a group: tap to add, then the times fact.
  function drawAdd(round) {
    const { rows, size } = round;
    question.append(line('grp-ask', 'Each row is a group. Tap each row to add it.'));
    const { node, rowNodes } = garden(rows, size, { tappable: true });
    const sum = make('p', 'grp-sum');
    const after = make('div', 'grp-then');
    const counted = new Set();
    rowNodes.forEach((row, i) => row.addEventListener('click', () => {
      if (counted.has(i)) return;
      counted.add(i);
      row.classList.add('gr-row-lit');
      sum.replaceChildren();
      [...counted].forEach((_, k) => sum.append(...(k ? [' + '] : []), sizeText(size)));
      sum.append(` = ${counted.size * size}`);
      if (counted.size === rows) {
        after.append(
          line('grp-ask', rowsText(rows), ' rows of ', sizeText(size), '. So ', rowsText(rows), ' × ', sizeText(size), ' = ?'),
          choices(round, () => {
            after.replaceChildren(line('grp-sum', rowsText(rows), ' × ', sizeText(size), ` = ${total(round)}`));
            finishRound(`✓ ${rows} rows of ${size} make ${total(round)}!`);
          }),
        );
      }
    }));
    stage.append(node, sum, after);
  }

  // 2. Turn the garden: the rows and the seeds in each row swap.
  function drawTurn(round) {
    const { rows, size } = round;
    question.append(line('grp-ask', rowsText(rows), ' × ', sizeText(size), ` = ${total(round)}. Now turn the garden!`));
    const box = make('div', 'gr-box');
    let turned = false;
    const drawGarden = () => {
      const { node, rowNodes } = turned ? garden(size, rows) : garden(rows, size);
      for (const row of rowNodes) row.classList.add('gr-row-lit');
      box.replaceChildren(node);
    };
    const after = make('div', 'grp-then');
    const turnButton = button('lw-button gr-turn', 'Turn it ↻', () => {
      turnButton.remove();
      box.classList.add('gr-turning');
      // Turn the picture, then redraw it as the turned rows.
      setTimeout(() => {
        turned = true;
        box.classList.remove('gr-turning');
        drawGarden();
        after.append(
          line('grp-ask', 'Now there are ', rowsText(size), ' rows of ', sizeText(rows), '. How many seeds?'),
          choices(round, () => {
            after.replaceChildren(
              line('grp-sum', rowsText(size), ' × ', sizeText(rows), ` = ${total(round)}`),
              line('grp-says', 'Same seeds, so ', `${rows} × ${size} = ${size} × ${rows}.`),
            );
            finishRound('✓ Turning a garden never changes how many seeds!');
          }),
        );
      }, 600);
    });
    drawGarden();
    stage.append(box, turnButton, after);
  }

  // Level 4. Share seeds equally into rows: the start of dividing.
  function drawShare(round) {
    const { rows, size } = round;
    question.append(line('grp-ask', `${total(round)} seeds are shared into `, rowsText(rows), ' equal rows. How many are in each row?'));
    const { node, rowNodes } = garden(rows, size);
    for (const row of rowNodes) row.classList.add('gr-row-lit');
    const after = make('div', 'grp-then');
    after.append(choices(round, () => {
      after.replaceChildren(
        line('grp-sum', `${total(round)} ÷ `, rowsText(rows), ' = ', sizeText(size)),
        line('grp-says', 'Sharing equally is dividing. The ÷ says "shared into."'),
      );
      finishRound(`✓ ${size} in each row!`);
    }));
    stage.append(node, after);
  }

  // 3. Split a big fact into 5 rows and the rest.
  function drawSplit(round) {
    const { rows, size } = round;
    const rest = rows - SPLIT_AT;
    question.append(line('grp-ask', rowsText(rows), ' rows of ', sizeText(size), ' is a lot. Split it into ', rowsText(SPLIT_AT), ' rows and ', rowsText(rest), '!'));
    const { node } = garden(rows, size, { splitAt: SPLIT_AT });
    const parts = make('div', 'gr-parts');
    parts.append(
      line('gr-part', rowsText(SPLIT_AT), ' × ', sizeText(size), ` = ${SPLIT_AT * size}`),
      line('gr-part gr-part-rest', rowsText(rest), ' × ', sizeText(size), ` = ${rest * size}`),
    );
    const ask = line('grp-ask', rowsText(rows), ' × ', sizeText(size), ' = ?');
    stage.append(node, parts, ask, choices(round, () => {
      ask.replaceChildren(rowsText(rows), ' × ', sizeText(size), ` = ${SPLIT_AT * size} + ${rest * size} = ${total(round)}`);
      ask.className = 'grp-sum';
      finishRound('✓ Two easy facts make a hard one!');
    }));
  }

  frame.begin(state.round);
}
