// Tests for src/voice.js. Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVoice, scoreVoice } from '../src/voice.js';

const voice = (name, lang = 'en-US', extra = {}) => ({ name, lang, localService: true, voiceURI: name, ...extra });

test('a premium or enhanced voice beats the plain one', () => {
  const voices = [voice('Samantha'), voice('Fred'), voice('Ava (Premium)'), voice('Samantha (Enhanced)')];
  assert.equal(pickVoice(voices).name, 'Ava (Premium)');
  assert.equal(pickVoice(voices.slice(0, 2)).name, 'Samantha');
});

test('novelty and old robotic voices are never picked', () => {
  for (const name of ['Fred', 'Zarvox', 'Bad News', 'Eddy (English (US))', 'Grandma (English (US))', 'Trinoids']) {
    assert.ok(scoreVoice(voice(name)) < 0, name);
  }
  assert.equal(pickVoice([voice('Fred'), voice('Zarvox')]), null); // nothing good: use the device default
});

test('only English voices that live on the device are used', () => {
  assert.ok(scoreVoice(voice('Amelie', 'fr-FR')) < 0);
  assert.ok(scoreVoice(voice('Online English', 'en-US', { localService: false })) < 0); // would send words over the internet
  assert.ok(scoreVoice(voice('Daniel', 'en-GB')) > 0);
  assert.ok(scoreVoice(voice('Samantha', 'en_US')) > 0); // some devices write the language with _
});

test('US English is preferred over other English, and the compact version of a voice loses to the full one', () => {
  assert.equal(pickVoice([voice('Daniel', 'en-GB'), voice('Samantha', 'en-US')]).name, 'Samantha');
  const compact = voice('Samantha', 'en-US', { voiceURI: 'com.apple.voice.compact.en-US.Samantha' });
  const full = voice('Samantha', 'en-US', { voiceURI: 'com.apple.voice.enhanced.en-US.Samantha' });
  assert.equal(pickVoice([compact, full]), full);
});

test('no voices at all gives null', () => {
  assert.equal(pickVoice([]), null);
});
