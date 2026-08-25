import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import handler from '../api/hello.js';
import { sanitizeJourneyContext } from '../api/sanitizeJourneyContext.js';

const rendererSource = await readFile(new URL('../js/msh-conversation-renderer.js', import.meta.url), 'utf8');
const helloSource = await readFile(new URL('../hello.html', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../api/hello.js', import.meta.url), 'utf8');
const sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(rendererSource, sandbox, { filename:'msh-conversation-renderer.js' });
const renderer = sandbox.MSHConversationRenderer;

function responseRecorder() {
  const result = { statusCode:200, headers:{}, body:null };
  return {
    result,
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.statusCode = code; return this; },
    json(value) { result.body = value; return this; },
    end() { return this; }
  };
}

async function withMockModel(message, outputText) {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  globalThis.fetch = async () => ({ ok:true, status:200, async json() { return { output_text:outputText }; } });
  try {
    const response = responseRecorder();
    await handler({ method:'POST', body:{ message, assistantRole:'HELLO', conversation:[], journeyContext:null, activityContext:null } }, response);
    return response.result.body;
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
}

test('escaped Markdown is normalized and represented as formatting instead of visible artifacts', () => {
  const normalized = renderer.normalizeText('\\*\\*This matters\\*\\*');
  assert.equal(normalized, '**This matters**');
  assert.deepEqual(Array.from(renderer.inlineSegments(normalized), segment => ({ ...segment })), [
    { type:'strong', text:'This matters' }
  ]);
  assert.doesNotMatch(normalized, /\\\*/);
});

test('escaped punctuation and newlines render normally', () => {
  const normalized = renderer.normalizeText('Hello\\, there\\!\r\n\r\nHow are you\\?');
  assert.equal(normalized, 'Hello, there!\n\nHow are you?');
  assert.deepEqual(Array.from(renderer.blocks(normalized), block => ({ ...block })), [
    { type:'paragraph', text:'Hello, there!' },
    { type:'paragraph', text:'How are you?' }
  ]);
});

test('normal knowledge conversation is converted from an inventory into prose', async () => {
  const result = await withMockModel(
    'What do you know about me?',
    'ACTIVITY_DISPOSITION: CONVERSATION\n\n- You are in school\n- You chose Environment\n- One reflection is active'
  );
  assert.doesNotMatch(result.response, /^[-*]\s/m);
  assert.match(result.response, /You are in school\. You chose Environment\. One reflection is active\./);
});

test('lists remain available when the person explicitly requests one', async () => {
  const result = await withMockModel(
    'Give me five ideas in a list.',
    'ACTIVITY_DISPOSITION: CONVERSATION\n\n- First idea\n- Second idea\n- Third idea'
  );
  assert.match(result.response, /^[-*]\s/m);
  assert.equal(renderer.blocks(result.response)[0].type, 'list');
});

test('internal provenance labels are naturalized while categories remain intact in context', async () => {
  const result = await withMockModel(
    'What do you know about me?',
    'ACTIVITY_DISPOSITION: CONVERSATION\n\nUSER_STATED: You said school is demanding. MODEL_INFERENCE: It may be a transition.'
  );
  assert.doesNotMatch(result.response, /USER_STATED|MODEL_INFERENCE/);
  assert.match(result.response, /From what you shared/);
  assert.match(result.response, /One possible interpretation/);

  const context = sanitizeJourneyContext({
    contractVersion:2,
    currentPosition:{ key:'reflection', label:'Reflection', reason:'Active reflection.' },
    contextItems:[{ epistemicStatus:'USER_STATED', source:'assessment.response', text:'environment fit: mixed' }],
    possibilities:[{ epistemicStatus:'MODEL_INFERRED', source:'journey-position', text:'One possibility is that context matters.', requiresConfirmation:true }]
  });
  assert.equal(context.contextItems[0].knowledgeCategory, 'ASSESSMENT_RESPONSE');
  assert.equal(context.possibilities[0].knowledgeCategory, 'MODEL_INFERENCE');
  assert.equal(context.possibilities[0].requiresConfirmation, true);
});

test('assistant rendering is safe DOM construction and normal turns remain one bubble', () => {
  assert.match(helloSource, /MSHConversationRenderer\.render\(textElement, text\)/);
  assert.match(rendererSource, /createTextNode/);
  assert.doesNotMatch(rendererSource, /innerHTML\s*=/);
  assert.match(helloSource, /renderHelloResponse\(data, data\.message\)/);
  assert.doesNotMatch(helloSource, /combineAssistantTurn|combinedResponse/);
  assert.doesNotMatch(helloSource, /setTimeout\(\s*askGuidedQuestion/);
});

test('runtime contract defaults to synthesis and allows requested lists', () => {
  assert.match(serverSource, /CONVERSATIONAL PRESENTATION/);
  assert.match(serverSource, /Default to one concise conversational message/);
  assert.match(serverSource, /Never print those category names in ordinary conversation/);
  assert.match(serverSource, /synthesize the smallest relevant set of information into coherent prose/);
  assert.match(serverSource, /Use a list only when the person explicitly asks for a list/);
});
