// math-mix-ups.js: puzzles that take some thinking. It's the start of
// algebra: working out what you don't know from what you do.
//
// There are 8 kinds of round. Each day has 3 of them, dealt in turn so all
// 8 come around every few days:
//   shapes    each shape stands for a number:  ▲ + ▲ = 10,  ▲ + ● = 8,  ● = ?
//   scale     2 triangles balance 6 squares; how many squares balance one?
//   machine   2 goes in and 7 comes out; what comes out for 9?
//   pattern   3, 6, 9, ?, 15: which number is missing?
//   missing   8 + □ = 15: what goes in the box?
//   equal     6 + 4 = 7 + □: make both sides the same
//   area      how many small squares make this shape? (or how far around)
//   sides     2 triangles and a square: how many sides in all?
//
// Every kind comes in two heats (the puzzle's two levels). A switch at the
// top of the screen lets the player pick; the same kinds of round are there
// at both heats, so switching keeps the player's place.
//   1  Mild   about 2nd grade: one step.
//   2  Spicy  about 3rd to 4th grade: the THINKING is harder (two unknowns,
//             working backwards, keeping two sides equal), not the sums.
// At both heats the sums stay small: times facts up to 9 × 9, and adding or
// taking away numbers below 100. `verify` checks that.
//
// Every round has: a question, 3 choices (one right), two hints (a nudge,
// then a stronger one), and `why`, a sentence that explains the answer.

import { createRandom, dealForDay } from '../seed.js';
import { choicesFor } from '../times.js';
import { make, button, wiggle, roundFrame } from '../ui.js';

export const KINDS = ['shapes', 'scale', 'machine', 'pattern', 'missing', 'equal', 'area', 'sides'];
const ROUNDS_PER_DAY = 3;
export const HEATS = ['Mild', 'Spicy'];
const clampLevel = (level = 1) => Math.min(Math.max(level, 1), HEATS.length);

/** The kinds of round for a day number (days since a fixed start date). */
export const kindsForDay = (dayNumber = 0) => dealForDay(KINDS, ROUNDS_PER_DAY, dayNumber, 'math-mix-ups');

// How many sides each shape has (for the "sides" rounds).
const SIDES = { triangle: 3, square: 4, pentagon: 5, hexagon: 6 };

const BOX = '□';

// ---------- Making each kind of round ----------
// Each maker takes (random, spicy) and returns the round, plus `near`: the
// wrong answers a player is most likely to reach.

