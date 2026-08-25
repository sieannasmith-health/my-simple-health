import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import {
  buildJourneyPromptContext,
  sanitizeJourneyContext
} from '../api/sanitizeJourneyContext.js';

const source = await readFile(new URL('../js/msh-intelligence.js', import.meta.url), 'utf8');
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'msh-intelligence.js' });
const intelligence = sandbox.MSHIntelligence;

function baseState(overrides = {}) {
  return {
    schemaVersion: 1,
    landscapes: [],
    focuses: [],
    visionEntries: [],
    projects: [],
    practices: [],
    practiceAttempts: [],
    reflections: [],
    learningEntries: [],
    progressEvents: [],
    settings: { reminders: {}, memory: {} },
    ...overrides
  };
}

const now = '2026-08-23T12:00:00.000Z';

test('recognizes an empty journey without inventing context', () => {
  const context = intelligence.buildHelloContext(baseState());
  assert.equal(context.currentPosition.key, 'current_picture');
  assert.equal(context.contextItems.length, 0);
  assert.match(context.possibilities[0].text, /^One possibility is/);
  assert.equal(context.possibilities[0].requiresConfirmation, true);
});

test('recognizes each position in the journey in order', () => {
  const project = { id: 'project_stage', status: 'active', title: 'A chosen direction', pointA: 'Now', pointB: 'Desired', createdAt: now };
  const practice = { id: 'practice_stage', projectId: 'project_stage', status: 'active', title: 'A small experiment', description: 'Try it', createdAt: now };
  const attempt = { id: 'attempt_stage', projectId: 'project_stage', practiceId: 'practice_stage', outcome: 'partly', createdAt: now };
  const reflection = { id: 'reflection_stage', projectId: 'project_stage', practiceId: 'practice_stage', statement: 'This was easier earlier in the day.', nextStep: 'keep', createdAt: now };
  const learning = { id: 'learning_stage', projectId: 'project_stage', practiceId: 'practice_stage', statement: 'Earlier tends to fit better.', confidence: 'noticing', currentStatus: 'current', createdAt: now };

  const states = [
    ['current_picture', baseState()],
    ['desired_direction', baseState({ landscapes: [{ id: 'landscape_stage', status: 'completed', completedAt: now }] })],
    ['chosen_project', baseState({ visionEntries: [{ id: 'vision_stage', status: 'current', synthesis: { statement: 'More room for rest', confirmationStatus: 'confirmed' }, createdAt: now }] })],
    ['practice_experience', baseState({ projects: [project] })],
    ['reflection', baseState({ projects: [project], practices: [practice], practiceAttempts: [attempt], progressEvents: [{ id: 'progress_attempt', projectId: 'project_stage', progressType: 'engagement', createdAt: now }] })],
    ['learning', baseState({ projects: [project], practices: [practice], practiceAttempts: [attempt], reflections: [reflection] })],
    ['progress', baseState({ projects: [project], practices: [practice], practiceAttempts: [attempt], reflections: [reflection], learningEntries: [learning] })],
    ['next_decision', baseState({ projects: [project], practices: [practice], practiceAttempts: [attempt], reflections: [{ ...reflection, nextStep: 'modify' }], learningEntries: [learning] })]
  ];

  for (const [expected, state] of states) {
    assert.equal(intelligence.recognizeJourneyPosition(state).key, expected);
  }
});

test('does not prescribe a Project from a Landscape observation', () => {
  const state = baseState({
    landscapes: [{ id: 'landscape_1', status: 'completed', completedAt: now, domainSummaries: [{ domainId: 'physical', state: 'Worth noticing' }] }]
  });
  const context = intelligence.buildHelloContext(state);
  assert.equal(context.currentPosition.key, 'desired_direction');
  assert.ok(context.contextItems.some(item => item.source === 'landscape.completed' && item.epistemicStatus === 'SYSTEM_OBSERVED'));
  assert.ok(!context.contextItems.some(item => item.source.startsWith('project.')));
  assert.doesNotMatch(context.possibilities[0].text, /start|create|prescribe.*Project/i);
});

test('respects all six navigation choices', () => {
  for (const [choice, label, expectedText] of [
    ['preserve', 'Preserve', 'protect what is already working'],
    ['explore', 'Explore', 'stay curious'],
    ['develop', 'Develop', 'clarify what you want'],
    ['adapt', 'Adapt', 'clarify what you want'],
    ['prepare', 'Save for Later', 'Save for Later'],
    ['no_action', 'Leave It Alone', 'Leave It Alone']
  ]) {
    const state = baseState({
      focuses: [{ id: `focus_${choice}`, status: 'active', label: 'Rest', navigationState: choice, createdAt: now }]
    });
    const brief = intelligence.getHelloBrief(state);
    assert.equal(brief.position.navigationLabel, label);
    if (choice === 'prepare' || choice === 'no_action') {
      assert.match(brief.message, new RegExp(expectedText, 'i'));
      assert.equal(brief.context.possibilities.length, 0);
      assert.equal(brief.position.key, 'next_decision');
    } else {
      assert.match(brief.message, new RegExp(expectedText, 'i'));
      assert.equal(brief.context.possibilities.length, 1);
    }
  }
});

test('recognizes a completed Project as a next decision instead of a compliance failure', () => {
  const state = baseState({
    projects: [{ id: 'project_done', status: 'completed', title: 'Experiment with a calmer morning', pointA: 'Rushed', pointB: 'More settled', createdAt: now, updatedAt: now }],
    progressEvents: [{ id: 'progress_done', projectId: 'project_done', progressType: 'project_completed', statement: 'Project completed', createdAt: now }]
  });
  const context = intelligence.buildHelloContext(state);
  assert.equal(context.currentPosition.key, 'next_decision');
  assert.equal(context.currentPosition.epistemicStatus, 'SYSTEM_OBSERVED');
  assert.ok(context.contextItems.some(item => item.source === 'project.status' && /not a judgment/i.test(item.text)));
});

