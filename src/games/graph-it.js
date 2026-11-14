// graph-it.js: reading graphs, and making them.
//
// Each day has 4 rounds:
//   1. Read it: a bar graph (or, from level 2, a picture graph where each
//      picture stands for 2, 5, or 10) and a question about it.
//   2. Build it: a short story problem; the player makes the bar graph
//      that shows it, with + and − under each bar.
//   3. Line graph: a plant's height over five days, and a question.
//   4. Find the spot: "across 4, up 2" on a grid.
// Levels: level 1 reads one number straight off the graph; level 2 compares
// and adds, and the story has to be worked out ("2 more ducks than
// frogs"); level 3 counts by 2s on the side of the graph and has two steps.

import { createRandom } from '../seed.js';
import { choicesFor } from '../times.js';
import { make, button, wiggle, roundFrame } from '../ui.js';

export const ROUNDS = ['read', 'build', 'line', 'spot'];
export const MAX_TRIES = 3; // tries at building a graph before it's shown
const clampLevel = (level = 1) => Math.min(Math.max(level, 1), 3);

// What the graphs are about: a title and four things to count.
export const THEMES = [
  { title: 'Animals at the pond', things: ['frogs', 'ducks', 'fish', 'turtles'] },
  { title: 'Fruit in the bowl', things: ['apples', 'pears', 'plums', 'limes'] },
  { title: 'Bugs in the garden', things: ['ants', 'bees', 'moths', 'snails'] },
  { title: 'Toys in the box', things: ['balls', 'blocks', 'cars', 'kites'] },
  { title: 'Birds at the feeder', things: ['robins', 'wrens', 'crows', 'doves'] },
  { title: 'Shapes on the page', things: ['circles', 'squares', 'stars', 'hearts'] },
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** `count` different whole numbers from `low` to `high`, each a multiple of `step`. */
function differentNumbers(random, count, low, high, step = 1) {
  const picked = [];
  while (picked.length < count) {
    const n = random.int(Math.ceil(low / step), Math.floor(high / step)) * step;
    if (!picked.includes(n)) picked.push(n);
  }
  return picked;
}

/** A question about a list of numbers with names: one value, a difference, or a sum. */
function ask(random, level, names, values) {
  const [a, b] = random.shuffle(names.map((_, i) => i)).slice(0, 2);
  const [big, small] = values[a] >= values[b] ? [a, b] : [b, a];
  const kinds = [['one'], ['more', 'both'], ['more', 'both', 'all']][level - 1];
  const asks = random.pick(kinds);
  if (asks === 'one') {
    return { asks, text: `How many ${names[a]}?`, answer: values[a], near: [values[b], values[a] + 1] };
  }
  if (asks === 'more') {
    return {
      asks,
      text: `How many more ${names[big]} than ${names[small]}?`,
      answer: values[big] - values[small],
      near: [values[big], values[big] + values[small]],
    };
  }
  if (asks === 'both') {
    return {
      asks,
      text: `How many ${names[a]} and ${names[b]} are there together?`,
      answer: values[a] + values[b],
      near: [values[big] - values[small] || values[big], values[big]],
    };
  }
  const total = values.reduce((sum, n) => sum + n, 0);
  return { asks, text: 'How many are there in all?', answer: total, near: [total - values[a], total + 2] };
}

/** Round 1: a bar graph, or (from level 2) a picture graph with a key. */
function readRound(random, level, theme) {
  const names = theme.things.slice(0, level === 1 ? 3 : 4);
  const pictures = level >= 2 && random.int(0, 1) === 1;
  if (pictures) {
    const each = random.pick(level === 2 ? [2, 5] : [5, 10]);
    const counts = differentNumbers(random, names.length, 1, 5);
    const question = ask(random, level, names, counts.map((n) => n * each));
    return { kind: 'read', graph: 'pictures', title: theme.title, names, counts, each, ...question, choices: choicesFor(question.answer, [counts[0], ...question.near]) };
  }
  const step = level === 3 ? 2 : 1;
  const values = differentNumbers(random, names.length, step, level === 3 ? 20 : 10, step);
  const question = ask(random, level, names, values);
  return { kind: 'read', graph: 'bars', title: theme.title, names, values, step, ...question, choices: choicesFor(question.answer, question.near) };
}

/** Round 2: a story; the player builds its bar graph. */
function buildRound(random, level, theme) {
  const [x, y, z] = random.shuffle(theme.things).slice(0, 3);
  const step = level === 3 ? 2 : 1;
  const top = level === 3 ? 16 : 9;
  let values;
  let story;
  if (level === 1) {
    values = differentNumbers(random, 3, 1, top);
    story = `There are ${values[0]} ${x}, ${values[1]} ${y}, and ${values[2]} ${z}.`;
  } else {
    // The second and third numbers have to be worked out from the first.
    const first = random.int(3, 6) * step;
    const more = random.int(1, 3) * step;
    const fewer = random.int(1, 2) * step;
    values = [first, first + more, first - fewer];
    story = `There are ${first} ${x}. There are ${more} more ${y} than ${x}. There are ${fewer} fewer ${z} than ${x}.`;
  }
  return { kind: 'build', title: theme.title, names: [x, y, z], values, step, max: (level === 3 ? 10 : 10) * step, story };
}

/** Round 3: a line graph of a plant growing over five days. */
function lineRound(random, level) {
  const step = level === 3 ? 2 : 1;
  const values = [random.int(1, 2) * step];
  for (let day = 1; day < DAYS.length; day++) values.push(values[day - 1] + random.int(day === 2 ? 0 : 1, 3) * step);
  const max = Math.ceil(values[4] / (step * 2)) * step * 2;
  const day = random.int(1, 4);
  if (level === 1) {
    return { kind: 'line', values, step, max, text: `How tall was the plant on ${DAYS[day]}?`, answer: values[day], choices: choicesFor(values[day], [values[day - 1], values[day] + step]) };
  }
  const from = random.int(0, 2);
  const to = random.int(from + 2, 4);
  const grew = values[to] - values[from];
  return {
    kind: 'line', values, step, max,
    text: `How much did the plant grow from ${DAYS[from]} to ${DAYS[to]}?`,
    answer: grew,
    choices: choicesFor(grew, [values[to], grew + step]),
  };
}

/** Round 4: a spot on a grid, named by how far across and how far up. */
function spotRound(random, level) {
  const [wide, tall] = level === 1 ? [5, 4] : [6, 5];
  let across;
  let up;
  do {
    across = random.int(1, wide);
    up = random.int(1, tall);
  } while (across === up || (level === 3 && (across < 2 || up < 2)));
  if (level < 3) return { kind: 'spot', wide, tall, across, up, text: `The frog is at across ${across}, up ${up}. Tap its spot.` };
  // Level 3: a hop from a starting spot.
  const startAcross = random.int(1, across - 1);
  const startUp = random.int(1, up - 1);
  return {
    kind: 'spot', wide, tall, across, up, from: [startAcross, startUp],
    text: `The frog starts on the dot. It hops ${across - startAcross} across and ${up - startUp} up. Tap where it lands.`,
  };
}

/** Make today's 4 rounds from a seed and a level (1 to 3). */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const at = clampLevel(level);
  const [readTheme, buildTheme] = random.shuffle(THEMES);
  return { level: at, rounds: [readRound(random, at, readTheme), buildRound(random, at, buildTheme), lineRound(random, at), spotRound(random, at)] };
}