const MAKERS = {
  /** Lines of shapes with totals, and the shape to work out. */
  shapes(random, spicy) {
    for (;;) {
      const [triangle, circle, square] = [random.int(2, 9), random.int(1, 9), random.int(1, 9)];
      if (new Set([triangle, circle, square]).size < 3) continue;
      const values = { triangle, circle, square };
      const done = (lines, ask, near, hints, why) => ({
        lines, ask, values, text: `Each shape stands for a number. What is the ${ask}?`, answer: values[ask], near, hints, why,
      });
      if (!spicy) {
        // The first line has one kind of shape, so it can be solved on its own.
        return done(
          [{ shapes: ['triangle', 'triangle'], op: '+', total: triangle * 2 }, { shapes: ['triangle', 'circle'], op: '+', total: triangle + circle }],
          'circle', [triangle, circle + 2],
          ['Start with the top line. It has only one kind of shape.', `The triangle is ${triangle}. Use that in the next line.`],
          `The triangle is ${triangle}, so the circle is ${circle}.`,
        );
      }
      if (random.int(0, 1) === 0 && triangle > circle) {
        // Two unknowns at once: what they add up to, and how far apart they are.
        return done(
          [{ shapes: ['triangle', 'circle'], op: '+', total: triangle + circle }, { shapes: ['triangle', 'circle'], op: '−', total: triangle - circle }],
          'triangle', [circle, triangle + 1],
          [`Two numbers add up to ${triangle + circle}. The triangle is ${triangle - circle} more than the circle.`, `Try pairs that make ${triangle + circle}, and look for the pair that is ${triangle - circle} apart.`],
          `${triangle} + ${circle} = ${triangle + circle}, and ${triangle} − ${circle} = ${triangle - circle}.`,
        );
      }
      // Three of a kind, then a chain through all three shapes.
      const takeAway = circle > square;
      return done(
        [
          { shapes: ['triangle', 'triangle', 'triangle'], op: '+', total: triangle * 3 },
          { shapes: ['triangle', 'circle'], op: '+', total: triangle + circle },
          { shapes: ['circle', 'square'], op: takeAway ? '−' : '+', total: takeAway ? circle - square : circle + square },
        ],
        'square', [triangle, circle],
        ['Start with the top line. It has only one kind of shape.', `Three triangles make ${triangle * 3}, so the triangle is ${triangle}. Now find the circle.`],
        `Triangle ${triangle}, circle ${circle}, so the square is ${square}.`,
      );
    }
  },

  /** A level balance: triangles (and maybe some squares) on one side, squares on the other. */
  scale(random, spicy) {
    const left = spicy ? random.int(2, 3) : 2;
    const each = random.int(2, spicy ? 3 : 5);
    // Spicy: a few squares sit with the triangles, and have to come off both sides first.
    const extra = spicy ? random.int(1, 2) : 0;
    const right = left * each + extra;
    const ofEach = extra === 1 ? '1 square' : `${extra} squares`;
    return {
      left, extra, right,
      text: 'The scale is level. How many squares balance one triangle?',
      answer: each,
      near: spicy ? [right - extra, each + 1] : [right, each + 1],
      hints: spicy
        ? [`Take ${ofEach} off both sides. The scale stays level.`, `That leaves ${left} triangles and ${right - extra} squares. Share the squares equally.`]
        : [`Share the ${right} squares equally between the ${left} triangles.`, `Half of ${right} is ${each}.`],
      why: spicy
        ? `Take ${ofEach} off each side: ${left} triangles balance ${right - extra} squares, so one balances ${each}.`
        : `${right} squares shared by ${left} triangles is ${each} each.`,
    };
  },

  /** Two examples of in and out; then what comes out (or, spicy, what went in). */
  machine(random, spicy) {
    const add = { name: (k) => `add ${k}`, run: (n, k) => n + k, undo: (k) => `take away ${k}`, k: [2, 9], inputs: [1, 20] };
    const takeAway = { name: (k) => `take away ${k}`, run: (n, k) => n - k, undo: (k) => `add ${k}`, k: [2, 9], inputs: [11, 30] };
    const times = { name: (k) => `times ${k}`, run: (n, k) => n * k, k: [2, 5], inputs: [2, 9] };
    const doublePlus = { name: () => 'double it, then add 1', run: (n) => n * 2 + 1, k: [0, 0], inputs: [2, 9] };
    // Spicy: a times rule, a two-step rule, or an adding rule run backwards.
    const form = spicy ? random.pick(['times', 'two-step', 'backwards']) : 'forwards';
    const rule = { forwards: random.pick([add, takeAway]), times, 'two-step': doublePlus, backwards: random.pick([add, takeAway]) }[form];
    const k = random.int(...rule.k);
    const inputs = [];
    while (inputs.length < 3) {
      const n = random.int(...rule.inputs);
      if (!inputs.includes(n)) inputs.push(n);
    }
    const [first, second, input] = inputs;
    const output = rule.run(input, k);
    const backwards = form === 'backwards';
    const spot = `What happens to ${first} to make ${rule.run(first, k)}? Check that it works for the next pair too.`;
    return {
      examples: [[first, rule.run(first, k)], [second, rule.run(second, k)]],
      input, output, backwards,
      rule: rule.name(k),
      text: backwards ? 'The number machine has a rule. What number went in?' : 'The number machine has a rule. What comes out?',
      answer: backwards ? input : output,
      near: backwards ? [rule.run(output, k), input + 1] : [input, output + 1],
      hints: backwards
        ? [spot, `The rule is: ${rule.name(k)}. To go backwards, ${rule.undo(k)}.`]
        : [spot, `The rule is: ${rule.name(k)}.`],
      why: backwards ? `The rule is: ${rule.name(k)}. Going backwards, ${output} came from ${input}.` : `The rule is: ${rule.name(k)}.`,
    };
  },

  /** Five numbers that follow a rule, with one missing. */
  pattern(random, spicy) {
    let numbers;
    let rule;
    const form = spicy ? random.pick(['grow', 'double', 'down']) : 'up';
    if (form === 'double') {
      const first = random.int(1, 3);
      numbers = [0, 1, 2, 3, 4].map((i) => first * 2 ** i);
      rule = 'each number is double the one before';
    } else if (form === 'grow') {
      // The jump grows by 1 each time: +1, +2, +3, +4.
      numbers = [random.int(1, 9)];
      for (let jump = 1; jump <= 4; jump++) numbers.push(numbers[jump - 1] + jump);
      rule = 'the jump gets 1 bigger each time';
    } else {
      const down = form === 'down';
      const step = down ? random.int(3, 9) : random.pick([2, 3, 4, 5, 10]);
      const first = down ? step * 4 + random.int(1, 20) : random.int(1, 10);
      numbers = [0, 1, 2, 3, 4].map((i) => first + (down ? -step : step) * i);
      rule = `it goes ${down ? 'down' : 'up'} by ${step} each time`;
    }
    // Mild hides a number near the end; spicy can hide one in the middle.
    const hidden = spicy ? random.int(1, 4) : random.int(3, 4);
    const answer = numbers[hidden];
    return {
      numbers, hidden,
      text: 'The numbers follow a rule. Which number is missing?',
      answer,
      near: [answer + 1, numbers[hidden - 1] + 1],
      hints: ['Look at how much it changes from one number to the next.', `The rule: ${rule}.`],
      why: `The rule: ${rule}.`,
    };
  },

  /** A number sentence with a box in it: 8 + □ = 15. */
  missing(random, spicy) {
    const text = 'What number goes in the box?';
    const form = spicy ? random.pick(['start', 'taken', 'times']) : 'add';
    if (form === 'add') {
      const a = random.int(2, 9);
      const answer = random.int(2, 9);
      return {
        sentence: `${a} + ${BOX} = ${a + answer}`, text, answer, near: [a + answer, answer + 1],
        hints: [`Count up from ${a} to ${a + answer}. How many steps?`, `Think: ${a + answer} take away ${a}.`],
        why: `${a} + ${answer} = ${a + answer}.`,
      };
    }
    if (form === 'times') {
      const a = random.int(2, 9);
      const answer = random.int(2, 9);
      return {
        sentence: `${a} × ${BOX} = ${a * answer}`, text, answer, near: [a * answer - a, answer + 1],
        hints: [`${a} groups of what number make ${a * answer}?`, `Count by ${a}s up to ${a * answer}. How many counts?`],
        why: `${a} × ${answer} = ${a * answer}.`,
      };
    }
    const a = random.int(4, 19);
    const c = random.int(5, 30);
    if (form === 'start') {
      // The box is the number you start with, before taking away.
      return {
        sentence: `${BOX} − ${a} = ${c}`, text, answer: a + c, near: [Math.abs(c - a) || a + c + 2, a + c + 1],
        hints: ['The box is the number you start with, before taking away.', `Put the ${a} back: ${c} + ${a}.`],
        why: `${a + c} − ${a} = ${c}.`,
      };
    }
    // The box is the part taken away.
    return {
      sentence: `${a + c} − ${BOX} = ${c}`, text, answer: a, near: [a + c + c, a + 1],
      hints: [`Something was taken from ${a + c}, and ${c} is left.`, `How far is it from ${c} up to ${a + c}?`],
      why: `${a + c} − ${a} = ${c}.`,
    };
  },

  /** Both sides have to be the same amount: 6 + 4 = 7 + □. */
  equal(random, spicy) {
    const text = 'Both sides must be the same amount. What goes in the box?';
    for (;;) {
      if (!spicy) {
        const a = random.int(2, 9);
        const b = random.int(2, 9);
        const c = random.int(2, a + b - 2);
        if (c === a || c === b) continue;
        return {
          sentence: `${a} + ${b} = ${c} + ${BOX}`, text, answer: a + b - c,
          // The usual mistake: writing the left side's total in the box.
          near: [a + b, a + b - c + 1],
          hints: ['Work out the left side first. The right side has to make the same amount.', `The left side makes ${a + b}. So ${c} + what = ${a + b}?`],
          why: `Both sides make ${a + b}: ${c} + ${a + b - c} = ${a + b}.`,
        };
      }
      if (random.int(0, 1) === 0) {
        // Two-digit numbers, but no big sum is needed: one number goes up, so the other comes down.
        const a = random.int(11, 45);
        const b = random.int(11, 45);
        const shift = random.pick([-2, -1, 1, 2]);
        return {
          sentence: `${a} + ${b} = ${a + shift} + ${BOX}`, text, answer: b - shift,
          near: [b + shift, b],
          hints: [`You don't have to add them up. Look at how ${a} changed to ${a + shift}.`, `${a + shift} is ${Math.abs(shift)} ${shift > 0 ? 'more' : 'less'} than ${a}. So the box is ${Math.abs(shift)} ${shift > 0 ? 'less' : 'more'} than ${b}.`],
          why: `${a} went ${shift > 0 ? 'up' : 'down'} by ${Math.abs(shift)}, so ${b} goes ${shift > 0 ? 'down' : 'up'} by ${Math.abs(shift)}: ${b - shift}.`,
        };
      }
      // Two times facts that make the same amount.
      const a = random.int(2, 9);
      const b = random.int(2, 9);
      const c = random.int(2, 9);
      const answer = (a * b) / c;
      if (c === a || c === b || !Number.isInteger(answer) || answer < 2 || answer > 9) continue;
      return {
        sentence: `${a} × ${b} = ${c} × ${BOX}`, text, answer,
        near: [a * b, answer + 1],
        hints: ['Work out the left side first. The right side has to make the same amount.', `The left side makes ${a * b}. So ${c} groups of what make ${a * b}?`],
        why: `Both sides make ${a * b}: ${c} × ${answer} = ${a * b}.`,
      };
    }
  },

  /** A shape made of small squares: how many squares, or how far around. */
  area(random, spicy) {
    const wide = random.int(3, spicy ? 6 : 5);
    const tall = random.int(2, spicy ? 4 : 3);
    if (!spicy) {
      return {
        wide, tall, cut: null, around: false,
        text: 'How many small squares make this shape?',
        answer: wide * tall,
        near: [wide + tall, wide * tall + wide],
        hints: ['Count one row, then count how many rows.', `${tall} rows of ${wide}.`],
        why: `${tall} rows of ${wide} make ${wide * tall}.`,
      };
    }
    if (random.int(0, 1) === 0) {
      const around = 2 * (wide + tall);
      return {
        wide, tall, cut: null, around: true,
        text: 'How far is it all the way around? Count the sides of the small squares on the outside edge.',
        answer: around,
        near: [wide * tall, wide + tall],
        hints: ['Go around the outside edge, counting one for each small side.', `Top ${wide}, right side ${tall}, bottom ${wide}, left side ${tall}.`],
        why: `${wide} + ${tall} + ${wide} + ${tall} = ${around}.`,
      };
    }
    // An L shape: a rectangle with a corner cut out.
    const cut = [random.int(1, wide - 2), random.int(1, tall - 1)];
    const answer = wide * tall - cut[0] * cut[1];
    return {
      wide, tall, cut, around: false,
      text: 'How many small squares make this shape?',
      answer,
      near: [wide * tall, answer + 1],
      hints: ['Split the shape into two rectangles, and count each one.', `A full ${wide} by ${tall} rectangle is ${wide * tall}. The missing corner is ${cut[0] * cut[1]}.`],
      why: `${wide * tall} − ${cut[0] * cut[1]} = ${answer}.`,
    };
  },

  /** A few shapes: how many sides altogether? Or, spicy: how many shapes make that many sides? */
  sides(random, spicy) {
    if (spicy && random.int(0, 1) === 0) {
      // Working backwards from the total.
      const shape = random.pick(Object.keys(SIDES));
      const count = random.int(3, 9);
      const total = SIDES[shape] * count;
      return {
        group: [{ shape, count }], backwards: true, total,
        text: `Some ${shape}s have ${total} sides in all. How many ${shape}s are there?`,
        answer: count,
        near: [SIDES[shape], count + 1],
        hints: [`One ${shape} has ${SIDES[shape]} sides.`, `Count by ${SIDES[shape]}s up to ${total}. How many counts?`],
        why: `${count} × ${SIDES[shape]} = ${total}.`,
      };
    }
    const kinds = spicy ? Object.keys(SIDES) : ['triangle', 'square'];
    const picked = random.shuffle(kinds).slice(0, spicy ? random.int(2, 3) : 2);
    const group = picked.map((shape) => ({ shape, count: random.int(1, spicy ? 3 : 2) }));
    const answer = group.reduce((sum, { shape, count }) => sum + SIDES[shape] * count, 0);
    const shapesInAll = group.reduce((sum, { count }) => sum + count, 0);
    const parts = group.map(({ shape, count }) => `${count} × ${SIDES[shape]}`);
    return {
      group, backwards: false, total: answer,
      text: 'How many sides do these shapes have in all?',
      answer,
      near: [shapesInAll, answer + 1],
      hints: [`A ${group[0].shape} has ${SIDES[group[0].shape]} sides. Count the sides of each shape, then add.`, `Add them up: ${parts.join(' + ')}.`],
      why: `${parts.join(' + ')} = ${answer}.`,
    };
  },
};

