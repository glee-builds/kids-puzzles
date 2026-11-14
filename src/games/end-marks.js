// end-marks.js: end each sentence with the right mark.
//
//   .  a telling sentence      ?  an asking sentence
//   !  a strong feeling (a warning, surprise, or joy)
//
// Each day has 5 rounds from data/end-marks.json:
//   1–3. One sentence each, one for each mark (in a mixed order): pick the
//        mark that ends it.
//   4.   Three sentences stuck together in lowercase with no marks: tap
//        where each sentence ends.
//   5.   Then pick the end mark for each of those three sentences.
// Higher levels keep 5 rounds but swap single sentences for new skills:
//   level 2: 2 single sentences, the stuck-together pair of rounds, then
//            capitals: tap each word that needs a capital letter.
//   level 3: 1 single sentence, the pair, capitals, then commas: tap the
//            spots in a list of three things that need a comma.
// Sentences, runs, and lists are dealt from shuffled decks, so none repeats
// until its deck is used up.

import { createRandom, dealForDay } from '../seed.js';
import { make, button, liveMessage, wiggle, roundFrame } from '../ui.js';

export const MARKS = ['.', '?', '!'];
export const MARK_NAMES = { '.': 'telling', '?': 'asking', '!': 'strong feeling' };
export const MAX_TRIES = 3; // tries at the stuck-together rounds before they're shown
// The kinds of round at each level, in order.
export const KINDS = [
  ['mark', 'mark', 'mark', 'breaks', 'marks'],
  ['mark', 'mark', 'breaks', 'marks', 'capitals'],
  ['mark', 'breaks', 'marks', 'capitals', 'commas'],
];
const kindsFor = (level = 1) => KINDS[Math.min(Math.max(level, 1), KINDS.length) - 1];

/**
 * The three sentences of a run as one line of words in lowercase, with
 * their end marks, and which words need a capital letter put back.
 */
export function uncapitalize(sentences) {
  const words = [];
  const needs = [];
  for (const sentence of sentences) {
    sentence.split(' ').forEach((word, i) => {
      const lower = i === 0 && !/^I\b/.test(word);
      if (lower) needs.push(words.length);
      words.push(lower ? word[0].toLowerCase() + word.slice(1) : word);
    });
  }
  return { words, needs };
}

/** A list sentence without its commas, and the words a comma goes after. */
export function uncomma(text) {
  const commas = [];
  const words = text.split(' ').map((word, i) => {
    if (word.endsWith(',')) commas.push(i);
    return word.replace(/,$/, '');
  });
  return { words, commas };
}

/** Split a run's sentences into lowercase words, and where each sentence ends. */
export function unpunctuate(sentences) {
  const words = [];
  const ends = [];
  sentences.forEach((sentence) => {
    const parts = sentence.replace(/[.?!]$/, '').split(' ');
    parts.forEach((word, i) => {
      // Lowercase the first word, except I (and I'm, I'll).
      words.push(i === 0 && !/^I\b/.test(word) ? word[0].toLowerCase() + word.slice(1) : word);
    });
    ends.push(words.length - 1);
  });
  return { words, ends: ends.slice(0, -1) }; // the last word always ends a sentence
}

export const markOf = (sentence) => sentence.slice(-1);

/** Problems with the data file. An empty list means it's fine. */
export function dataProblems({ sentences, runs, lists = [] }) {
  const problems = [];
  for (const { text } of lists) {
    if ((text.match(/,/g) || []).length !== 2) problems.push(`${text}: a list needs exactly 2 commas`);
    if (!/^[A-Z].*[.?!]$/.test(text)) problems.push(`${text}: needs a capital and an end mark`);
    if (!/, (and|or) /.test(text)) problems.push(`${text}: the last comma should come before "and" or "or"`);
  }
  for (const { text, mark, why } of sentences) {
    if (!MARKS.includes(mark)) problems.push(`${text}: mark ${mark}`);
    if (/[.?!]$/.test(text) || !/^[A-Z]/.test(text)) problems.push(`${text}: needs a capital and no end mark`);
    if (!why) problems.push(`${text}: no why`);
  }
  for (const run of runs) {
    const { sentences: three } = run;
    if (three.length !== 3) problems.push(`${three[0]}: a run needs 3 sentences`);
    for (const s of three) {
      if (!/^[A-Z][^.?!]*[.?!]$/.test(s)) problems.push(`${s}: one sentence, a capital, one end mark`);
      if (/,/.test(s)) problems.push(`${s}: no commas in runs`);
    }
    if (new Set(three.map(markOf)).size < 2) problems.push(`${three[0]}: a run needs two different marks`);
  }
  return problems;
}

