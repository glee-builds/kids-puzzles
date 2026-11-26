// memory-match.js: turn over two cards at a time to find the pairs.
//
// The cards start face down. Turn over two: a pair stays up; two that
// don't match stay up until the next card is turned, so there is no rush
// to remember them (no timers).
//   level 1: 6 pairs of pictures (12 cards)
//   level 2: 8 pairs of pictures (16 cards)
//   level 3: 8 pairs of a times fact and its answer ("3 × 4" and "12")
//
// A miss is only counted when the first card's partner had been seen
// before, so the pair could have been remembered. Turning over cards that
// haven't been seen yet is looking, not missing.

import { createRandom } from '../seed.js';
import { make, button, liveMessage } from '../ui.js';

export const PAIRS = [6, 8, 8]; // pairs at each level
const pairsFor = (level = 1) => PAIRS[Math.min(Math.max(level, 1), PAIRS.length) - 1];

// The pictures a pair can be: [picture, name].
export const PICTURES = [
  ['🐸', 'frog'], ['🦆', 'duck'], ['🐢', 'turtle'], ['🐟', 'fish'], ['🦋', 'butterfly'], ['🐝', 'bee'],
  ['🐞', 'ladybug'], ['🐌', 'snail'], ['🦉', 'owl'], ['🦊', 'fox'], ['🐰', 'rabbit'], ['🐻', 'bear'],
  ['🍎', 'apple'], ['🍓', 'strawberry'], ['🌻', 'sunflower'], ['🍄', 'mushroom'], ['⭐', 'star'], ['🌈', 'rainbow'],
  ['🚀', 'rocket'], ['⛵', 'sailboat'], ['🎈', 'balloon'], ['🪁', 'kite'], ['🥁', 'drum'], ['👑', 'crown'],
];

/**
 * Make today's cards from a seed, at a level from 1 to 3. Each card is
 * { pair, face, name }: `pair` is which pair it belongs to, `face` is what
 * it shows, and `name` is how to say it.
 */
export function generate(seed, level = 1) {
  const random = createRandom(seed);
  const count = pairsFor(level);
  const cards = [];
  if (level >= 3) {
    // Times facts with different answers, so each fact has one card it matches.
    const facts = [];
    while (facts.length < count) {
      const a = random.int(2, 9);
      const b = random.int(2, 9);
      if (!facts.some((f) => f.a * f.b === a * b)) facts.push({ a, b });
    }
    facts.forEach(({ a, b }, pair) => {
      cards.push({ pair, face: `${a} × ${b}`, name: `${a} times ${b}` }, { pair, face: String(a * b), name: String(a * b) });
    });
  } else {
    random.shuffle(PICTURES).slice(0, count).forEach(([face, name], pair) => {
      cards.push({ pair, face, name }, { pair, face, name });
    });
  }
  return { level, cards: random.shuffle(cards) };
}

/**
 * The starting state: every card face down. `up` is the cards turned over
 * and not yet matched (card numbers, at most 2); `seen` is every card that
 * has been turned over at some point.
 */
export function start(puzzle) {
  return { puzzle, matched: [], up: [], seen: [], misses: 0, status: 'playing', last: null };
}

/**
 * Turn over card number `card`. Returns the new state; state.last says
 * what happened: { card, pair } where `pair` is true (a pair), false (not
 * a pair), or null (the first card of two).
 */