/**
 * Make today's rounds from a seed and the day number (which picks the 3
 * kinds). Returns { heats: [mild rounds, spicy rounds] }: the same kinds, in
 * the same order, at both heats.
 */
export function generate(seed, dayNumber = 0) {
  const kinds = kindsForDay(dayNumber);
  const heats = HEATS.map((_, index) => {
    const random = createRandom(seed + index);
    return kinds.map((kind) => {
      const { near, ...round } = MAKERS[kind](random, index === 1);
      return { kind, ...round, choices: choicesFor(round.answer, near) };
    });
  });
  return { heats };
}

/** The rounds of a puzzle at a level (1 mild, 2 spicy). */
export const roundsAt = (puzzle, level) => puzzle.heats[clampLevel(level) - 1];

/** The starting state: round 0, at a level (1 mild, 2 spicy). */
export function start(puzzle, level = 1) {
  return { puzzle, level: clampLevel(level), round: 0, tries: 0, status: 'playing', last: null };
}

/** Switch to the other heat. The round stays where it is. */
export function switchHeat(state, level) {
  return { ...state, level: clampLevel(level), tries: 0 };
}

/** Answer the current round with a number. A miss stays on the round (no penalty). */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const rounds = roundsAt(state.puzzle, state.level);
  const correct = answer === rounds[state.round].answer;
  const next = correct ? state.round + 1 : state.round;
  return {
    ...state,
    round: next,
    tries: correct ? 0 : state.tries + 1,
    status: next >= rounds.length ? 'won' : 'playing',
    last: { round: state.round, correct },
  };
}