const same = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);

/** Whether `answer` is right for `round`: a number, the bars' heights, or [across, up]. */
export function isRight(round, answer) {
  if (round.kind === 'build') return same(answer, round.values);
  if (round.kind === 'spot') return same(answer, [round.across, round.up]);
  return answer === round.answer;
}

/** The starting state: round 0. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/** Answer the current round. A miss stays on it; the third miss at building a graph shows it. */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  const correct = isRight(round, answer);
  const tries = correct ? 0 : state.tries + 1;
  const shown = round.kind === 'build' && !correct && tries >= MAX_TRIES;
  const next = correct || shown ? state.round + 1 : state.round;
  return {
    ...state,
    round: next,
    tries: next === state.round ? tries : 0,
    shown: shown ? [...state.shown, state.round] : state.shown,
    status: next >= state.puzzle.rounds.length ? 'won' : 'playing',
    last: { round: state.round, correct, shown },
  };
}

/** A hint after a miss, about what was answered. */
export function hint(round, answer) {
  if (round.kind === 'spot') {
    if (same(answer, [round.up, round.across])) return `That is across ${round.up}, up ${round.across}. Go across first, then up!`;
    return round.from ? 'Start on the dot. Count the hops across first, then the hops up.' : `Count across ${round.across} first, then up ${round.up}.`;
  }
  if (round.kind === 'build') {
    const wrong = round.names.filter((_, i) => answer[i] !== round.values[i]);
    return `Read the story again. Look at the ${wrong.join(' and the ')}.`;
  }
  if (round.kind === 'line') {
    return /grow/.test(round.text) ? 'Find the height on each of the two days. How much taller did it get?' : 'Find the day along the bottom, go up to the dot, then read across to the number.';
  }
  if (round.graph === 'pictures') return `Each picture stands for ${round.each}. Count by ${round.each}s.`;
  return {
    one: 'Find its bar. Read the number its top lines up with.',
    more: '"How many more" means find the difference between the two bars.',
    both: 'Read both bars, then add them together.',
    all: 'Read every bar, then add them all up.',
  }[round.asks];
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds } = puzzle;
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS.length) return { ok: false, problems: ['needs 4 rounds'] };
  rounds.forEach((round, i) => { if (round.kind !== ROUNDS[i]) problems.push(`round ${i + 1} should be ${ROUNDS[i]}`); });
  const [read, build, line, spot] = rounds;
  for (const round of [read, line]) {
    if (round.choices.length !== 3 || new Set(round.choices).size !== 3 || !round.choices.includes(round.answer)) problems.push(`${round.kind} needs 3 different choices, one right`);
    if (!Number.isInteger(round.answer) || round.answer < 0) problems.push(`${round.kind}: the answer must be a whole number`);
  }
  const shownValues = read.graph === 'pictures' ? read.counts.map((n) => n * read.each) : read.values;
  if (new Set(shownValues).size !== shownValues.length) problems.push('read: two bars are the same height');
  if (read.graph === 'bars' && read.values.some((n) => n % read.step !== 0 || n < 1)) problems.push('read: a bar is between the lines');
  if (build.values.some((n) => n < 1 || n > build.max || n % build.step !== 0)) problems.push('build: a bar would be off the graph');
  if (new Set(build.names).size !== 3) problems.push('build: the three things must be different');
  if (line.values.some((n, i) => (i > 0 && n < line.values[i - 1]) || n > line.max || n % line.step !== 0)) problems.push('line: the plant must grow, on the lines, and stay on the graph');
  if (spot.across < 1 || spot.across > spot.wide || spot.up < 1 || spot.up > spot.tall || spot.across === spot.up) problems.push('spot: off the grid, or the same across and up');
  if (spot.from && (spot.from[0] > spot.across || spot.from[1] > spot.up || same(spot.from, [spot.across, spot.up]))) problems.push('spot: the hop must go across or up');
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

