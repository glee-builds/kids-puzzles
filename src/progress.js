// progress.js: the streak and which puzzles are finished, saved on the phone.
//
// Everything is stored in the browser's localStorage on this phone only.
// Nothing is sent anywhere, and there are no accounts.
//
// Rules:
//   - A day counts toward the streak when at least one puzzle is finished.
//   - Finishing again on the same day does not count twice.
//   - Playing on the very next day adds one. Missing a day starts over at 1.
//   - Catching up: yesterday's puzzles can be played the next day. Finishing
//     one fills in the missed day, so the days in a row join back up.
//   - Finishing counts whether the word was found or shown: no penalties.
//   - totalDays counts every day with a finished puzzle, ever. It never goes
//     down, so the frog on the lily pads never hops backward.
//   - stickers lists the stickers collected, oldest first (src/stickers.js).
//   - plays counts how many days each game has been finished, ever (for
//     the grown-up page). The day-by-day history keeps the last 4 weeks.

export const STORAGE_KEY = 'kids-puzzles.progress';
export const KEEP_DAYS = 28; // how many days of "finished" history to keep (4 weeks)

export function emptyProgress() {
  // previous: the last day and streak before lastDay, so a caught-up day
  // can join the two runs back together.
  return { streak: 0, totalDays: 0, lastDay: null, previous: null, finished: {}, plays: {}, stickers: [] };
}

/** Whole days from one "YYYY-MM-DD" to another (b minus a). */
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Record that `game` was finished on `day`. Returns new progress. */
export function recordFinish(progress, day, game) {
  let { streak, totalDays, lastDay, previous = null } = progress;
  if (day !== lastDay && !(progress.finished[day] || []).length) {
    // A new puzzle day: the frog hops.
    totalDays += 1;
    if (!lastDay || day > lastDay) {
      // The usual case: a day after the last one.
      previous = lastDay ? { day: lastDay, streak } : null;
      streak = lastDay && daysBetween(lastDay, day) === 1 ? streak + 1 : 1;
      lastDay = day;
    } else if (daysBetween(day, lastDay) === 1) {
      // Catching up on the day just before the last one. It joins the last
      // day (2 days in a row), plus the run before it if that ended the day
      // before.
      const joins = previous && daysBetween(previous.day, day) === 1;
      streak = joins ? previous.streak + 2 : 2;
    }
  }

  const finished = {};
  for (const [d, games] of Object.entries(progress.finished)) {
    if (daysBetween(d, lastDay) < KEEP_DAYS) finished[d] = games;
  }
  const dayGames = finished[day] || [];
  const isNew = !dayGames.includes(game);
  finished[day] = isNew ? [...dayGames, game] : dayGames;
  const plays = { ...progress.plays };
  if (isNew) plays[game] = (plays[game] || 0) + 1;

  return { ...progress, streak, totalDays, lastDay, previous, finished, plays };
}

/**
 * The streak to show today. It still counts if the last finished day was
 * today or yesterday (today's puzzle isn't done yet). Otherwise it's 0.
 */
export function currentStreak(progress, today) {
  if (!progress.lastDay) return 0;
  const gap = daysBetween(progress.lastDay, today);
  return gap === 0 || gap === 1 ? progress.streak : 0;
}

/** Add a sticker (by id) to the collection. Returns new progress. */
export function addSticker(progress, id) {
  const stickers = progress.stickers || [];
  return stickers.includes(id) ? progress : { ...progress, stickers: [...stickers, id] };
}

/** Whether `game` was finished on `day`. Without a game: whether any was. */
export function isFinished(progress, day, game) {
  const games = progress.finished[day] || [];
  return game ? games.includes(game) : games.length > 0;
}

/** How many days each game appears in a day-by-day history. */
function countPlays(finished) {
  const plays = {};
  for (const games of Object.values(finished)) for (const game of games) plays[game] = (plays[game] || 0) + 1;
  return plays;
}

/** Read saved progress. Anything missing or damaged starts fresh. */
export function load(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (saved && typeof saved.streak === 'number' && typeof saved.finished === 'object') {
      // Saved before totalDays existed: start from the days in the history.
      const totalDays = typeof saved.totalDays === 'number' ? saved.totalDays : Object.keys(saved.finished).length;
      // Saved before plays existed: count them from the days in the history.
      const plays = saved.plays && typeof saved.plays === 'object' ? saved.plays : countPlays(saved.finished);
      return { ...emptyProgress(), ...saved, totalDays, plays };
    }
  } catch {
    // Private browsing or damaged data: start fresh.
  }
  return emptyProgress();
}

export function save(progress, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable (for example in private browsing). The
    // game still works; progress just isn't kept.
  }
}