/** A hint for a round: a nudge after the first miss, a stronger one after that. */
export const hint = (round, tries) => round.hints[tries >= 2 ? 1 : 0];

/** Every number a round shows or asks for (used to check the sums stay small). */
function numbersIn(round) {
  const inText = (text) => (String(text).match(/\d+/g) || []).map(Number);
  return [
    round.answer, ...round.choices,
    ...(round.lines || []).map((line) => line.total),
    ...(round.examples || []).flat(), ...(round.numbers || []),
    ...inText(round.sentence || ''), ...inText(round.text),
  ];
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  if (!Array.isArray(puzzle.heats) || puzzle.heats.length !== HEATS.length) return { ok: false, problems: ['needs a mild and a spicy set of rounds'] };
  const problems = puzzle.heats.flatMap((rounds) => verifyRounds(rounds).problems);
  const [mild, spicy] = puzzle.heats.map((rounds) => (rounds || []).map((r) => r.kind).join());
  if (mild !== spicy) problems.push('mild and spicy must have the same kinds of round');
  return { ok: problems.length === 0, problems };
}

/** Confirm one heat's rounds are valid. Returns { ok, problems }. */
function verifyRounds(rounds) {
  const problems = [];
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS_PER_DAY) return { ok: false, problems: [`needs ${ROUNDS_PER_DAY} rounds`] };
  if (new Set(rounds.map((r) => r.kind)).size !== rounds.length) problems.push('two rounds are the same kind');
  for (const round of rounds) {
    const name = round.kind;
    if (!KINDS.includes(name)) problems.push(`${name} is not a kind of round`);
    if (round.choices.length !== 3 || new Set(round.choices).size !== 3 || !round.choices.includes(round.answer)) problems.push(`${name} needs 3 different choices, one right`);
    if (!Number.isInteger(round.answer) || round.answer < 1) problems.push(`${name}: the answer must be a whole number above 0`);
    if (!round.text || round.hints?.length !== 2 || !round.why) problems.push(`${name} needs a question, two hints, and a why`);
    // The sums stay small: nothing on the screen reaches 100.
    if (numbersIn(round).some((n) => n < 0 || n > 99)) problems.push(`${name}: a number is above 99`);
    // Each kind's own sums.
    if (name === 'shapes') {
      for (const { shapes, op, total } of round.lines) {
        const [first, ...rest] = shapes.map((shape) => round.values[shape]);
        if (rest.reduce((sum, n) => (op === '+' ? sum + n : sum - n), first) !== total || total < 1) problems.push(`shapes: a line doesn't make ${total}`);
      }
      if (Object.values(round.values).some((n) => n > 9)) problems.push('shapes: a shape stands for more than 9');
      if (round.values[round.ask] !== round.answer) problems.push('shapes: the answer is not the shape asked for');
    }
    if (name === 'scale' && (round.left * round.answer + round.extra !== round.right || round.right > 12)) problems.push('scale: it does not balance, or has too many squares');
    if (name === 'machine' && (round.examples.some(([, out]) => out < 1) || round.answer !== (round.backwards ? round.input : round.output))) problems.push('machine: a number came out below 1, or the answer is wrong');
    if (name === 'pattern' && (round.numbers[round.hidden] !== round.answer || round.numbers.some((n) => n < 1) || new Set(round.numbers).size !== 5)) problems.push('pattern: the missing number is wrong, or a number repeats');
    if (name === 'missing' || name === 'equal') {
      // Put the answer in the box; both sides must come to the same amount.
      const value = (side) => {
        const [a, op, b] = side.trim().split(' ').map((piece) => (piece === BOX ? round.answer : /^\d+$/.test(piece) ? Number(piece) : piece));
        if (op === '×' && (a > 9 || b > 9)) problems.push(`${name}: a times fact goes past 9`);
        return op === undefined ? a : op === '+' ? a + b : op === '−' ? a - b : a * b;
      };
      const [left, right] = round.sentence.split('=');
      if (value(left) !== value(right)) problems.push(`${name}: the two sides are not equal`);
    }
    if (name === 'area') {
      const { wide, tall, cut, around } = round;
      const right = around ? 2 * (wide + tall) : wide * tall - (cut ? cut[0] * cut[1] : 0);
      if (right !== round.answer) problems.push('area: the count is wrong');
      if (cut && (cut[0] >= wide || cut[1] >= tall)) problems.push('area: the cut-out corner is too big');
    }
    if (name === 'sides') {
      const total = round.group.reduce((sum, { shape, count }) => sum + SIDES[shape] * count, 0);
      if (total !== round.total || round.answer !== (round.backwards ? round.group[0].count : total)) problems.push('sides: the total is wrong');
    }
  }
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/** One shape, as a picture. Each has its own color and its own outline, so it isn't color alone. */
const shapeNode = (name) => {
  const node = make('span', `mm-shape mm-${name}`);
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', name);
  return node;
};

