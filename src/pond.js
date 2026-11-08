// pond.js: which lily pads to show on the home screen.
//
// Pad 0 is the bank where the frog starts. Each day with a finished puzzle,
// the frog hops one pad further. The pond shows 7 pads at a time: from the
// start while the frog is near it, then sliding along so the frog always
// has a few pads behind it and the next pad ahead.

export const PADS_SHOWN = 7;
const BEHIND = 4; // pads kept in view behind the frog once it's far along

/**
 * The pads to draw for a frog on pad `at` (its total puzzle days).
 * Returns [{ number, kind }] where kind is 'bank', 'visited', 'frog',
 * 'next', or 'ahead'. `doneToday` says whether today's hop already happened
 * (if not, the pad after the frog is marked 'next').
 */
export function pondPads(at, doneToday) {
  const first = Math.max(0, at - BEHIND);
  return Array.from({ length: PADS_SHOWN }, (_, i) => {
    const number = first + i;
    let kind = 'ahead';
    if (number === at) kind = 'frog';
    else if (number === 0) kind = 'bank';
    else if (number < at) kind = 'visited';
    else if (number === at + 1 && !doneToday) kind = 'next';
    return { number, kind };
  });
}