const SVG = 'http://www.w3.org/2000/svg';
function shape(tag, attributes, text) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * A bar graph: numbers up the side, a bar for each name. Returns its node
 * and setValues(values) to change the bars' heights.
 */
function barGraph({ title, names, values, step, max }) {
  const node = make('div', 'gi-graph');
  node.append(make('p', 'gi-title', title));
  const plot = make('div', 'gi-plot');
  plot.style.setProperty('--lines', max / step);
  const side = make('div', 'gi-side');
  for (let n = max; n >= 0; n -= step) side.append(make('span', 'gi-tick', String(n)));
  const bars = make('div', 'gi-bars');
  const barNodes = names.map((name, i) => {
    const column = make('div', 'gi-column');
    const bar = make('span', `gi-bar gi-bar-${i}`);
    column.append(bar);
    bars.append(column);
    return bar;
  });
  plot.append(side, bars);
  const labels = make('div', 'gi-labels');
  for (const name of names) labels.append(make('span', 'gi-label', name));
  node.append(plot, labels);
  const setValues = (next) => {
    next.forEach((value, i) => { barNodes[i].style.height = `${(value / max) * 100}%`; });
    node.setAttribute('aria-label', `${title}. ${names.map((name, i) => `${name}: ${next[i]}`).join(', ')}.`);
  };
  setValues(values);
  return { node, setValues };
}

