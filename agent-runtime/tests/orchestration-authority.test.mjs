import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const bridge = await fs.readFile(new URL('../langgraph-worker-bridge.mjs', import.meta.url), 'utf8');

assert.match(
  bridge,
  /MSH_ORCHESTRATION_OWNER:\s*'langgraph'/,
  'LangGraph bridge must mark child worker execution as LangGraph-owned.'
);

assert.match(
  bridge,
  /process\.env\.MSH_ORCHESTRATION_OWNER === 'langgraph'/,
  'Worker write suppression must be conditioned on explicit LangGraph ownership.'
);

assert.match(
  bridge,
  /url\.startsWith\(issuePrefix\) && isWrite/,
  'LangGraph-owned worker must suppress GitHub issue orchestration writes.'
);

assert.match(
  bridge,
  /url === repositoryLabels && isWrite/,
  'LangGraph-owned worker must suppress repository label mutation used by orchestration.'
);

assert.match(
  bridge,
  /return realFetch\(input, init\)/,
  'Non-orchestration calls must continue through the real fetch implementation.'
);

assert.doesNotMatch(
  bridge,
  /url\.startsWith\([^\n]*\/pulls[^\n]*\) && isWrite/,
  'Bounded implementation PR creation must not be suppressed by the LangGraph authority guard.'
);

console.log('Single-orchestrator regression contract passed.');
