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
//   - results keeps how the last 10 days of each puzzle went: easy (no
//     misses, no help), ok, or hard (needed help, or 4 or more misses).
//   - levels holds each leveled puzzle's level. It goes up after 3 easy
//     days in a row and down after 2 hard days in a row, starting the next
//     day, so a puzzle never changes partway through a day.
//   - review lists things that were missed (a spelling word, a times
//     fact) so they come back: 2 days later, then 7 days after that if it
//     goes well. Miss it again and it starts over.
//   - seen lists the puzzles whose "How to play" card has been read.
//   - stickers lists the stickers collected, oldest first (src/stickers.js).
//   - plays counts how many days each game has been finished, ever (for
//     the grown-up page). The day-by-day history keeps the last 4 weeks.

export const STORAGE_KEY = 'kids-puzzles.progress';
export const KEEP_DAYS = 28; // how many days of "finished" history to keep (4 weeks)

export function emptyProgress() {
  // previous: the last day and streak before lastDay, so a caught-up day
  // can join the two runs back together.
  return { streak: 0, totalDays: 0, lastDay: null, previous: null, finished: {}, plays: {}, stickers: [], results: {}, levels: {}, review: {}, seen: [] };
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

export const RESULTS_KEPT = 10;
export const EASY_DAYS_TO_GO_UP = 3;
export const HARD_DAYS_TO_GO_DOWN = 2;

/** How a puzzle went: 'easy', 'ok', or 'hard'. */
export function rate({ misses = 0, helped = 0 } = {}) {
  if (helped > 0 || misses >= 4) return 'hard';
  return misses === 0 ? 'easy' : 'ok';
}

/**
 * A puzzle's level on `day`. A level that changed on `day` itself doesn't
 * count until the next day. `startLevel` is used until the puzzle has a
 * saved level.
 */
export function levelOf(progress, game, day, startLevel = 1) {
  const saved = progress.levels?.[game];
  if (!saved) return startLevel;
  return saved.since === day ? saved.was : saved.now;
}

/**
 * Save how `game` went on `day` ({ misses, helped }), and move its level
 * if it has more than one (`maxLevel`). Returns new progress.
 */
export function recordResult(progress, day, game, result, { maxLevel = 1, startLevel = 1 } = {}) {
  const level = progress.levels?.[game]?.now ?? startLevel;
  // `items` is how many words or facts the puzzle practiced, if it says (for the weekly look back).
  const entry = { day, score: rate(result), level, ...(result?.practiced && { items: result.practiced.length }) };
  const history = [...(progress.results?.[game] || []), entry].slice(-RESULTS_KEPT);
  const results = { ...progress.results, [game]: history };

  // The days in a row at this level, newest last.
  const here = [];
  for (let i = history.length - 1; i >= 0 && history[i].level === level; i--) here.unshift(history[i].score);
  const lastAre = (count, score) => here.length >= count && here.slice(-count).every((s) => s === score);
  let now = level;
  if (lastAre(EASY_DAYS_TO_GO_UP, 'easy') && level < maxLevel) now = level + 1;
  else if (lastAre(HARD_DAYS_TO_GO_DOWN, 'hard') && level > 1) now = level - 1;

  const levels = now === level && progress.levels?.[game]
    ? progress.levels
    : { ...progress.levels, [game]: now === level ? { now, was: level, since: null } : { now, was: level, since: day } };
  return { ...progress, results, levels };
}

export const REVIEW_GAPS = [2, 7]; // days until a missed item comes back, then comes back again
export const REVIEW_KEPT = 20;     // the most items one puzzle keeps for review

/** The items of `game` that are due to come back on day number `dayNumber`, oldest first. */
export function dueItems(progress, game, dayNumber) {
  return (progress.review?.[game] || []).filter((entry) => entry.due <= dayNumber).map((entry) => entry.item);
}

/**
 * Update a puzzle's review list after it's played. `practiced` is every
 * item in today's puzzle; `missed` is the ones that went wrong.
 *   - A missed item comes back in 2 days.
 *   - An item that was due and went well comes back once more, 7 days
 *     later; after that it's done.
 * Returns new progress.
 */
export function recordReview(progress, game, dayNumber, { practiced = [], missed = [] } = {}) {
  let list = (progress.review?.[game] || []).filter((entry) => !missed.includes(entry.item));
  list = list.flatMap((entry) => {
    if (!practiced.includes(entry.item) || entry.due > dayNumber) return [entry];
    const step = entry.step + 1;
    return step < REVIEW_GAPS.length ? [{ ...entry, step, due: dayNumber + REVIEW_GAPS[step] }] : [];
  });
  for (const item of missed) list.push({ item, step: 0, due: dayNumber + REVIEW_GAPS[0] });
  return { ...progress, review: { ...progress.review, [game]: list.slice(-REVIEW_KEPT) } };
}

/**
 * How a puzzle has gone lately, from its last 3 days: 'well' (no hard
 * days, and at least 2 easy), 'practice' (2 or more hard days), or null
 * (in between, or fewer than 2 days played).
 */
export function trend(progress, game) {
  const recent = (progress.results?.[game] || []).slice(-3).map((r) => r.score);
  if (recent.length < 2) return null;
  const count = (score) => recent.filter((s) => s === score).length;
  if (count('hard') >= 2) return 'practice';
  if (count('hard') === 0 && count('easy') >= 2) return 'well';
  return null;
}

/** The last 7 days, ending on `today`: how many puzzles were finished, on how many days. */
export function weekSummary(progress, today) {
  let puzzles = 0;
  let days = 0;
  for (const [day, games] of Object.entries(progress.finished || {})) {
    const ago = daysBetween(day, today);
    if (ago >= 0 && ago < 7 && games.length) {
      puzzles += games.length;
      days += 1;
    }
  }
  return { puzzles, days };
}

/** How many words or facts these puzzles practiced in the last 7 days, ending on `today`. */
export function itemsThisWeek(progress, today, games) {
  let items = 0;
  for (const game of games) {
    for (const entry of progress.results?.[game] || []) {
      const ago = daysBetween(entry.day, today);
      if (ago >= 0 && ago < 7) items += entry.items || 0;
    }
  }
  return items;
}

/** Remember that a puzzle's "How to play" card was read. Returns new progress. */
export function markSeen(progress, game) {
  const seen = progress.seen || [];
  return seen.includes(game) ? progress : { ...progress, seen: [...seen, game] };
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
