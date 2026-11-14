// word-problems.js ("Think It Through"): story problems where the hard part
// is deciding what to do, not the adding.
//
// Two kinds of problem:
//   extra: one number in the story doesn't matter. First tap the number
//          you don't need, then answer.
//   two:   two steps, like "had 23, found 15 more, used 8".
// The story text comes from data/word-problems.json, with {a}, {b}, and {c}
// as spaces for numbers. The code picks the numbers and works out every
// answer, so an answer is never wrong.

import { createRandom } from '../seed.js';
import { make, button, liveMessage, numberPad } from '../ui.js';

export const PER_DAY = 3;
export const MAX_TRIES = 3; // after this many misses the answer fills itself in
export const PICK_TRIES = 2; // after this many wrong taps the extra number is shown
export const MAX_NUMBER = 99;

// What each kind of problem works out. `extra` is the number not needed.
export const KINDS = {
  'extra-add': { answer: ({ a, b }) => a + b, extra: 'c' },
  'extra-sub': { answer: ({ a, b }) => a - b, extra: 'c' },
  'two-add-sub': { answer: ({ a, b, c }) => a + b - c, first: ({ a, b }) => a + b },
  'two-sub-sub': { answer: ({ a, b, c }) => a - b - c, first: ({ a, b }) => a - b },
  'two-add-add': { answer: ({ a, b, c }) => a + b + c, first: ({ a, b }) => a + b },
};

/** Numbers for one kind of problem. */
function pickNumbers(kind, random) {
  for (;;) {
    let n;
    if (kind === 'extra-add') {
      const a = random.int(12, 60);
      n = { a, b: random.int(10, Math.max(10, 99 - a)), c: random.int(2, 20) };
    } else if (kind === 'extra-sub') {
      const a = random.int(25, 99);
      n = { a, b: random.int(5, a - 5), c: random.int(2, 30) };
    } else if (kind === 'two-add-sub') {
      const a = random.int(15, 50);
      const b = random.int(10, 30);
      n = { a, b, c: random.int(5, a + b - 5) };
    } else if (kind === 'two-sub-sub') {
      const a = random.int(40, 99);
      const b = random.int(5, 25);
      n = { a, b, c: random.int(5, Math.max(5, a - b - 5)) };
    } else {
      n = { a: random.int(5, 40), b: random.int(5, 40), c: random.int(5, 40) };
    }
    if (numberProblems({ kind, numbers: n }).length === 0) return n;
  }
}

/** Problems with one problem's numbers. An empty list means it's fine. */
function numberProblems({ kind, numbers }) {
  const problems = [];
  const values = Object.values(numbers);
  if (new Set(values).size !== values.length) problems.push('two numbers are the same');
  const answer = KINDS[kind].answer(numbers);
  const all = [...values, answer];
  if (KINDS[kind].first) all.push(KINDS[kind].first(numbers));
  if (all.some((x) => !Number.isInteger(x) || x < 1 || x > MAX_NUMBER)) {
    problems.push('a number or answer is outside 1 to 99');
  }
  return problems;
}