/** Make today's 5 rounds from the data file, a day number, and the level (1 to 3). */
export function generate(seed, data, dayNumber, level = 1) {
  const random = createRandom(seed);
  const kinds = kindsFor(level);
  const singles = random.shuffle(MARKS).map((mark) => {
    const deck = data.sentences.filter((s) => s.mark === mark);
    const [pick] = dealForDay(deck, 1, dayNumber, `end-marks-${mark === '.' ? 'period' : mark === '?' ? 'question' : 'exclamation'}`);
    return { kind: 'mark', text: pick.text, mark: pick.mark, why: pick.why };
  });
  const [run] = dealForDay(data.runs, 1, dayNumber, 'end-marks-runs');
  const { words, ends } = unpunctuate(run.sentences);
  const build = {
    mark: () => singles.shift(),
    breaks: () => ({ kind: 'breaks', words, ends }),
    marks: () => ({ kind: 'marks', sentences: run.sentences.map((s) => s.slice(0, -1)), marks: run.sentences.map(markOf) }),
    capitals: () => ({ kind: 'capitals', ...uncapitalize(run.sentences) }),
    commas: () => ({ kind: 'commas', ...uncomma(dealForDay(data.lists, 1, dayNumber, 'end-marks-lists')[0].text) }),
  };
  return { level, rounds: kinds.map((kind) => build[kind]()) };
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Whether `answer` is right for `round`. */
export function isRight(round, answer) {
  if (round.kind === 'mark') return answer === round.mark;
  const sorted = () => [...answer].sort((x, y) => x - y);
  if (round.kind === 'breaks') return same(sorted(), round.ends);
  if (round.kind === 'capitals') return same(sorted(), round.needs);
  if (round.kind === 'commas') return same(sorted(), round.commas);
  return same(answer, round.marks);
}

/** The starting state: round 0, no tries yet. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/**
 * Answer the current round. A miss stays on the round; in the two
 * stuck-together rounds the third miss shows the answer and moves on.
 */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  const correct = isRight(round, answer);
  const tries = correct ? 0 : state.tries + 1;
  const shown = round.kind !== 'mark' && !correct && tries >= MAX_TRIES;
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

/** A hint after a miss. */
export function hint(round, answer) {
  if (round.kind === 'mark') {
    const tips = {
      '?': 'Does it ask something? Look at the first words.',
      '.': answer === '?' ? 'It tells something. It doesn\'t ask.' : 'It\'s calm. It just tells something.',
      '!': answer === '?' ? 'It isn\'t asking. It\'s a strong feeling!' : 'Read it with feeling. Is it calm?',
    };
    return tips[round.mark];
  }
  if (round.kind === 'breaks') {
    if (answer.some((i) => !round.ends.includes(i))) return 'One stop is in the middle of a sentence. Read it out loud.';
    return 'Two sentences are still stuck together. Where does a new idea start?';
  }
  if (round.kind === 'capitals') {
    if (answer.some((i) => !round.needs.includes(i))) return 'Only the first word of each sentence needs a capital here.';
    return 'Every sentence starts with a capital letter. Look after each end mark.';
  }
  if (round.kind === 'commas') {
    if (answer.some((i) => !round.commas.includes(i))) return 'A comma goes after a thing in the list, not anywhere else.';
    return 'Find the three things in the list. A comma goes after the first and the second.';
  }
  return 'Look at each sentence. Does it tell, ask, or show a strong feeling?';
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  const kinds = kindsFor(level);
  if (!Array.isArray(rounds) || rounds.length !== kinds.length) return { ok: false, problems: [`needs ${kinds.length} rounds`] };
  if (!same(rounds.map((r) => r.kind), kinds)) problems.push(`the rounds should be ${kinds.join(', ')}`);
  const singles = rounds.filter((r) => r.kind === 'mark').map((r) => r.mark);
  if (new Set(singles).size !== singles.length || singles.some((mark) => !MARKS.includes(mark))) problems.push('each single sentence needs a different mark');
  for (const round of rounds) {
    if (round.kind === 'breaks') {
      if (round.ends.length !== 2) problems.push('the stuck-together round should split 3 sentences');
      if (round.words.some((w, i) => i > 0 && /^[A-Z]/.test(w) && !/^I\b/.test(w))) problems.push('a capital letter gives away where a sentence starts');
    }
    if (round.kind === 'marks' && round.marks.length !== 3) problems.push('the marks round should mark 3 sentences');
    if (round.kind === 'capitals' && (round.needs.length < 2 || round.needs.some((i) => /^[A-Z]/.test(round.words[i])))) problems.push('the capitals round needs lowercase first words');
    if (round.kind === 'commas' && round.commas.length !== 2) problems.push('the commas round needs a list with 2 commas');
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many wrong answers were given, and
 * helped is how many rounds had their answer shown.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0; // wrong answers in the whole puzzle (state.tries starts over each round)
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round, shown: session.saved.shown || [] };
    misses = session.saved.misses;
  }
  const keep = () => session.save?.({ round: state.round, misses, shown: state.shown });
  container.replaceChildren();
  container.classList.add('em');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'em',
    draw(i) {
      const round = puzzle.rounds[i];
      ({ mark: drawMark, breaks: drawBreaks, marks: drawMarks, capitals: drawCapitals, commas: drawCommas })[round.kind](round);
    },
  });
  const { question, stage, message } = frame;

  const roundNumber = (round) => puzzle.rounds.indexOf(round);

  const finishRound = (text) => {
    keep();
    frame.finish(text, state.round, () => onDone({ status: state.status, misses, helped: state.shown.length }));
  };

  function answer(round, value, node) {
    if (state.round !== roundNumber(round)) return null;
    state = check(state, value);
    if (!state.last.correct) misses += 1;
    if (!state.last.correct && !state.last.shown) {
      message.textContent = `Not quite. ${hint(round, value)}`;
      if (node) wiggle(node);
    }
    return state.last;
  }

  /** A . ? ! button, with the kind of sentence written under the mark. */
  function markButton(mark, onTap, small = false) {
    const node = button(`lw-button em-mark${small ? ' em-mark-small' : ''}`, '', onTap);
    node.append(make('b', '', mark));
    if (!small) node.append(make('small', '', MARK_NAMES[mark]));
    node.setAttribute('aria-label', `${MARK_NAMES[mark]}: ${{ '.': 'period', '?': 'question mark', '!': 'exclamation mark' }[mark]}`);
    return node;
  }

  // 1–3. Pick the end mark for one sentence.
  function drawMark(round) {
    question.textContent = 'How should this sentence end?';
    const sentence = make('p', 'em-sentence', round.text);
    const end = sentence.appendChild(make('span', 'em-end', ' '));
    const row = make('div', 'em-marks');
    for (const mark of MARKS) {
      const choice = markButton(mark, () => {
        const result = answer(round, mark, choice);
        if (!result?.correct) return;
        choice.classList.add('grp-right');
        for (const other of row.children) other.disabled = true;
        end.textContent = mark;
        end.classList.add('em-end-done');
        finishRound(`✓ ${round.why}`);
      });
      row.append(choice);
    }
    stage.append(sentence, row);
  }

  /**
   * Words in a line with a spot to tap between each pair. Tapping a spot
   * puts `mark` there (or takes it away). Used for sentence ends and commas.
   */
  function drawSpots(round, { ask, right, mark, label, endsWithSpot, empty, doneRight, doneShown }) {
    question.textContent = ask;
    const chosen = new Set();
    const text = make('p', 'em-run');
    const spots = [];
    round.words.forEach((word, i) => {
      text.append(make('span', 'em-word', word));
      if (i === round.words.length - 1) {
        if (endsWithSpot) text.append(make('span', 'em-spot em-spot-on em-spot-last', mark));
        return;
      }
      const spot = button('em-spot', '');
      spot.setAttribute('aria-label', label(word));
      spot.addEventListener('click', () => {
        if (chosen.has(i)) chosen.delete(i);
        else chosen.add(i);
        spot.classList.toggle('em-spot-on', chosen.has(i));
        spot.textContent = chosen.has(i) ? mark : '';
        message.textContent = '';
      });
      text.append(spot);
      spots[i] = spot;
    });
    const checkButton = button('lw-button lw-enter em-check', 'Check', () => {
      if (chosen.size === 0) {
        message.textContent = empty;
        return;
      }
      const result = answer(round, [...chosen], text);
      if (!result || (!result.correct && !result.shown)) return;
      for (const [i, spot] of spots.entries()) {
        if (!spot) continue;
        spot.disabled = true;
        const isRightSpot = right.includes(i);
        spot.classList.toggle('em-spot-on', isRightSpot);
        spot.textContent = isRightSpot ? mark : '';
      }
      checkButton.remove();
      finishRound(result.correct ? doneRight : doneShown);
    });
    stage.append(text, checkButton);
  }

  // Tap where each sentence ends.
  function drawBreaks(round) {
    drawSpots(round, {
      ask: 'Three sentences got stuck together. Tap the spot where each one ends.',
      right: round.ends,
      mark: '|',
      label: (word) => `End a sentence after "${word}"`,
      endsWithSpot: true,
      empty: 'Tap a spot between two words to end a sentence there.',
      doneRight: '✓ Three sentences! Now each one needs its end mark.',
      doneShown: 'Here is where each sentence ends. Now each one needs its end mark.',
    });
  }

  // Level 3: tap the spots in a list that need a comma.
  function drawCommas(round) {
    drawSpots(round, {
      ask: 'This sentence has a list of three things. Tap each spot that needs a comma.',
      right: round.commas,
      mark: ',',
      label: (word) => `Put a comma after "${word}"`,
      endsWithSpot: false,
      empty: 'Tap a spot between two words to put a comma there.',
      doneRight: '✓ A comma after the first thing and the second thing!',
      doneShown: 'Here is where the commas go: after the first thing and the second.',
    });
  }

  // Level 2 and up: tap each word that needs a capital letter.
  function drawCapitals(round) {
    question.textContent = 'The capital letters are missing! Tap each word that needs one.';
    const chosen = new Set();
    const text = make('p', 'em-run em-caps');
    const capital = (word) => word[0].toUpperCase() + word.slice(1);
    const words = round.words.map((word, i) => {
      const node = button('em-cap', word);
      node.addEventListener('click', () => {
        if (chosen.has(i)) chosen.delete(i);
        else chosen.add(i);
        node.textContent = chosen.has(i) ? capital(word) : word;
        node.classList.toggle('em-cap-on', chosen.has(i));
        message.textContent = '';
      });
      text.append(node, ' ');
      return node;
    });
    const checkButton = button('lw-button lw-enter em-check', 'Check', () => {
      if (chosen.size === 0) {
        message.textContent = 'Tap a word to give it a capital letter.';
        return;
      }
      const result = answer(round, [...chosen], text);
      if (!result || (!result.correct && !result.shown)) return;
      words.forEach((node, i) => {
        node.disabled = true;
        const needs = round.needs.includes(i);
        node.textContent = needs ? capital(round.words[i]) : round.words[i];
        node.classList.toggle('em-cap-on', needs);
      });
      checkButton.remove();
      finishRound(result.correct ? '✓ Every sentence starts with a capital letter!' : 'Here are the capitals: one at the start of each sentence.');
    });
    stage.append(text, checkButton);
  }

  // 5. Pick the end mark for each of the three sentences.
  function drawMarks(round) {
    question.textContent = 'Now pick the end mark for each sentence.';
    const picked = round.sentences.map(() => null);
    const lines = round.sentences.map((sentence, k) => {
      const line = make('div', 'em-line');
      const words = make('p', 'em-line-text', sentence);
      const end = words.appendChild(make('span', 'em-end', ' '));
      const row = make('div', 'em-marks em-marks-small');
      for (const mark of MARKS) {
        const choice = markButton(mark, () => {
          picked[k] = mark;
          end.textContent = mark;
          for (const other of row.children) other.classList.toggle('em-picked', other === choice);
          line.classList.remove('em-line-right');
          message.textContent = '';
        }, true);
        row.append(choice);
      }
      line.append(words, row);
      return line;
    });
    const checkButton = button('lw-button lw-enter em-check', 'Check', () => {
      if (picked.includes(null)) {
        message.textContent = 'Pick a mark for every sentence first.';
        return;
      }
      const result = answer(round, picked, null);
      if (!result) return;
      lines.forEach((line, k) => line.classList.toggle('em-line-right', picked[k] === round.marks[k] || result.shown));
      if (!result.correct && !result.shown) return;
      lines.forEach((line, k) => {
        line.querySelector('.em-end').textContent = round.marks[k];
        [...line.querySelectorAll('button')].forEach((b, i) => {
          b.disabled = true;
          b.classList.toggle('em-picked', MARKS[i] === round.marks[k]); // show the right mark as picked
        });
      });
      checkButton.remove();
      finishRound(result.correct ? '✓ Every sentence ends with the right mark!' : 'Here are the right marks. Read them out loud!');
    });
    stage.append(...lines, checkButton);
  }

  frame.begin(state.round);
}
