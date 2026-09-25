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
console.log('Learning gate: arithmetic ranges, 54 letters, ten minutes and offline assets verified.');