/** A picture graph: a row of pictures for each name, and a key. */
function pictureGraph({ title, names, counts, each }) {
  const node = make('div', 'gi-graph');
  node.append(make('p', 'gi-title', title));
  names.forEach((name, i) => {
    const row = make('div', 'gi-row');
    row.append(make('span', 'gi-row-name', name));
    for (let k = 0; k < counts[i]; k++) row.append(make('span', 'gi-picture'));
    node.append(row);
  });
  const key = make('p', 'gi-key');
  key.append(make('span', 'gi-picture'), ` = ${each}`);
  node.append(key);
  node.setAttribute('aria-label', `${title}. Each picture stands for ${each}. ${names.map((name, i) => `${name}: ${counts[i]} pictures`).join(', ')}.`);
  return node;
}

/** A line graph of five days, drawn in a 220 by 150 box. */
function lineGraph({ values, step, max }) {
  const [left, top, width, height] = [30, 10, 180, 110];
  const x = (i) => left + (i / (values.length - 1)) * width;
  const y = (n) => top + height - (n / max) * height;
  const svg = shape('svg', { viewBox: '0 0 220 150', class: 'gi-line', role: 'img', 'aria-label': `A line graph of a plant's height. ${values.map((n, i) => `${DAYS[i]}: ${n}`).join(', ')}.` });
  for (let n = 0; n <= max; n += step) {
    svg.append(shape('line', { x1: left, y1: y(n), x2: left + width, y2: y(n), class: 'gi-grid' }));
    if (n % (step * (max / step > 8 ? 2 : 1)) === 0) svg.append(shape('text', { x: left - 6, y: y(n), class: 'gi-axis gi-axis-side' }, String(n)));
  }
  values.forEach((_, i) => {
    svg.append(shape('line', { x1: x(i), y1: top, x2: x(i), y2: top + height, class: 'gi-grid' }));
    svg.append(shape('text', { x: x(i), y: top + height + 14, class: 'gi-axis' }, DAYS[i]));
  });
  svg.append(shape('polyline', { points: values.map((n, i) => `${x(i)},${y(n)}`).join(' '), class: 'gi-path' }));
  values.forEach((n, i) => svg.append(shape('circle', { cx: x(i), cy: y(n), r: 4, class: 'gi-dot' })));
  return svg;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong answers; helped is the graphs
 * that were shown after 3 tries.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round, shown: session.saved.shown || [] };
    misses = session.saved.misses;
  }
  container.replaceChildren();
  container.classList.add('gi');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'gi',
    draw(i) {
      const round = puzzle.rounds[i];
      ({ read: drawRead, build: drawBuild, line: drawLine, spot: drawSpot })[round.kind](round);
    },
  });
  const { question, stage, message } = frame;

  function finishRound(text) {
    session.save?.({ round: state.round, misses, shown: state.shown });
    frame.finish(text, state.round, () => onDone({ status: state.status, misses, helped: state.shown.length }));
  }

  /** Try an answer. Returns what happened: { correct, shown }, or null if this round is over. */
  function answer(round, value, node) {
    if (state.round !== puzzle.rounds.indexOf(round)) return null;
    state = check(state, value);
    if (!state.last.correct) misses += 1;
    if (!state.last.correct && !state.last.shown) {
      message.textContent = `Not quite. ${hint(round, value)}`;
      if (node) wiggle(node);
    }
    return state.last;
  }

  /** Three number buttons under a graph. */
  function choiceRow(round, done) {
    const row = make('div', 'gi-choices');
    for (const n of round.choices) {
      const choice = button('lw-button gi-choice', String(n), () => {
        if (!answer(round, n, choice)?.correct) return;
        choice.classList.add('grp-right');
        for (const other of row.children) other.disabled = true;
        finishRound(done);
      });
      row.append(choice);
    }
    return row;
  }

  // 1. Read a bar graph or a picture graph.
  function drawRead(round) {
    question.append(make('p', 'gi-ask', round.text));
    const graph = round.graph === 'pictures'
      ? pictureGraph(round)
      : barGraph({ ...round, max: Math.ceil(Math.max(...round.values) / (round.step * 2)) * round.step * 2 }).node;
    stage.append(graph, choiceRow(round, `✓ ${round.answer} is right!`));
  }

  // 2. Build the bar graph that shows a story.
  function drawBuild(round) {
    question.append(make('p', 'gi-ask gi-story', round.story), make('p', 'gi-do', 'Make the graph show it.'));
    const heights = round.names.map(() => 0);
    const graph = barGraph({ title: round.title, names: round.names, values: heights, step: round.step, max: round.max });
    const controls = make('div', 'gi-steppers');
    round.names.forEach((name, i) => {
      const change = (by) => {
        heights[i] = Math.min(round.max, Math.max(0, heights[i] + by));
        graph.setValues(heights);
        message.textContent = '';
      };
      const less = button('lw-button gi-step', '−', () => change(-round.step));
      const more = button('lw-button gi-step', '+', () => change(round.step));
      less.setAttribute('aria-label', `Fewer ${name}`);
      more.setAttribute('aria-label', `More ${name}`);
      const pair = make('div', 'gi-stepper');
      pair.append(less, more);
      controls.append(pair);
    });
    const checkButton = button('lw-button lw-enter gi-check', 'Check', () => {
      const result = answer(round, [...heights], graph.node);
      if (!result || (!result.correct && !result.shown)) return;
      graph.setValues(round.values);
      controls.remove();
      checkButton.remove();
      finishRound(result.correct ? '✓ Your graph shows the story!' : 'Here is the graph for the story. Check each bar against it.');
    });
    stage.append(graph.node, controls, checkButton);
  }

  // 3. Read a line graph.
  function drawLine(round) {
    question.append(make('p', 'gi-ask', round.text));
    stage.append(make('p', 'gi-title', 'How tall the plant is'), lineGraph(round), choiceRow(round, `✓ ${round.answer} is right!`));
  }

  // 4. Tap a spot on a grid.
  function drawSpot(round) {
    question.append(make('p', 'gi-ask', round.text));
    const grid = make('div', 'gi-grid-spots');
    grid.style.setProperty('--wide', round.wide + 1);
    for (let up = round.tall; up >= 0; up--) {
      for (let across = 0; across <= round.wide; across++) {
        if (up === 0 || across === 0) {
          // The numbers along the bottom and up the side.
          grid.append(make('span', 'gi-number', up === 0 && across === 0 ? '' : String(up || across)));
          continue;
        }
        const spot = button('gi-spot', '');
        spot.dataset.across = across;
        spot.dataset.up = up;
        spot.setAttribute('aria-label', `Across ${across}, up ${up}`);
        if (round.from && round.from[0] === across && round.from[1] === up) spot.classList.add('gi-spot-from');
        spot.addEventListener('click', () => {
          if (!answer(round, [across, up], spot)?.correct) return;
          spot.classList.add('gi-spot-right');
          for (const other of grid.querySelectorAll('button')) other.disabled = true;
          finishRound(`✓ Across ${round.across}, then up ${round.up}!`);
        });
        grid.append(spot);
      }
    }
    stage.append(grid);
  }

  frame.begin(state.round);
}
