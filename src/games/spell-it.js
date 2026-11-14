// spell-it.js: spell 2nd and 3rd grade words, one step harder each round.
//
// Each day has 3 words from data/spelling.json (dealt from a shuffled deck,
// so none repeats until the whole list is used), one per round:
//   1. Pick it: which spelling is right? (whale, whail, or wale)
//   2. Sound it: which letters make the sound? (tr _ _ n: ai, ay, or a_e)
//   3. Spell it: type the whole word on the letter keyboard. Letters in the
//      right place turn green; after 3 tries the word is shown.
// Every round has a sentence with a blank, and "Hear it" says the word
// with the phone's own built-in voice (no internet needed).

import { createRandom, dealForDay } from '../seed.js';
import { make, button, liveMessage, wiggle, letterKeyboard, roundFrame } from '../ui.js';

export const WORDS_PER_DAY = 3;
export const MAX_TRIES = 3; // tries to spell the whole word before it's shown

/** The words for a day number (days since a fixed start date). */
export const wordsForDay = (words, dayNumber) => dealForDay(words, WORDS_PER_DAY, dayNumber, 'spell-it');

/** True if an entry has a sound step (some patterns have no good choices). */
export const hasSound = (entry) => Array.isArray(entry.options);

/** Fill a blanked word ("tr__n") with letters ("ai"), in order. */
export function fill(blanked, letters) {
  let i = 0;
  return blanked.replace(/_/g, () => letters[i++] ?? '_');
}

/** Problems with one entry of the list. An empty list means it's fine. */
export function entryProblems(entry) {
  const problems = [];
  const { word, sentence, misspellings, blanked, answer, options, correct } = entry;
  if (!/^[a-z]+$/.test(word || '')) problems.push('word must be lowercase letters');
  if ((sentence.match(/___/g) || []).length !== 1) problems.push('sentence needs exactly one ___');
  if (!/^[A-Z].*[.!?]$/.test(sentence.replace('___', 'x'))) problems.push('sentence needs a capital and an end mark');
  if (!Array.isArray(misspellings) || misspellings.length !== 2 || new Set([word, ...misspellings]).size !== 3) {
    problems.push('needs 2 different misspellings');
  }
  if (hasSound(entry)) {
    if ((blanked.match(/_/g) || []).length !== answer.length) problems.push('blanks and answer letters differ');
    if (fill(blanked, answer) !== word) problems.push(`${blanked} + ${answer} doesn't spell ${word}`);
    if (options.length < 2 || options.length > 3 || new Set(options).size !== options.length) problems.push('needs 2 or 3 different sound choices');
    if (!options.includes(correct) || correct.replace(/_/g, '') !== answer) problems.push('the correct sound choice is wrong');
  }
  return problems.map((p) => `${word}: ${p}`);
}

/**
 * Make today's 3 rounds. A word with a sound step goes in the middle round;
 * if none of today's words has one, that round is a second "spell it".
 */
export function generate(seed, words, dayNumber) {
  const random = createRandom(seed);
  const today = wordsForDay(words, dayNumber);
  const soundWord = today.find(hasSound);
  const others = today.filter((w) => w !== soundWord);
  const plan = soundWord
    ? [['pick', others[0]], ['sound', soundWord], ['spell', others[1]]]
    : [['pick', today[0]], ['spell', today[1]], ['spell', today[2]]];
  return {
    rounds: plan.map(([kind, entry]) => ({
      kind,
      word: entry.word,
      sentence: entry.sentence,
      why: entry.why,
      ...(kind === 'pick' && { choices: random.shuffle([entry.word, ...entry.misspellings]) }),
      ...(kind === 'sound' && { blanked: entry.blanked, options: random.shuffle(entry.options), correct: entry.correct }),
    })),
  };
}

