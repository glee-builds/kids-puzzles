// seed.js: turn today's date into repeatable "random" numbers.
//
// Every phone that opens the app on the same day gets the same puzzles,
// without a server. It works like this:
//   1. The date becomes text, like "2026-11-08".
//   2. That text (plus the game's name) becomes a number: the seed.
//   3. The seed starts a random number generator that always produces
//      the same sequence of numbers for the same seed.

/**
 * The date as "YYYY-MM-DD", using the phone's own time zone, so a new
 * day starts at local midnight.
 */
export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Turn any text into a whole number (the FNV-1a hash).
 * The same text always gives the same number; similar texts give very
 * different numbers.
 */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The seed for one game on one day, for example
 * seedFor('2026-11-08', 'word-guess'). Each game gets its own seed, so
 * adding a new game never changes another game's puzzles.
 */
export function seedFor(key, gameName) {
  return hashString(`${key}:${gameName}`);
}

/**
 * A random number generator (the "mulberry32" method) that always gives
 * the same sequence of numbers for the same seed.
 */
export function createRandom(seed) {
  let state = seed >>> 0;

  // A number from 0 up to (but not including) 1.
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,

    // A whole number from min to max, including both.
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },

    // One item from a list.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },

    // A shuffled copy of a list. The original list is not changed.
    shuffle(list) {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
