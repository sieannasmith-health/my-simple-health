import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/msh-health-story-dimensions.js', import.meta.url), 'utf8');

function loadClassifier() {
  const context = { globalThis: {} };
  context.globalThis.globalThis = context.globalThis;
  vm.createContext(context.globalThis);
  vm.runInContext(source, context.globalThis);
  return context.globalThis.MSHHealthStoryDimensions;
}

test('classifies a birthday as Social', () => {
  const classifier = loadClassifier();
  const result = classifier.classify({
    title: "Mom’s Birthday 🎉",
    summary: "Mom’s Birthday 🎉",
    sourceType: 'calendar_event'
  });

  assert.equal(result.primary.id, 'social');
  assert.equal(result.primary.label, 'Social');
  assert.ok(result.confidence >= 0.9);
});

test('classifies a Pilates workout as Physical', () => {
  const classifier = loadClassifier();
  const result = classifier.classify({
    title: '25 MIN TOTAL CORE/AB WORKOUT || At-Home Pilates (No Equipment)',
    summary: '25 MIN TOTAL CORE/AB WORKOUT || At-Home Pilates (No Equipment)',
    sourceType: 'calendar_event'
  });

  assert.equal(result.primary.id, 'physical');
  assert.equal(result.primary.label, 'Physical');
  assert.ok(result.confidence >= 0.95);
});

test('explicit dimension metadata wins over inferred text', () => {
  const classifier = loadClassifier();
  const result = classifier.classify({
    title: 'Birthday workout with family',
    wellnessDimension: 'what_matters'
  });

  assert.equal(result.primary.id, 'what_matters');
  assert.equal(result.source, 'explicit');
  assert.equal(result.confidence, 1);
});

test('unknown entries fall back to Whole Life instead of inventing a specific dimension', () => {
  const classifier = loadClassifier();
  const result = classifier.classify({
    title: 'Something I want to remember',
    summary: 'A personal moment with no structured category.'
  });

  assert.equal(result.primary.id, 'whole_life');
  assert.equal(result.primary.label, 'Whole Life');
  assert.equal(result.confidence, 0.40);
});

test('enrichment preserves source and provenance while adding dimension metadata', () => {
  const classifier = loadClassifier();
  const contribution = {
    id: 'derived:calendar:birthday-1',
    title: "Mom’s Birthday 🎉",
    sourceType: 'calendar_event',
    provenance: { status: 'USER_STATED', sourceId: 'birthday-1' }
  };

  const enriched = classifier.enrichContribution(contribution);

  assert.equal(enriched.sourceType, 'calendar_event');
  assert.deepEqual(enriched.provenance, contribution.provenance);
  assert.equal(enriched.wellnessDimension.id, 'social');
  assert.equal(enriched.dimensionClassification.source, 'inferred');
});