test('treats capacity as user-stated planning context, never worth or compliance', () => {
  const state = baseState({
    projects: [{ id: 'project_1', status: 'active', title: 'More restorative evenings', pointA: 'Evenings feel crowded', pointB: 'More room to wind down', capacity: 'very_limited', createdAt: now }]
  });
  const item = intelligence.buildContextItems(state).find(entry => entry.source === 'project.capacity');
  assert.equal(item.epistemicStatus, 'USER_STATED');
  assert.match(item.text, /planning context/i);
  assert.match(item.text, /not a score or measure of worth/i);
});

test('connects Practice history, reflection, learning, and progress without changing their epistemic status', () => {
  const state = baseState({
    projects: [{ id: 'project_1', status: 'active', title: 'Protect lunch', pointA: 'Lunch gets skipped', pointB: 'A reliable pause', createdAt: now }],
    practices: [{ id: 'practice_1', projectId: 'project_1', status: 'active', title: 'Block 15 minutes', description: 'Try a protected pause', createdAt: now }],
    practiceAttempts: [{ id: 'attempt_1', projectId: 'project_1', practiceId: 'practice_1', outcome: 'changed', note: 'Ten minutes fit better on clinic days.', createdAt: now }],
    reflections: [{ id: 'reflection_1', projectId: 'project_1', practiceId: 'practice_1', statement: 'Shorter pauses fit better on busy days.', nextStep: 'modify', createdAt: now }],
    learningEntries: [{ id: 'learning_1', projectId: 'project_1', practiceId: 'practice_1', statement: 'A flexible window works better than a fixed time.', confidence: 'confirmed', currentStatus: 'current', createdAt: now, updatedAt: now }],
    progressEvents: [{ id: 'progress_1', projectId: 'project_1', progressType: 'learning', statement: 'Learned from the shorter pause.', createdAt: now }]
  });
  const context = intelligence.buildHelloContext(state);
  const brief = intelligence.getHelloBrief(state);
  assert.equal(context.currentPosition.key, 'next_decision');
  assert.ok(context.contextItems.some(item => item.source === 'practice.history' && item.epistemicStatus === 'SYSTEM_OBSERVED'));
  assert.ok(context.contextItems.some(item => item.source === 'reflection.statement' && item.epistemicStatus === 'USER_STATED'));
  assert.ok(context.contextItems.some(item => item.source === 'learning.statement' && item.epistemicStatus === 'USER_STATED'));
  assert.match(brief.message, /Your recent Practice history shows/);
  assert.match(brief.message, /You reflected that/);
  assert.match(brief.message, /One possibility is/);
  assert.match(brief.message, /Does that fit your experience\?/);
});

test('does not infer sensitive identity from recorded text', () => {
  const state = baseState({
    reflections: [{ id: 'reflection_sensitive', projectId: 'project_1', statement: 'I described a sensitive part of my own experience.', createdAt: now }]
  });
  const context = intelligence.buildHelloContext(state);
  assert.ok(context.contextItems.every(item => item.epistemicStatus !== 'MODEL_INFERRED'));
  assert.ok(context.possibilities.every(item => item.source === 'journey-position' && item.requiresConfirmation));
});

test('server sanitizer discards unlabelled, unknown, and asserted inferences', () => {
  const raw = intelligence.buildHelloContext(baseState());
  raw.contextItems.push({ epistemicStatus: 'SYSTEM_OBSERVED', source: 'identity.guess', text: 'Guessed identity' });
  raw.possibilities.push({ epistemicStatus: 'MODEL_INFERRED', source: 'journey-position', text: 'The person is unmotivated.', requiresConfirmation: false });
  const sanitized = sanitizeJourneyContext(raw);
  assert.ok(sanitized);
  assert.ok(!sanitized.contextItems.some(item => item.source === 'identity.guess'));
  assert.ok(!sanitized.possibilities.some(item => /unmotivated/i.test(item.text)));
  assert.doesNotMatch(buildJourneyPromptContext(raw), /Guessed identity|unmotivated/);
});

test('exposes assessment responses, confirmed Vision, and future Return points from My Health', () => {
  const context = intelligence.buildHelloContext(baseState({
    landscapes: [{ id:'landscape_context', status:'completed', completedAt:now, responses:[{ construct:'sleep_quality', label:'Mixed', context:'Work nights are different.', answeredAt:now }] }],
    wellnessWheel: { current:{ id:'wheel_context', scores:{ physical:7 }, completedAt:now }, history:[] },
    visionEntries: [{ id:'vision_context', status:'current', synthesis:{ statement:'More room for rest.', confirmationStatus:'confirmed', confirmedAt:now }, createdAt:now }],
    returnPoints: [{ id:'return_context', status:'open', note:'Revisit this after the busy season.', createdAt:now }]
  }));
  assert.ok(context.contextItems.some(item => item.source === 'assessment.response' && item.epistemicStatus === 'USER_STATED'));
  assert.ok(context.contextItems.some(item => item.source === 'assessment.wellnessWheel.physical' && item.epistemicStatus === 'USER_STATED'));
  assert.ok(context.contextItems.some(item => item.source === 'vision.synthesis' && item.epistemicStatus === 'USER_CONFIRMED'));
  assert.ok(context.contextItems.some(item => item.source === 'returnPoint.choice' && item.epistemicStatus === 'USER_STATED'));
});
