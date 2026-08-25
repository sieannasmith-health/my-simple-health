import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/msh-guided-reflection.js', import.meta.url), 'utf8');
const sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename:'msh-guided-reflection.js' });
const { classify } = sandbox.MSHGuidedReflection;

test('ordinary conversation never advances guided reflection', () => {
  for (const value of ['hey how are you', 'Hello!', 'what do you mean?', 'can you clarify this', "I'm not sure", 'let’s change the topic', 'pause this']) {
    assert.equal(classify(value, 'whyMatters').advances, false, value);
  }
});

test('a direct reflection answer can advance', () => {
  assert.deepEqual({ ...classify('It would give me more energy for my family.', 'whyMatters') }, { kind:'answer', advances:true });
});

test('confidence only accepts a whole number from 1 to 10', () => {
  assert.equal(classify('7', 'confidence').advances, true);
  for (const value of ['0', '11', '7.5', 'not sure', 'how should I answer?']) {
    assert.equal(classify(value, 'confidence').advances, false, value);
  }
});
