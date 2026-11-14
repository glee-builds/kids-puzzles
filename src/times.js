// times.js: which times facts the multiplication puzzles (Bug Groups and
// Garden Rows) use at each level.
//
// The group sizes follow the usual school order. Each puzzle moves up a
// level after 3 easy days in a row (see src/progress.js):
//   level 1: 2s, 5s, and 10s (easy to count by)
//   level 2: adds 3s and 4s
//   level 3: 3s, 4s, and 6s to 9s (the harder facts)

export const STAGES = [
  { sizes: [2, 5, 10], name: '2s, 5s, and 10s' },
  { sizes: [2, 3, 4, 5, 10], name: '2s, 3s, 4s, 5s, and 10s' },
  { sizes: [3, 4, 6, 7, 8, 9], name: '3s, 4s, and 6s to 9s' },
];

/** The stage (0, 1, or 2) for a level (1, 2, or 3). */
export const stageFor = (level = 1) => Math.min(Math.max(level, 1), STAGES.length) - 1;

/**
 * Three answers to choose from: the right one plus two near misses, in
 * order from smallest to largest. `misses` are the near misses to try first
 * (for example "one group too many"); any that aren't usable are skipped.
 */
export function choicesFor(answer, misses) {
  const picked = [answer];
  for (const n of [...misses, answer + 1, answer + 2, answer - 1]) {
    if (picked.length === 3) break;
    if (n > 0 && !picked.includes(n)) picked.push(n);
  }
  return picked.sort((a, b) => a - b);
}

/** A times fact as saved for review: "4x3" means 4 groups of 3. */
export const factKey = (groups, size) => `${groups}x${size}`;

/** Read a saved fact back: "4x3" gives { groups: 4, size: 3 }. */
export function parseFact(text) {
  const [groups, size] = String(text).split('x').map(Number);
  return { groups, size };
}