/** A big number sentence, with its □ drawn as a dashed box. */
function sentenceNode(sentence) {
  const node = make('p', 'mm-sentence');
  sentence.split(BOX).forEach((piece, i) => {
    if (i > 0) node.append(make('span', 'mm-blank', '?'));
    node.append(piece);
  });
  node.setAttribute('aria-label', sentence.replace(BOX, 'box'));
  return node;
}

// What each kind of round draws above its three choices.
const DRAW = {
  shapes(round) {
    const lines = make('div', 'mm-lines');
    for (const { shapes, op, total } of round.lines) {
      const line = make('p', 'mm-line');
      shapes.forEach((shape, i) => line.append(i ? ` ${op} ` : '', shapeNode(shape)));
      line.append(` = ${total}`);
      lines.append(line);
    }
    const asked = make('p', 'mm-line mm-line-ask');
    asked.append(shapeNode(round.ask), ' = ?');
    lines.append(asked);
    return [lines];
  },

  scale({ left, extra, right }) {
    const scale = make('div', 'mm-scale');
    const pan = (shapes) => {
      const node = make('div', 'mm-pan');
      for (const name of shapes) node.append(shapeNode(name));
      return node;
    };
    const fill = (name, count) => Array(count).fill(name);
    scale.append(pan([...fill('triangle', left), ...fill('square', extra)]), make('span', 'mm-post'), pan(fill('square', right)));
    const leftSide = `${left} triangles${extra ? ` and ${extra === 1 ? '1 square' : `${extra} squares`}` : ''}`;
    scale.setAttribute('aria-label', `${leftSide} balance ${right} squares`);
    return [scale, make('p', 'mm-note', `${leftSide} on one side, ${right} squares on the other`)];
  },

  machine(round) {
    const table = make('div', 'mm-machine');
    const row = (input, output) => {
      const line = make('p', 'mm-run');
      const box = (value) => make('span', 'mm-box' + (value === '?' ? ' mm-box-ask' : ''), String(value));
      line.append(box(input), make('span', 'mm-arrow', '→'), box(output));
      return line;
    };
    for (const [input, output] of round.examples) table.append(row(input, output));
    table.append(round.backwards ? row('?', round.output) : row(round.input, '?'));
    return [table];
  },

  pattern({ numbers, hidden }) {
    const row = make('div', 'mm-pattern');
    numbers.forEach((n, i) => row.append(make('span', 'mm-box' + (i === hidden ? ' mm-box-ask' : ''), i === hidden ? '?' : String(n))));
    row.setAttribute('aria-label', numbers.map((n, i) => (i === hidden ? 'blank' : n)).join(', '));
    return [row];
  },

  missing: (round) => [sentenceNode(round.sentence)],
  equal: (round) => [sentenceNode(round.sentence)],

  area({ wide, tall, cut }) {
    const grid = make('div', 'mm-area');
    grid.style.setProperty('--wide', wide);
    for (let row = 0; row < tall; row++) {
      for (let column = 0; column < wide; column++) {
        // The cut-out corner (top right) of an L shape is left empty.
        const gone = cut && row < cut[1] && column >= wide - cut[0];
        grid.append(make('span', gone ? 'mm-gap' : 'mm-unit'));
      }
    }
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', cut ? `An L shape: ${wide} by ${tall} squares with a ${cut[0]} by ${cut[1]} corner missing` : `A rectangle ${wide} squares wide and ${tall} squares tall`);
    return [grid];
  },

  sides({ group, backwards, total }) {
    const row = make('div', 'mm-group');
    if (backwards) {
      // One shape as a reminder, and the total: "? of these = 24 sides".
      row.append(make('span', 'mm-box mm-box-ask', '?'), ' × ', shapeNode(group[0].shape), ` = ${total} sides`);
      return [row];
    }
    for (const { shape, count } of group) for (let i = 0; i < count; i++) row.append(shapeNode(shape));
    return [row];
  },
};

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong picks; helped is always 0.
 */
