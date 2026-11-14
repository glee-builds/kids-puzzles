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
// Sentences and runs are dealt from shuffled decks, so none repeats until
// its deck is used up (60 days).

import { createRandom, dealForDay } from '../seed.js';
import { make, button, liveMessage, wiggle, roundFrame } from '../ui.js';

export const MARKS = ['.', '?', '!'];
export const MARK_NAMES = { '.': 'telling', '?': 'asking', '!': 'strong feeling' };
export const MAX_TRIES = 3; // tries at the stuck-together rounds before they're shown

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
export function dataProblems({ sentences, runs }) {
  const problems = [];
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

/** Make today's 5 rounds from the data file and a day number. */
export function generate(seed, data, dayNumber) {
  const random = createRandom(seed);
  const singles = random.shuffle(MARKS).map((mark) => {
    const deck = data.sentences.filter((s) => s.mark === mark);
    const [pick] = dealForDay(deck, 1, dayNumber, `end-marks-${mark === '.' ? 'period' : mark === '?' ? 'question' : 'exclamation'}`);
    return { kind: 'mark', text: pick.text, mark: pick.mark, why: pick.why };
  });
  const [run] = dealForDay(data.runs, 1, dayNumber, 'end-marks-runs');
  const { words, ends } = unpunctuate(run.sentences);
  return {
    rounds: [
      ...singles,
      { kind: 'breaks', words, ends },
      { kind: 'marks', sentences: run.sentences.map((s) => s.slice(0, -1)), marks: run.sentences.map(markOf) },
    ],
  };
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Whether `answer` is right for `round`. */
export function isRight(round, answer) {
  if (round.kind === 'mark') return answer === round.mark;
  if (round.kind === 'breaks') return same([...answer].sort((x, y) => x - y), round.ends);
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
  return 'Look at each sentence. Does it tell, ask, or show a strong feeling?';
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds } = puzzle;
  if (!Array.isArray(rounds) || rounds.length !== 5) return { ok: false, problems: ['needs 5 rounds'] };
  const singles = rounds.slice(0, 3);
  if (!singles.every((r) => r.kind === 'mark')) problems.push('rounds 1 to 3 should be single sentences');
  if (!same(singles.map((r) => r.mark).sort(), [...MARKS].sort())) problems.push('needs one of each mark');
  const [breaks, marks] = rounds.slice(3);
  if (breaks.kind !== 'breaks' || breaks.ends.length !== 2) problems.push('round 4 should split 3 sentences');
  if (breaks.words.some((w, i) => i > 0 && /^[A-Z]/.test(w) && !/^I\b/.test(w))) problems.push('a capital letter gives away where a sentence starts');
  if (marks.kind !== 'marks' || marks.marks.length !== 3) problems.push('round 5 should mark 3 sentences');
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  container.replaceChildren();
  container.classList.add('em');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'em',
    draw(i) {
      const round = puzzle.rounds[i];
      ({ mark: drawMark, breaks: drawBreaks, marks: drawMarks })[round.kind](round);
    },
  });
  const { question, stage, message } = frame;

  const roundNumber = (round) => puzzle.rounds.indexOf(round);

  const finishRound = (text) => frame.finish(text, state.round, () => onDone({ status: state.status }));

  function answer(round, value, node) {
    if (state.round !== roundNumber(round)) return null;
    state = check(state, value);
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

  // 4. Tap where each sentence ends.
  function drawBreaks(round) {
    question.textContent = 'Three sentences got stuck together. Tap the spot where each one ends.';
    const chosen = new Set();
    const text = make('p', 'em-run');
    const spots = [];
    round.words.forEach((word, i) => {
      text.append(make('span', 'em-word', word));
      if (i === round.words.length - 1) {
        text.append(make('span', 'em-spot em-spot-on em-spot-last', '|'));
        return;
      }
      const spot = button('em-spot', '');
      spot.setAttribute('aria-label', `End a sentence after "${word}"`);
      spot.addEventListener('click', () => {
        if (chosen.has(i)) chosen.delete(i);
        else chosen.add(i);
        spot.classList.toggle('em-spot-on', chosen.has(i));
        spot.textContent = chosen.has(i) ? '|' : '';
        message.textContent = '';
      });
      text.append(spot);
      spots[i] = spot;
    });
    const checkButton = button('lw-button lw-enter em-check', 'Check', () => {
      if (chosen.size === 0) {
        message.textContent = 'Tap a spot between two words to end a sentence there.';
        return;
      }
      const result = answer(round, [...chosen], text);
      if (!result || (!result.correct && !result.shown)) return;
      for (const [i, spot] of spots.entries()) {
        if (!spot) continue;
        spot.disabled = true;
        const isEnd = round.ends.includes(i);
        spot.classList.toggle('em-spot-on', isEnd);
        spot.textContent = isEnd ? '|' : '';
      }
      checkButton.remove();
      finishRound(result.correct ? '✓ Three sentences! Now each one needs its end mark.' : 'Here is where each sentence ends. Now each one needs its end mark.');
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

  frame.begin(0);
}