export function check(state, card) {
  const { cards } = state.puzzle;
  if (state.status !== 'playing') throw new Error('Every pair is found.');
  if (!cards[card] || state.matched.includes(cards[card].pair)) throw new Error(`Card ${card} can't be turned over.`);
  // Two cards that didn't match turn back down when the next card is turned.
  const up = state.up.length === 2 ? [] : state.up;
  if (up.includes(card)) throw new Error(`Card ${card} is already face up.`);
  const seen = state.seen.includes(card) ? state.seen : [...state.seen, card];
  if (up.length === 0) return { ...state, up: [card], seen, last: { card, pair: null } };

  const first = up[0];
  if (cards[first].pair === cards[card].pair) {
    const matched = [...state.matched, cards[card].pair];
    const won = matched.length === cards.length / 2;
    return { ...state, matched, up: [], seen, status: won ? 'won' : 'playing', last: { card, pair: true } };
  }
  // Not a pair. It's a miss if the first card's partner had been seen before.
  const partner = cards.findIndex((other, i) => i !== first && other.pair === cards[first].pair);
  const miss = state.seen.includes(partner) ? 1 : 0;
  return { ...state, up: [first, card], seen, misses: state.misses + miss, last: { card, pair: false } };
}

/** Confirm the cards are valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { cards, level = 1 } = puzzle;
  const count = pairsFor(level);
  if (!Array.isArray(cards) || cards.length !== count * 2) return { ok: false, problems: [`level ${level} needs ${count * 2} cards`] };
  for (let pair = 0; pair < count; pair++) {
    const two = cards.filter((card) => card.pair === pair);
    if (two.length !== 2) {
      problems.push(`pair ${pair} has ${two.length} cards`);
    } else if (level >= 3) {
      const fact = two.find((card) => card.face.includes('×'));
      const answer = two.find((card) => !card.face.includes('×'));
      const [a, b] = fact ? fact.face.split(' × ').map(Number) : [];
      if (!fact || !answer || a * b !== Number(answer.face)) problems.push(`pair ${pair} isn't a times fact and its answer`);
      if (a > 9 || b > 9) problems.push(`pair ${pair} goes past 9 × 9`);
    } else if (two[0].face !== two[1].face) {
      problems.push(`pair ${pair} doesn't match`);
    }
  }
  // No card may match a card from another pair.
  const faces = cards.map((card) => card.face);
  const repeats = level >= 3 ? 1 : 2;
  if (faces.some((face) => faces.filter((other) => other === face).length !== repeats)) problems.push('a face is used by more than one pair');
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the times a card was turned
 * over when its partner had been seen and it still wasn't found; helped is always 0.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) state = { ...state, ...session.saved };
  const keep = () => session.save?.({ matched: state.matched, seen: state.seen, misses: state.misses });
  const { cards } = puzzle;
  const pairs = cards.length / 2;

  container.replaceChildren();
  container.classList.add('mem');
  container.classList.toggle('mem-facts', puzzle.level >= 3); // numbers are written smaller than pictures
  const message = liveMessage('mem-message', 'Turn over two cards to find a pair.');
  const grid = make('div', 'mem-grid');
  const buttons = cards.map((card, i) => grid.appendChild(button('mem-card', '', () => turn(i))));
  container.append(message, grid);

  function turn(i) {
    if (state.status !== 'playing' || state.matched.includes(cards[i].pair)) return;
    if (state.up.includes(i) && state.up.length < 2) return; // already up, waiting for a second card
    state = check(state, i);
    if (state.last.pair === true) {
      const left = pairs - state.matched.length;
      message.textContent = left ? `✓ A pair! ${left} more to find.` : `You found all ${pairs} pairs!`;
      keep();
    } else if (state.last.pair === false) {
      message.textContent = 'Not a pair. Remember where they are, then turn over another card.';
      keep();
    } else {
      message.textContent = 'Now find its pair.';
    }
    draw();
    if (state.status === 'won') {
      container.classList.add('finished');
      onDone({ status: state.status, misses: state.misses, helped: 0 });
    }
  }

  function draw() {
    buttons.forEach((node, i) => {
      const matched = state.matched.includes(cards[i].pair);
      const up = matched || state.up.includes(i);
      node.textContent = up ? cards[i].face : '';
      node.className = 'mem-card' + (up ? ' mem-up' : '') + (matched ? ' mem-matched' : '');
      node.setAttribute('aria-label', `Card ${i + 1}: ${up ? cards[i].name : 'face down'}${matched ? ', matched' : ''}`);
      node.disabled = matched;
    });
  }

  draw();
}