/** The starting state: round 0, no tries yet. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/**
 * Answer the current round: a spelling (pick), a sound choice (sound), or
 * the typed word (spell). A miss stays on the round, except that the third
 * miss in a spell round shows the word and moves on.
 * state.last: { round, correct, shown, marks } (marks: per letter, true if
 * that letter is in the right place; spell rounds only).
 */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  const right = round.kind === 'sound' ? round.correct : round.word;
  const correct = answer === right;
  const tries = correct ? 0 : state.tries + 1;
  const shown = round.kind === 'spell' && !correct && tries >= MAX_TRIES;
  const next = correct || shown ? state.round + 1 : state.round;
  const marks = round.kind === 'spell' ? [...round.word].map((ch, i) => answer[i] === ch) : null;
  return {
    ...state,
    round: next,
    tries: next === state.round ? tries : 0,
    shown: shown ? [...state.shown, state.round] : state.shown,
    status: next >= state.puzzle.rounds.length ? 'won' : 'playing',
    last: { round: state.round, correct, shown, marks },
  };
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds } = puzzle;
  if (!Array.isArray(rounds) || rounds.length !== WORDS_PER_DAY) return { ok: false, problems: ['needs 3 rounds'] };
  if (rounds[0].kind !== 'pick') problems.push('the first round should be pick');
  if (new Set(rounds.map((r) => r.word)).size !== rounds.length) problems.push('a word repeats');
  for (const round of rounds) {
    if (round.kind === 'pick' && (round.choices.length !== 3 || !round.choices.includes(round.word))) problems.push(`${round.word}: pick needs the word and 2 others`);
    if (round.kind === 'sound' && fill(round.blanked, round.correct.replace(/_/g, '')) !== round.word) problems.push(`${round.word}: sound step doesn't spell the word`);
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

/** Say `text` with the phone's built-in voice, if it has one. */
function say(text) {
  try {
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-US';
    speech.rate = 0.8;
    window.speechSynthesis.speak(speech);
  } catch { /* no voice on this phone: the sentence still helps */ }
}
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** A sentence with its blank shown as a line (or filled with `word`). */
function sentenceLine(sentence, word) {
  const [before, after] = sentence.split('___');
  const node = make('p', 'sp-sentence');
  const blank = make('span', word ? 'sp-filled' : 'sp-blank', word || ' ');
  node.append(before, blank, after);
  return node;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many wrong answers were given, and
 * helped is how many words were shown after 3 tries.
 */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let misses = 0; // wrong answers in the whole puzzle (state.tries starts over each round)
  container.replaceChildren();
  container.classList.add('sp');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'sp',
    draw(i) {
      const round = puzzle.rounds[i];
      ({ pick: drawPick, sound: drawSound, spell: drawSpell })[round.kind](round);
    },
  });
  const { question, stage, message } = frame;

  function hearButton(round) {
    if (!canSpeak()) return make('span');
    // The word, the sentence with the word in it, then the word again, like
    // a spelling test.
    const full = round.sentence.replace('___', round.word);
    return button('lw-button sp-hear', '🔊 Hear it', () => say(`${round.word}. ${full} ${round.word}.`));
  }

  const finishRound = (text) => frame.finish(text, state.round, () => onDone({ status: state.status, misses, helped: state.shown.length }));

  /** Choice buttons; `label` turns a choice into its text. */
  function choiceRow(round, values, label, onRight, wrongHint) {
    const row = make('div', 'sp-choices');
    for (const value of values) {
      const choice = button('lw-button sp-choice', label(value), () => {
        if (state.round !== puzzle.rounds.indexOf(round)) return;
        state = check(state, value);
        if (!state.last.correct) {
          misses += 1;
          message.textContent = `Not quite. ${wrongHint(value)}`;
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

  // 1. Which spelling is right?
  function drawPick(round) {
    question.textContent = 'Which spelling is right?';
    const sentence = sentenceLine(round.sentence);
    stage.append(sentence, hearButton(round), choiceRow(round, round.choices, (w) => w, () => {
      sentence.replaceWith(sentenceLine(round.sentence, round.word));
      finishRound(`✓ ${round.word}! ${round.why}`);
    }, () => 'Say it slowly. Which one looks right?'));
  }

  // 2. Which letters make the sound?
  function drawSound(round) {
    question.textContent = 'Which letters make the missing sound?';
    const shape = make('p', 'sp-shape', round.blanked.replace(/_/g, ' _ ').replace(/ {2}/g, ' ').trim());
    const sentence = sentenceLine(round.sentence);
    const label = (option) => option.replace('_', '…'); // a_e shows as a…e
    stage.append(sentence, shape, hearButton(round), choiceRow(round, round.options, label, () => {
      shape.textContent = round.word;
      shape.classList.add('sp-shape-done');
      sentence.replaceWith(sentenceLine(round.sentence, round.word));
      finishRound(`✓ ${round.why}`);
    }, (option) => `${label(option)} makes that sound in other words, but not in this one.`));
  }

  // 3. Spell the whole word.
  function drawSpell(round) {
    question.textContent = 'Spell the word.';
    let typed = '';
    const sentence = sentenceLine(round.sentence);
    const boxes = make('div', 'sp-boxes');
    const cells = [...round.word].map(() => boxes.appendChild(make('span', 'sp-box')));
    const drawBoxes = (marks) => cells.forEach((cell, i) => {
      cell.textContent = typed[i] || '';
      cell.classList.toggle('sp-box-right', Boolean(marks?.[i]));
    });

    const type = (letter) => {
      if (typed.length >= round.word.length) return;
      typed += letter;
      message.textContent = '';
      drawBoxes();
    };
    const erase = () => { typed = typed.slice(0, -1); drawBoxes(); };
    const submit = () => {
      if (state.round !== puzzle.rounds.indexOf(round)) return;
      if (typed.length < round.word.length) {
        message.textContent = `Type ${round.word.length} letters, then press Go.`;
        return;
      }
      state = check(state, typed);
      const { correct, shown, marks } = state.last;
      if (!correct) misses += 1;
      if (correct || shown) {
        typed = round.word;
        drawBoxes(round.word.split('').map(() => correct));
        keyboard.remove();
        stopKeys();
        sentence.replaceWith(sentenceLine(round.sentence, round.word));
        finishRound(correct ? `✓ You spelled ${round.word}!` : `The word is ${round.word}. ${round.why}`);
        return;
      }
      // Keep the right letters at the start, clear the rest to try again.
      let keep = 0;
      while (keep < marks.length && marks[keep]) keep++;
      typed = typed.slice(0, keep);
      drawBoxes(marks.map((_, i) => i < keep));
      wiggle(boxes);
      message.textContent = keep > 0
        ? 'The green letters are right. Type the rest again!'
        : `Not quite. Listen again, and say it slowly. ${state.tries === MAX_TRIES - 1 ? round.why : ''}`.trim();
    };
    const { node: keyboard, stop: stopKeys } = letterKeyboard(container, { onLetter: type, onErase: erase, onGo: submit }, 'sp-keyboard');
    stage.append(sentence, hearButton(round), boxes, keyboard);
  }

  frame.begin(0);
}
