import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/msh-guided-reflection.js', import.meta.url), 'utf8');
const helloSource = await readFile(new URL('../hello.html', import.meta.url), 'utf8');
const sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename:'msh-guided-reflection.js' });
const {
  OBJECTIVE_PRIORITY,
  classify,
  loadingText,
  selectGuidedResumeObjective
} = sandbox.MSHGuidedReflection;

function reflectionWith(status = 'unresolved') {
  return {
    activeObjective: 'currentSuccesses',
    objectives: Object.fromEntries(OBJECTIVE_PRIORITY.map(key => [key, {
      status,
      summary: '',
      updatedAtTurn: 0
    }]))
  };
}

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

test('deferred readiness is skipped when Guided resumes after a mode switch', () => {
  const reflection = reflectionWith('complete');
  reflection.objectives.motivationMeaning.status = 'unresolved';
  reflection.objectives.readiness = {
    status: 'deferred',
    summary: 'The person is uncertain about changing stress-related spending.',
    updatedAtTurn: 2
  };
  reflection.activeObjective = 'readiness';

  assert.equal(selectGuidedResumeObjective(reflection), 'motivationMeaning');
  assert.equal(reflection.objectives.readiness.status, 'deferred');
});

test('completed objectives are skipped when Guided resumes', () => {
  assert.deepEqual(Array.from(OBJECTIVE_PRIORITY), [
    'goals',
    'currentSuccesses',
    'motivationMeaning',
    'previousAttempts',
    'barriers',
    'strengthsResources',
    'preferences',
    'environmentAccess',
    'socialContext',
    'emotionalContext',
    'perceivedBenefits',
    'readiness',
    'confidence',
    'optionsNextSteps'
  ]);
  const reflection = reflectionWith('unresolved');
  reflection.objectives.goals.status = 'complete';
  reflection.activeObjective = 'goals';

  assert.equal(selectGuidedResumeObjective(reflection), 'currentSuccesses');
});

test('partial objectives resume only when no unresolved objective is more useful', () => {
  const reflection = reflectionWith('complete');
  reflection.objectives.motivationMeaning.status = 'unresolved';
  reflection.objectives.strengthsResources = {
    status: 'partial',
    summary: 'The person is unsure which strengths are available.',
    updatedAtTurn: 2
  };
  reflection.activeObjective = 'strengthsResources';

  assert.equal(selectGuidedResumeObjective(reflection), 'motivationMeaning');

  reflection.objectives.motivationMeaning.status = 'complete';
  assert.equal(selectGuidedResumeObjective(reflection), 'strengthsResources');
});

test('an unresolved active objective may still resume', () => {
  const reflection = reflectionWith('unresolved');
  reflection.activeObjective = 'barriers';

  assert.equal(selectGuidedResumeObjective(reflection), 'barriers');
});

test('Guided uses neutral loading language while Ask keeps its evidence loading copy', () => {
  assert.equal(loadingText('guided'), 'Thinking with you...');
  assert.equal(loadingText('ask'), 'Reviewing the evidence');
  assert.match(helloSource, /loadingMode:\s*"guided"/);
  assert.match(helloSource, /requestOptions\.loadingMode \|\| "ask"/);
});
