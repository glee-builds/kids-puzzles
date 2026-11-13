// times.js: which times facts the multiplication puzzles (Bug Groups and
// Garden Rows) use, and how they grow.
//
// The group sizes follow the usual school order, moving on as the player
// keeps playing that puzzle:
//   stage 1: 2s, 5s, and 10s (easy to count by)
//   stage 2: adds 3s and 4s
//   stage 3: 3s, 4s, and 6s to 9s (the harder facts)

export const STAGES = [
  { from: 0, sizes: [2, 5, 10], name: '2s, 5s, and 10s' },
  { from: 7, sizes: [2, 3, 4, 5, 10], name: '2s, 3s, 4s, 5s, and 10s' },
  { from: 14, sizes: [3, 4, 6, 7, 8, 9], name: '3s, 4s, and 6s to 9s' },
];

/** The stage (0, 1, or 2) after `plays` days of playing a puzzle. */
export function stageFor(plays = 0) {
  let stage = 0;
  STAGES.forEach((s, i) => { if (plays >= s.from) stage = i; });
  return stage;
}

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
