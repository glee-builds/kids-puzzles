// voice.js: reading words aloud with the device's own built-in voice.
//
// Devices come with several voices, and the first one offered is often a
// flat, robotic one. pickVoice chooses the most natural English voice the
// device has. Only voices that live on the device are used, so nothing is
// sent over the internet.

// Higher-quality voices say so in their name: "Ava (Premium)", "Samantha (Enhanced)".
const QUALITY = [[/premium/i, 40], [/enhanced/i, 30], [/natural/i, 30], [/siri/i, 20]];
// Clear, friendly voices found on phones, tablets, and computers.
const GOOD_NAMES = /^(ava|samantha|allison|zoe|evan|susan|nicky|joelle|noelle|nathan|tom|karen|moira|tessa|daniel|serena|aria|jenny|michelle)\b/i;
// Novelty and old-style synthetic voices: never pick these.
const SKIP_NAMES = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|fred|good news|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|zarvox|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|eloquence)\b/i;

/** How good a voice is for reading to a child. Higher is better; below 0 means don't use it. */
export function scoreVoice(voice) {
  const name = voice.name || '';
  const lang = (voice.lang || '').replace('_', '-').toLowerCase();
  if (!lang.startsWith('en')) return -1;
  if (voice.localService === false) return -1; // an online voice: would send the words away
  if (SKIP_NAMES.test(name)) return -1;
  let score = lang === 'en-us' ? 10 : 5;
  for (const [pattern, points] of QUALITY) if (pattern.test(name) || pattern.test(voice.voiceURI || '')) score += points;
  if (GOOD_NAMES.test(name)) score += 15;
  if (/compact/i.test(voice.voiceURI || '')) score -= 5; // the small, flatter version of a voice
  return score;
}

/** The best voice in a list (from speechSynthesis.getVoices()), or null to use the device's default. */
export function pickVoice(voices) {
  let best = null;
  let bestScore = 0;
  for (const voice of voices) {
    const score = scoreVoice(voice);
    if (score > bestScore) [best, bestScore] = [voice, score];
  }
  return best;
}

/** True if this device can read aloud. */
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Read `parts` aloud one after another, with a short pause between them.
 * Each part is { text, rate }: rate 1 is normal speed, lower is slower.
 */
export function say(parts) {
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const voice = pickVoice(synth.getVoices());
    for (const { text, rate } of parts) {
      const speech = new SpeechSynthesisUtterance(text);
      speech.lang = voice ? voice.lang : 'en-US';
      if (voice) speech.voice = voice;
      speech.rate = rate;
      synth.speak(speech); // they queue up and play in order
    }
  } catch { /* no voice on this device: the sentence on screen still helps */ }
}

// Some browsers load their list of voices a moment after the page opens.
// Asking early means the list is ready by the first "Hear it".
if (canSpeak()) window.speechSynthesis.getVoices();