/** Problems with a story from the data file. An empty list means it's fine. */
export function textProblems(item) {
  const problems = [];
  if (!(item.kind in KINDS)) problems.push(`unknown kind ${item.kind}`);
  for (const slot of ['a', 'b', 'c']) {
    const count = item.text.split(`{${slot}}`).length - 1;
    if (count !== 1) problems.push(`{${slot}} appears ${count} times`);
  }
  if (/\d/.test(item.text)) problems.push('numbers must come from {a}, {b}, {c}, not the text');
  if (!item.text.trim().endsWith('?')) problems.push('must end with a question');
  if (/[.?!]\s+\{/.test(item.text)) problems.push('a sentence starts with a number');
  return problems;
}

/** Make today's problems: an extra-number problem, a two-step one, then either. */
export function generate(seed, items) {
  const random = createRandom(seed);
  const groups = ['extra', 'two', random.pick(['extra', 'two'])];
  const used = new Set();
  const problems = groups.map((group) => {
    const choices = items.filter((item) => item.kind.startsWith(group) && !used.has(item.text));
    const item = random.pick(choices);
    used.add(item.text);
    return { kind: item.kind, text: item.text, numbers: pickNumbers(item.kind, random) };
  });
  return { problems };
}

/** Confirm a day's problems are valid. Returns { ok, problems }. */
export function verify(puzzle) {
  if (!Array.isArray(puzzle.problems) || puzzle.problems.length !== PER_DAY) {
    return { ok: false, problems: [`there must be ${PER_DAY} problems`] };
  }
  const problems = puzzle.problems.flatMap((p, i) =>
    [...textProblems(p), ...numberProblems(p)].map((text) => `problem ${i + 1}: ${text}`));
  return { ok: problems.length === 0, problems };
}

/** The story split into text and numbers, for drawing: ['Robo has ', { slot: 'a', value: 23 }, ...]. */
export function pieces(problem) {
  return problem.text.split(/(\{[abc]\})/).filter(Boolean).map((part) => {
    const match = part.match(/^\{([abc])\}$/);
    return match ? { slot: match[1], value: problem.numbers[match[1]] } : part;
  });
}

export const answerFor = (problem) => KINDS[problem.kind].answer(problem.numbers);
export const isExtra = (problem) => problem.kind.startsWith('extra');

/** The number sentence that solves it, like "23 + 15 − 8 = 30". */
export function worked(problem) {
  const { a, b, c } = problem.numbers;
  const answer = answerFor(problem);
  switch (problem.kind) {
    case 'extra-add': return `${a} + ${b} = ${answer}`;
    case 'extra-sub': return `${a} − ${b} = ${answer}`;
    case 'two-add-sub': return `${a} + ${b} − ${c} = ${answer}`;
    case 'two-sub-sub': return `${a} − ${b} − ${c} = ${answer}`;
    default: return `${a} + ${b} + ${c} = ${answer}`;
  }
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

function phaseFor(problem) {
  return isExtra(problem) ? 'pick' : 'answer';
}

/** The starting state. */
export function start(puzzle, index = 0) {
  return {
    puzzle, index, phase: phaseFor(puzzle.problems[index]),
    tapped: [], pickMisses: 0, misses: 0, revealed: false, status: 'playing', last: null,
  };
}

export const current = (state) => state.puzzle.problems[state.index];

/**
 * A move is { pick: 'a' | 'b' | 'c' } to tap a number you don't need, or
 * { answer: number }. Returns the new state; state.last says what happened.
 */
export function check(state, move) {
  if (state.status !== 'playing') throw new Error('These problems are already finished.');
  const problem = current(state);

  if ('pick' in move) {
    if (state.phase !== 'pick') throw new Error('No number to pick now.');
    if (move.pick === KINDS[problem.kind].extra) {
      return { ...state, phase: 'answer', last: { pick: move.pick, correct: true } };
    }
    const pickMisses = state.pickMisses + 1;
    const shown = pickMisses >= PICK_TRIES;
    return {
      ...state,
      phase: shown ? 'answer' : 'pick',
      tapped: [...state.tapped, move.pick],
      pickMisses,
      last: { pick: move.pick, correct: false, shown },
    };
  }

  if (state.phase !== 'answer') throw new Error('Tap the number you don\'t need first.');
  const answer = answerFor(problem);
  if (Number(move.answer) === answer) {
    return { ...state, phase: 'done', last: { answer, correct: true } };
  }
  const misses = state.misses + 1;
  const revealed = misses >= MAX_TRIES;
  return {
    ...state,
    phase: revealed ? 'done' : 'answer',
    misses,
    revealed,
    last: { answer: Number(move.answer), correct: false, revealed },
  };
}

/** Move on to the next problem. The last one finishes the game. */
export function next(state) {
  if (state.phase !== 'done') throw new Error('Answer this problem first.');
  const index = state.index + 1;
  if (index >= state.puzzle.problems.length) return { ...state, status: 'won' };
  return start(state.puzzle, index);
}

/** A hint, stronger after each miss. */
export function hint(state) {
  const problem = current(state);
  const { a, b, c } = problem.numbers;
  if (state.phase === 'pick') {
    return state.pickMisses === 0
      ? 'Read the question at the end. Which number doesn\'t help answer it?'
      : 'We need that number. Read the question again. Which one doesn\'t matter?';
  }
  const kind = KINDS[problem.kind];
  if (state.misses === 0) return 'Type the answer, then press Check.';
  if (problem.kind === 'extra-add') {
    return state.misses === 1 ? 'Put the two groups together.' : `${a} + ${b} = ?`;
  }
  if (problem.kind === 'extra-sub') {
    return state.misses === 1 ? 'Some went away. Take them away.' : `${a} − ${b} = ?`;
  }
  const first = kind.first(problem.numbers);
  const firstSign = problem.kind === 'two-sub-sub' ? '−' : '+';
  const secondSign = problem.kind === 'two-add-add' ? '+' : '−';
  if (state.misses === 1) return `Two steps! First work out ${a} ${firstSign} ${b}.`;
  return `${a} ${firstSign} ${b} = ${first}. Now ${first} ${secondSign} ${c} = ?`;
}

// ---------------------------------------------------------------------------
// The screen: the story, a prompt, and a number pad.
// ---------------------------------------------------------------------------

const CHEERS = ['You thought it through!', 'Great thinking!', 'You got it!', 'Nice work!'];

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let typed = '';
  let cheerCount = 0;

  container.replaceChildren();
  container.classList.add('wp');

  const count = make('p', 'count-line');
  const story = make('p', 'wp-story');
  const ask = make('p', 'wp-ask');
  const entry = make('p', 'wp-entry');
  const message = liveMessage('wp-message');

  const { node: pad, stop: stopKeys } = numberPad(container, { onDigit: typeDigit, onErase: erase, onCheck: submit }, 'wp-pad');

  const nextButton = button('button next-button', '', goNext);

  container.append(count, story, ask, entry, message, pad, nextButton);

  function pick(slot) {
    if (state.phase !== 'pick' || state.tapped.includes(slot)) return;
    state = check(state, { pick: slot });
    if (state.last.correct) message.textContent = 'Yes! That number doesn\'t matter here.';
    else if (state.last.shown) message.textContent = 'We need that one too. Here\'s the number that doesn\'t matter.';
    else message.textContent = hint(state);
    draw();
  }

  function typeDigit(digit) {
    if (state.phase !== 'answer' || typed.length >= 3) return;
    typed = typed === '0' ? digit : typed + digit;
    draw();
  }

  function erase() {
    typed = typed.slice(0, -1);
    draw();
  }

  function submit() {
    if (state.phase !== 'answer') return;
    if (typed === '') {
      message.textContent = 'Type a number, then press Check.';
      return;
    }
    state = check(state, { answer: Number(typed) });
    typed = '';
    if (state.last.correct) message.textContent = CHEERS[cheerCount++ % CHEERS.length];
    else if (state.last.revealed) message.textContent = `It's ${answerFor(current(state))}. Next time you'll get it!`;
    else message.textContent = `Not quite. ${hint(state)}`;
    draw();
  }

  function goNext() {
    state = next(state);
    if (state.status === 'won') {
      message.textContent = 'You thought them all through!';
      nextButton.hidden = true;
      stopKeys();
      onDone({ status: state.status });
      return;
    }
    message.textContent = '';
    draw();
  }

  function draw() {
    const problem = current(state);
    const extraSlot = KINDS[problem.kind].extra;
    const extraFound = isExtra(problem) && state.phase !== 'pick';

    count.textContent = `Problem ${state.index + 1} of ${puzzle.problems.length}`;

    story.replaceChildren();
    for (const piece of pieces(problem)) {
      if (typeof piece === 'string') {
        story.append(piece);
        continue;
      }
      const chip = make(state.phase === 'pick' ? 'button' : 'span', 'wp-number', String(piece.value));
      if (state.phase === 'pick') {
        chip.type = 'button';
        chip.addEventListener('click', () => pick(piece.slot));
        if (state.tapped.includes(piece.slot)) {
          chip.classList.add('wp-needed');
          chip.disabled = true;
          chip.setAttribute('aria-label', `${piece.value}, needed`);
        }
      } else if (extraFound && piece.slot === extraSlot) {
        chip.classList.add('wp-extra');
        chip.setAttribute('aria-label', `${piece.value}, not needed`);
      }
      story.append(chip);
    }

    if (state.phase === 'pick') {
      ask.textContent = 'Which number don\'t you need? Tap it.';
    } else if (state.phase === 'answer') {
      ask.textContent = 'What\'s the answer?';
    } else {
      ask.textContent = state.revealed ? 'Here\'s how:' : 'You did it:';
    }

    entry.replaceChildren();
    if (state.phase === 'answer') {
      entry.append(make('span', 'wp-typed', typed || '?'));
    } else if (state.phase === 'done') {
      entry.append(make('span', state.revealed ? 'wp-worked wp-shown' : 'wp-worked', `${worked(problem)} ${state.revealed ? '' : '✓'}`.trim()));
    }
    entry.hidden = state.phase === 'pick';

    pad.hidden = state.phase !== 'answer';
    nextButton.hidden = state.phase !== 'done';
    nextButton.textContent = state.index === puzzle.problems.length - 1 ? 'Finish ✓' : 'Next problem →';
  }


  draw();
}
