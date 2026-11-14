// find-the-mistake.js: the frog solved some sums step by step and made one
// mistake in each. Find the wrong step, then fix it.
//
// Each problem is a short list of steps, like "30 + 20 = 50". A step's left
// or right number can be an earlier step's answer. The code picks the
// numbers, works out every step, then plants exactly one mistake: one step's
// answer is off by 1 (or by 10 when it adds or takes away whole tens).
// Steps after it use the wrong number, the way a real mistake carries
// forward, so only that one step is wrong.

import { createRandom } from '../seed.js';
import { make, button, liveMessage, numberPad } from '../ui.js';

export const PROBLEMS = 4;
export const MAX_TRIES = 3; // after this many misses the fix fills itself in
export const MAX_NUMBER = 100;

const tens = (n) => Math.floor(n / 10) * 10;
const ones = (n) => n % 10;
const ref = (step) => ({ step });

// The kinds of problem, easiest first. Each returns
// { question: [left, op, right], steps: [[left, op, right], ...] }.
export const KINDS = {
  // 8 + 7: 8 + 2 = 10, 7 − 2 = 5, 10 + 5 = 15
  makeTen(random) {
    const x = random.int(6, 9);
    const y = random.int(11 - x, 9);
    const k = 10 - x;
    return { question: [x, '+', y], steps: [[x, '+', k], [y, '−', k], [ref(0), '+', ref(1)]] };
  },

  // 46 + 30: 46 + 10 = 56, 56 + 10 = 66, 66 + 10 = 76
  hopTens(random) {
    const hops = random.int(2, 3);
    const a = random.int(11, 99 - hops * 10);
    const steps = [[a, '+', 10]];
    for (let i = 1; i < hops; i++) steps.push([ref(i - 1), '+', 10]);
    return { question: [a, '+', hops * 10], steps };
  },

  // 34 + 28: 30 + 20 = 50, 4 + 8 = 12, 50 + 12 = 62
  addTensOnes(random) {
    for (;;) {
      const a = random.int(12, 79);
      const b = random.int(12, 79);
      if (a + b > 99 || ones(a) === 0 || ones(b) === 0) continue;
      return {
        question: [a, '+', b],
        steps: [[tens(a), '+', tens(b)], [ones(a), '+', ones(b)], [ref(0), '+', ref(1)]],
      };
    }
  },

  // 75 − 32: 70 − 30 = 40, 5 − 2 = 3, 40 + 3 = 43
  subtractTensOnes(random) {
    for (;;) {
      const a = random.int(31, 99);
      const b = random.int(11, a - 10);
      if (ones(a) === 0 || ones(b) === 0 || ones(b) > ones(a)) continue;
      return {
        question: [a, '−', b],
        steps: [[tens(a), '−', tens(b)], [ones(a), '−', ones(b)], [ref(0), '+', ref(1)]],
      };
    }
  },
};

export const ORDER = ['makeTen', 'hopTens', 'addTensOnes', 'subtractTensOnes'];

const apply = (left, op, right) => (op === '+' ? left + right : left - right);

/**
 * Work out every line of a problem as it is shown on screen. Until the
 * mistake is fixed, its step is off by `delta`, and later steps use the
 * wrong number. Each line: { left, op, right, result (as shown), answer (what it should be) }.
 */
export function lines(problem, fixed = false) {
  const shown = [];
  return problem.steps.map(([l, op, r], i) => {
    const value = (x) => (typeof x === 'number' ? x : shown[x.step]);
    const left = value(l);
    const right = value(r);
    const answer = apply(left, op, right);
    const result = i === problem.mistake && !fixed ? answer + problem.delta : answer;
    shown.push(result);
    return { left, op, right, result, answer };
  });
}

/** The right answer to the question, worked out directly. */
export function questionAnswer(problem) {
  const [a, op, b] = problem.question;
  return apply(a, op, b);
}

/** Make today's problems from a seed. */
export function generate(seed) {
  const random = createRandom(seed);
  const problems = ORDER.map((kind) => {
    for (;;) {
      const { question, steps } = KINDS[kind](random);
      const problem = { kind, question, steps, mistake: random.int(0, steps.length - 1), delta: 0 };
      const correct = lines(problem, true)[problem.mistake];
      // Whole tens are off by 10 (30 + 20 = 60); anything else by 1.
      const size = correct.left % 10 === 0 && correct.right % 10 === 0 ? 10 : 1;
      problem.delta = random.pick([size, -size]);
      if (verifyProblem(problem).length === 0) return problem;
      problem.delta = -problem.delta;
      if (verifyProblem(problem).length === 0) return problem;
    }
  });
  return { problems };
}

