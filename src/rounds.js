// rounds.js: the rule several round-by-round puzzles share (Coin Count,
// End Marks, Graph It, Spell It) for moving through their rounds.

/**
 * After an answer: a right answer moves on to the next round. A miss stays
 * on the round, unless `canShow` and this is the third miss in a row
 * (`maxTries`): then the answer is shown and the puzzle moves on.
 * Returns the new state; state.last is { round, correct, shown, ...extra }.
 */
export function nextRound(state, correct, { canShow = true, maxTries = 3, extra = {} } = {}) {
  const tries = correct ? 0 : state.tries + 1;
  const shown = canShow && !correct && tries >= maxTries;
  const next = correct || shown ? state.round + 1 : state.round;
  return {
    ...state,
    round: next,
    tries: next === state.round ? tries : 0,
    shown: shown ? [...state.shown, state.round] : state.shown,
    status: next >= state.puzzle.rounds.length ? 'won' : 'playing',
    last: { round: state.round, correct, shown, ...extra },
  };
}
