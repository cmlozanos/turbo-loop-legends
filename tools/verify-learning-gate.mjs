import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('public/learning-gate.js', 'utf8');
const context = { module: { exports: {} } };
vm.runInNewContext(source, context);
const core = context.module.exports.Core;
assert.equal(core.interval, 600000);
assert.equal(core.letters.length, 54);
for (let i = 0; i < 10000; i++) {
  const challenge = core.challenge();
  if (challenge.kind === 'trace') {
    assert.ok(core.glyphs[challenge.letter]);
  } else {
    for (const value of [challenge.a, challenge.b, challenge.answer]) {
      assert.ok(Number.isInteger(value) && value >= 0 && value < 10);
    }
  }
}
assert.equal(readFileSync('dist/learning-gate.js', 'utf8'), source);
assert.match(readFileSync('dist/index.html', 'utf8'), /learning-gate\.js\?v=/);
assert.match(readFileSync('dist/sw.js', 'utf8'), /learning-gate\.js/);
assert.doesNotMatch(readFileSync('src/main.ts', 'utf8'), /from ["']\.\/game\/mathGate/);
const wordsContext = {module: {exports: {}}};
vm.runInNewContext(readFileSync('public/reading-words.js', 'utf8'), wordsContext);
const words = wordsContext.module.exports;
assert.equal(words.length, 100);
const files = ['learning-profile.js', 'reading-words.js', 'READING_ASSETS.md', 'READING_WORDS.md', 'reading-images/manifest.json', ...words.map(word => 'reading-images/' + word.id + '.png')];
const worker = readFileSync('dist/sw.js', 'utf8');
const readingPrecache = [...worker.matchAll(/\{url:"(reading-images\/\d+\.png)",revision:/g)].map(match => match[1]);
assert.equal(readingPrecache.length, 100, 'exactly 100 reading PNG precache entries, without duplicate sources');
assert.equal(new Set(readingPrecache).size, 100, 'each reading image URL appears once');
for (const file of ['learning-profile.js', 'reading-words.js']) {
  assert.equal(worker.split('url:"' + file + '",revision:').length - 1, 1, file + ': exactly one precache URL');
}
for (const file of files) {
  assert.ok(readFileSync('dist/' + file).equals(readFileSync('public/' + file)), file + ': exact deployed bundle copy');
  assert.ok(worker.includes(file), file + ': present in the offline precache');
}
const html = readFileSync('dist/index.html', 'utf8');
assert.ok(html.indexOf('learning-profile.js') < html.indexOf('reading-words.js') && html.indexOf('reading-words.js') < html.indexOf('learning-gate.js'), 'deployed profile and words load before the gate');
for (let i = 0; i < 100; i++) {
  const reading = core.readingChallenge(words);
  assert.equal(reading.kind, 'reading');
  assert.equal(reading.choices.length, 3);
  assert.equal(new Set(reading.choices.map(choice => choice.id)).size, 3);
  assert.equal(reading.choices.filter(choice => choice.id === reading.answer).length, 1);
}
console.log('Learning bundle: arithmetic, 54 letters, ten minutes, profile, 100 local reading images and exact offline deployment verified.');
