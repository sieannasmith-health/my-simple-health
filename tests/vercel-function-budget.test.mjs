import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const MAX_HOBBY_FUNCTIONS = 12;

function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectJavaScriptFiles(path));
    else if (['.js', '.mjs', '.cjs', '.ts'].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

test('Vercel Hobby deployment stays within the serverless function limit', () => {
  const functions = collectJavaScriptFiles('api');
  assert.ok(
    functions.length <= MAX_HOBBY_FUNCTIONS,
    `Vercel Hobby supports at most ${MAX_HOBBY_FUNCTIONS} serverless functions; api/ currently contains ${functions.length}:\n${functions.join('\n')}`
  );
});
