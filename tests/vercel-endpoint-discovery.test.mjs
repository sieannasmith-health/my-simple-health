import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const apiDirectory = new URL('../api/', import.meta.url);
const serverDirectory = new URL('../server/hello/', import.meta.url);
const endpointFiles = (await readdir(apiDirectory))
  .filter(name => name.endsWith('.js'))
  .sort();

test('Vercel discovers only the existing HTTP endpoint contracts', async () => {
  assert.deepEqual(endpointFiles, [
    'hello.js',
    'pubmed-test.js',
    'synthesis-test.js'
  ]);
  assert.ok(endpointFiles.length <= 12, 'Hobby deployments must stay within the 12-function limit');

  for (const name of endpointFiles) {
    const source = await readFile(new URL(name, apiDirectory), 'utf8');
    assert.match(source, /export default async function handler\s*\(/, `${name} must remain an HTTP handler`);
  }
});

test('shared Hello implementation modules remain outside endpoint discovery', async () => {
  const helperFiles = (await readdir(serverDirectory))
    .filter(name => name.endsWith('.js'))
    .sort();

  assert.deepEqual(helperFiles, [
    'buildResearchQuery.js',
    'evidence.js',
    'helloActivityContract.js',
    'helloTools.js',
    'helloVoiceContract.js',
    'pubmed.js',
    'rankEvidence.js',
    'retrieveEvidence.js',
    'sanitizeJourneyContext.js',
    'synthesizeEvidence.js'
  ]);
});
