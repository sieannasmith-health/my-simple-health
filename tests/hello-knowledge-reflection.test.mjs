import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import handler from '../api/hello.js';
import { sanitizeJourneyContext } from '../api/sanitizeJourneyContext.js';

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

async function withMockModel(outputText, body) {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  let providerRequest;
  globalThis.fetch = async (url, options) => {
    providerRequest = { url, body:JSON.parse(options.body) };
    return { ok:true, status:200, async json() { return { output_text:outputText }; } };
  };
  try {
    const response = responseRecorder();
    await handler({ method:'POST', body }, response);
    return { response:response.result, providerRequest };
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
}

const activityContext = {
  page:'hello', activity:'guided_reflection', questionId:'whyMatters',
  questionText:'Why would that change matter to you?', currentResponse:null,
  contextId:'fictional-housing', contextLabel:'Fictional housing reflection'
};

test('Hello cannot answer or advance an unanswered meaning reflection from practical context', async () => {
  const { response } = await withMockModel(
    'ACTIVITY_DISPOSITION: ANSWER\n\nThat change would matter because more space would help your family.\n\nYou could write: “More space would give us stability.”',
    { message:'A 1bd/1ba is only enough for our family of 3 me my spouse and our dog.', assistantRole:'HELLO', conversation:[], journeyContext:null, activityContext }
  );
  assert.equal(response.body.activityDisposition, 'CONVERSATION');
  assert.doesNotMatch(response.body.response, /You could write/i);
  assert.doesNotMatch(response.body.response, /would matter because/i);
  assert.doesNotMatch(response.body.response, /What would that change make possible for you\?/);
  assert.equal(response.body.activity_step_status, 'PRESERVE');
  assert.equal(response.body.next_step, null);
});

test('reflection drafting language is allowed only after explicit wording help', async () => {
  const output = 'ACTIVITY_DISPOSITION: CONVERSATION\n\nYou could write: “Having more room would support the future we want.”';
  const withoutPermission = await withMockModel(output, {
    message:'A 1bd/1ba is only enough right now.', assistantRole:'HELLO', conversation:[], journeyContext:null, activityContext
  });
  assert.doesNotMatch(withoutPermission.response.body.response, /You could write/i);

  const withPermission = await withMockModel(output, {
    message:'Can you help me word my answer?', assistantRole:'HELLO', conversation:[], journeyContext:null, activityContext
  });
  assert.match(withPermission.response.body.response, /You could write/i);
});

test('knowledge candidates retain distinct participant-facing provenance categories', () => {
  const context = sanitizeJourneyContext({
    contractVersion:2,
    currentPosition:{ key:'reflection', label:'Reflection', reason:'An activity is active.' },
    contextItems:[
      { epistemicStatus:'USER_STATED', source:'reflection.statement', text:'More room would help.', requiresConfirmation:false },
      { epistemicStatus:'USER_STATED', source:'focus.choice', text:'The person chose Environment.' },
      { epistemicStatus:'USER_STATED', source:'assessment.response', text:'space fit: mixed' },
      { epistemicStatus:'SYSTEM_OBSERVED', source:'progress.history', text:'One event is recorded.' },
      { epistemicStatus:'USER_CONFIRMED', source:'learning.statement', text:'Future fit matters more than current dissatisfaction.' }
    ],
    possibilities:[
      { epistemicStatus:'MODEL_INFERRED', source:'journey-position', text:'One possibility is that future fit matters more than present dissatisfaction.', requiresConfirmation:true }
    ]
  });
  assert.deepEqual(context.contextItems.map(item => item.knowledgeCategory), [
    'USER_STATED', 'USER_CHOSEN', 'ASSESSMENT_RESPONSE', 'SYSTEM_OBSERVATION', 'USER_CONFIRMED_LEARNING'
  ]);
  assert.equal(context.possibilities[0].knowledgeCategory, 'MODEL_INFERENCE');
});

test('unsupported inference is omitted and a retained tentative inference requires confirmation', () => {
  const context = sanitizeJourneyContext({
    contractVersion:2,
    currentPosition:{ key:'reflection', label:'Reflection', reason:'An activity is active.' },
    contextItems:[],
    possibilities:[
      { epistemicStatus:'MODEL_INFERRED', source:'journey-position', text:'The person values independence.', requiresConfirmation:false },
      { epistemicStatus:'MODEL_INFERRED', source:'journey-position', text:'One possibility is that future fit matters more than current dissatisfaction.', requiresConfirmation:true }
    ]
  });
  assert.equal(context.possibilities.length, 1);
  assert.equal(context.possibilities[0].requiresConfirmation, true);
  assert.equal(context.possibilities[0].confirmationPrompt, 'Does that fit your experience?');
});

test('guided reflection guard preserves conversation and clarification but accepts a direct answer', async () => {
  const source = await readFile(new URL('../js/msh-guided-reflection.js', import.meta.url), 'utf8');
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename:'msh-guided-reflection.js' });
  const classify = sandbox.MSHGuidedReflection.classify;
  assert.equal(classify('hey how are you', 'whyMatters').advances, false);
  assert.equal(classify('What do you mean?', 'whyMatters').advances, false);
  assert.equal(classify('A 1bd/1ba is only enough right now.', 'whyMatters').advances, false);
  assert.equal(classify('It would give us room to grow and feel more stable.', 'whyMatters').advances, true);
});

test('runtime contract requires provenance separation and conservative inference', async () => {
  const source = await readFile(new URL('../api/hello.js', import.meta.url), 'utf8');
  assert.match(source, /KNOWLEDGE AND REFLECTION INTEGRITY/);
  assert.match(source, /USER_CHOSEN: explicit choices recorded in My Health/);
  assert.match(source, /ASSESSMENT_RESPONSE: measurement-worthy self-report responses/);
  assert.match(source, /Do not flatten these categories into one list/);
  assert.match(source, /Do not add an inference merely to make a summary sound insightful/);
  assert.match(source, /Never answer it on the person's behalf/);
});