function verifyProblem(problem) {
  const problems = [];
  const shown = lines(problem);
  const fixed = lines(problem, true);
  const wrong = shown.filter((line) => line.result !== line.answer);
  if (wrong.length !== 1) problems.push(`${wrong.length} wrong steps, not 1`);
  if (shown[problem.mistake].result === shown[problem.mistake].answer) {
    problems.push('the planted mistake is not wrong');
  }
  if (fixed[fixed.length - 1].result !== questionAnswer(problem)) {
    problems.push('the fixed steps do not reach the right answer');
  }
  for (const line of [...shown, ...fixed]) {
    for (const n of [line.left, line.right, line.result]) {
      if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) problems.push(`number ${n} is out of range`);
    }
  }
  return problems;
}

/** Confirm a day's problems are valid. Returns { ok, problems }. */
export function verify(puzzle) {
  if (!Array.isArray(puzzle.problems) || puzzle.problems.length !== PROBLEMS) {
    return { ok: false, problems: [`there must be ${PROBLEMS} problems`] };
  }
  const problems = puzzle.problems.flatMap((p, i) => verifyProblem(p).map((text) => `problem ${i + 1}: ${text}`));
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Playing: find the wrong step, fix it, then move to the next problem.
// ---------------------------------------------------------------------------

/** The starting state. */
export function start(puzzle) {
  return { puzzle, index: 0, phase: 'find', checked: [], findMisses: 0, fixMisses: 0, revealed: false, status: 'playing', last: null };
}

export const current = (state) => state.puzzle.problems[state.index];

/**
 * A move is { pick: stepIndex } while finding, or { fix: number } while
 * fixing. Returns the new state; state.last says what happened.
 */
export function check(state, move) {
  if (state.status !== 'playing') throw new Error('These problems are already finished.');
  const problem = current(state);

  if ('pick' in move) {
    if (state.phase !== 'find') throw new Error('The mistake is already found.');
    const step = move.pick;
    if (step === problem.mistake) {
      return { ...state, phase: 'fix', last: { pick: step, correct: true } };
    }
    return {
      ...state,
      checked: state.checked.includes(step) ? state.checked : [...state.checked, step],
      findMisses: state.findMisses + 1,
      last: { pick: step, correct: false },
    };
  }

  if (state.phase !== 'fix') throw new Error('Find the mistake first.');
  const answer = lines(problem, true)[problem.mistake].answer;
  if (Number(move.fix) === answer) {
    return { ...state, phase: 'fixed', last: { fix: answer, correct: true } };
  }
  const fixMisses = state.fixMisses + 1;
  const revealed = fixMisses >= MAX_TRIES;
  return {
    ...state,
    phase: revealed ? 'fixed' : 'fix',
    fixMisses,
    revealed,
    last: { fix: Number(move.fix), correct: false, revealed },
  };
}

/** Move on after a fix. The last problem finishes the game. */
export function next(state) {
  if (state.phase !== 'fixed') throw new Error('Fix this problem first.');
  const index = state.index + 1;
  if (index >= state.puzzle.problems.length) return { ...state, status: 'won' };
  return { ...start(state.puzzle), index };
}

/** A hint, stronger after each miss. */
export function hint(state) {
  const problem = current(state);
  if (state.phase === 'find') {
    return state.findMisses === 0
      ? 'Work out each step yourself. Which one doesn\'t match?'
      : 'That step is right ✓. Check the others.';
  }
  const { left, op, right } = lines(problem, true)[problem.mistake];
  if (state.fixMisses === 0) return `What is ${left} ${op} ${right}?`;
  if (left % 10 === 0 && right % 10 === 0) {
    return `Think in tens: ${left / 10} tens ${op} ${right / 10} tens.`;
  }
  return op === '+' ? `Count on ${right} from ${left}.` : `Count back ${right} from ${left}.`;
}

// ---------------------------------------------------------------------------
// The screen: the frog's work, a message line, and a number pad.
// ---------------------------------------------------------------------------

const CHEERS = ['You fixed it!', 'Great checking!', 'Nice work!', 'You got it!'];

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: how many wrong answers, and how many answers were shown.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let typed = '';
  let cheerCount = 0;
  let misses = 0; // wrong answers in the whole puzzle
  let helped = 0; // answers the game showed after too many tries
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  const saved = session.saved;
  if (saved) {
    state = { ...state, ...saved.state };
    misses = saved.misses;
    helped = saved.helped;
  }
  // Save where we are: which problem, how far into it, and the running counts.
  const keep = () => {
    const { index, phase, checked, findMisses, fixMisses, revealed } = state;
    session.save?.({ state: { index, phase, checked, findMisses, fixMisses, revealed }, misses, helped });
  };

  container.replaceChildren();
  container.classList.add('fm');

  const talk = make('div', 'fm-talk');
  const frog = make('img', 'fm-frog');
  frog.src = 'assets/frog.svg';
  frog.alt = '';
  const bubble = make('p', 'fm-bubble');
  talk.append(frog, bubble);

  const count = make('p', 'count-line');
  const question = make('p', 'fm-question');
  const list = make('ol', 'fm-steps');
  const message = liveMessage('fm-message');

  const { node: pad, stop: stopKeys } = numberPad(container, { onDigit: typeDigit, onErase: erase, onCheck: submit }, 'fm-pad');

  const nextButton = button('button next-button', '', goNext);

  container.append(talk, count, question, list, message, pad, nextButton);

  function pick(step) {
    if (state.status !== 'playing' || state.phase !== 'find' || state.checked.includes(step)) return;
    state = check(state, { pick: step });
    if (state.last.correct) {
      message.textContent = 'You found it! ✗ That step is wrong. Type the right number.';
    } else {
      misses++;
      message.textContent = hint(state);
    }
    keep();
    draw();
  }

  function typeDigit(digit) {
    if (state.phase !== 'fix' || typed.length >= 3) return;
    typed = typed === '0' ? digit : typed + digit;
    draw();
  }

  function erase() {
    typed = typed.slice(0, -1);
    draw();
  }

  function submit() {
    if (state.phase !== 'fix') return;
    if (typed === '') {
      message.textContent = 'Type a number, then press Check.';
      return;
    }
    state = check(state, { fix: Number(typed) });
    typed = '';
    if (!state.last.correct) misses++;
    if (state.last.revealed) helped++;
    if (state.last.correct) {
      message.textContent = `${CHEERS[cheerCount++ % CHEERS.length]} Now the answer is right too.`;
    } else if (state.last.revealed) {
      const answer = lines(current(state), true)[current(state).mistake].answer;
      message.textContent = `It's ${answer}. Now the answer is right too.`;
    } else {
      message.textContent = `Not quite. ${hint(state)}`;
    }
    keep();
    draw();
  }

  function goNext() {
    state = next(state);
    if (state.status === 'won') {
      message.textContent = 'You checked all the frog\'s work!';
      bubble.textContent = 'Thank you for fixing my mistakes!';
      nextButton.hidden = true;
      pad.hidden = true;
      stopKeys();
      onDone({ status: state.status, misses, helped });
      return;
    }
    message.textContent = hint(state);
    keep();
    draw();
  }

  function draw() {
    const problem = current(state);
    const fixed = state.phase === 'fixed';
    const shown = lines(problem, fixed);
    const before = lines(problem);
    const [a, op, b] = problem.question;

    bubble.textContent = fixed
      ? 'Oops! Thanks for fixing it.'
      : 'I made one mistake. Can you find it?';
    count.textContent = `Problem ${state.index + 1} of ${puzzle.problems.length}`;
    question.textContent = `${a} ${op} ${b} = ${fixed ? questionAnswer(problem) : '?'}`;
    question.classList.toggle('fm-question-done', fixed);

    list.replaceChildren();
    shown.forEach((line, i) => {
      const row = make('li');
      const stepButton = button('fm-step');
      const isMistake = i === problem.mistake && state.phase !== 'find';
      const isLast = i === shown.length - 1;

      const sum = make('span', 'fm-sum', `${line.left} ${line.op} ${line.right} = `);
      const result = make('span', 'fm-result');
      if (isMistake && state.phase === 'fix') {
        result.append(make('s', 'fm-old', String(before[i].result)), ' ', make('span', 'fm-typed', typed || '?'));
      } else if (isMistake && fixed) {
        result.append(make('s', 'fm-old', String(before[i].result)), ' ', String(line.result));
      } else {
        result.textContent = String(line.result);
      }
      stepButton.append(sum, result);
      if (isLast) stepButton.append(make('span', 'fm-tag', 'answer'));

      let mark = '';
      let label = `${line.left} ${line.op} ${line.right} = ${line.result}`;
      if (isMistake && fixed) {
        stepButton.classList.add(state.revealed ? 'fm-shown' : 'fm-fixed');
        mark = '✓';
        label += state.revealed ? ', filled in' : ', fixed';
      } else if (isMistake) {
        stepButton.classList.add('fm-wrong');
        mark = '✗';
        label = `${line.left} ${line.op} ${line.right}, the wrong step, typing ${typed || 'nothing yet'}`;
      } else if (state.checked.includes(i)) {
        stepButton.classList.add('fm-ok');
        mark = '✓';
        label += ', this step is right';
      } else if (fixed && line.result !== before[i].result) {
        stepButton.classList.add('fm-changed');
        label += ', changed';
      }
      if (mark) stepButton.append(make('span', 'fm-mark', mark));
      stepButton.setAttribute('aria-label', label);
      stepButton.disabled = state.phase !== 'find' || state.checked.includes(i);
      stepButton.addEventListener('click', () => pick(i));
      row.append(stepButton);
      list.append(row);
    });

    pad.hidden = state.phase !== 'fix';
    nextButton.hidden = !fixed;
    nextButton.textContent = state.index === puzzle.problems.length - 1 ? 'Finish ✓' : 'Next problem →';
  }

  if (!saved) message.textContent = 'Tap the step that is wrong.';
  else if (state.phase !== 'fixed') message.textContent = hint(state);
  draw();
}