export function render(container, puzzle, onDone, session = {}) {
  // Start at the heat the player last picked (or the puzzle's level, to begin with).
  let state = start(puzzle, session.saved?.level ?? session.level ?? 1);
  let misses = 0;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round };
    misses = session.saved.misses;
  }
  const count = puzzle.heats[0].length;
  const keep = () => session.save?.({ level: state.level, round: state.round, misses });
  container.replaceChildren();
  container.classList.add('mm');

  const frame = roundFrame(container, {
    count,
    prefix: 'mm',
    draw(i) {
      const round = roundsAt(puzzle, state.level)[i];
      question.append(heatSwitch(), make('p', 'mm-ask', round.text));
      stage.append(...DRAW[round.kind](round), choiceRow(round));
    },
  });
  const { question, stage, message } = frame;

  /** The Mild / Spicy switch: peppers and a word on each side, and the picked one is marked. */
  function heatSwitch() {
    const row = make('div', 'mm-heats');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'How spicy?');
    HEATS.forEach((name, index) => {
      const level = index + 1;
      const picked = level === state.level;
      const choice = button(`mm-heat mm-heat-${level}` + (picked ? ' mm-heat-on' : ''), `${'🌶️'.repeat(level)} ${name}`, () => {
        if (level === state.level || state.status !== 'playing') return;
        state = switchHeat(state, level);
        session.setLevel?.(level); // remembered for the days after, too
        keep();
        frame.begin(state.round); // the same round, at the other heat
      });
      choice.setAttribute('aria-pressed', String(picked));
      row.append(choice);
    });
    return row;
  }

  /** The three answer buttons for a round. */
  function choiceRow(round) {
    const row = make('div', 'mm-choices');
    for (const n of round.choices) {
      const choice = button('lw-button mm-choice', String(n), () => {
        if (state.round !== roundsAt(puzzle, state.level).indexOf(round)) return;
        state = check(state, n);
        if (!state.last.correct) {
          misses += 1;
          message.textContent = `Not quite. ${hint(round, state.tries)}`;
          wiggle(choice);
          return;
        }
        choice.classList.add('grp-right');
        for (const other of row.children) other.disabled = true;
        keep();
        frame.finish(`✓ ${round.why}`, state.round, () => onDone({ status: state.status, misses, helped: 0 }));
      });
      row.append(choice);
    }
    return row;
  }

  frame.begin(state.round);
}
