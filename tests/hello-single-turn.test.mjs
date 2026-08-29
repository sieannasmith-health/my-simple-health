import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import handler from '../api/hello.js';
import { parseHelloIntelligenceOutput, validateHelloActivityResponse } from '../api/helloActivityContract.js';
import { sanitizeActivityContext } from '../api/sanitizeJourneyContext.js';

const guardSource = await readFile(new URL('../js/msh-guided-reflection.js', import.meta.url), 'utf8');
const helloSource = await readFile(new URL('../hello.html', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../api/hello.js', import.meta.url), 'utf8');
const sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.runInNewContext(guardSource, sandbox, { filename:'msh-guided-reflection.js' });

function activity(overrides = {}) {
  return sanitizeActivityContext({
    page:'hello', activity:'guided_reflection', dimension:'Environment', construct:'desiredChange',
    questionId:'desiredChange', questionText:'What would you like to be different?',
    nextQuestionId:'whyMatters', nextQuestionText:'Why would that change matter to you?',
    priorActivityAnswers:{ whatWorks:'My current home works for us now.' },
    allowedDispositions:['ANSWER', 'CONVERSATION'], directlyAnsweredCurrentStep:true,
    interactionState:'answer', ...overrides
  });
}

function modelResult(value) {
  return parseHelloIntelligenceOutput(JSON.stringify(value));
}

function responseRecorder() {
  const result = { statusCode:200, body:null };
  return {
    result,
    setHeader() {},
    status(code) { result.statusCode = code; return this; },
    json(value) { result.body = value; return this; },
    end() { return this; }
  };
}

async function runEndpoint(output, context) {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  globalThis.fetch = async () => ({ ok:true, status:200, async json() { return { output_text:JSON.stringify(output) }; } });
  try {
    const response = responseRecorder();
    await handler({ method:'POST', body:{
      message:'More room would make daily life easier for us.', assistantRole:'HELLO',
      conversation:[], journeyContext:null, activityContext:context
    } }, response);
    return response.result;
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
}

test('direct answer produces one Hello message with a natural next step and deterministic advancement', () => {
  const result = validateHelloActivityResponse(modelResult({
    message:'More room would make it easier for our family to grow. What would that change make possible for you?',
    disposition:'ANSWER', activity_step_status:'ADVANCE', next_step:{ id:'whyMatters' }, knowledge_event:null
  }), activity(), 'HELLO');
  assert.equal(result.activityStepStatus, 'ADVANCE');
  assert.deepEqual(result.nextStep, { id:'whyMatters' });
  assert.equal((result.message.match(/What would that change make possible for you\?/g) || []).length, 1);
});

test('the endpoint returns one unified Hello activity response object', async () => {
  const result = await runEndpoint({
    message:'That gives the change a practical shape. Why would it matter to you?',
    disposition:'ANSWER', activity_step_status:'ADVANCE',
    next_step:{ id:'whyMatters' }, knowledge_event:null
  }, activity());
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.message, 'That gives the change a practical shape. Why would it matter to you?');
  assert.equal(result.body.disposition, 'ANSWER');
  assert.equal(result.body.activity_step_status, 'ADVANCE');
  assert.deepEqual(result.body.next_step, { id:'whyMatters' });
  assert.equal(result.body.knowledge_event, null);
});

test('uncertainty produces one simplified response without advancement', () => {
  const classification = sandbox.MSHGuidedReflection.classify("I'm not sure what that means.", 'desiredChange');
  const signals = sandbox.MSHGuidedReflection.activitySignals(classification);
  const result = validateHelloActivityResponse(modelResult({
    message:'It is asking what, if anything, you would want to be different about this part of your life.',
    disposition:'ANSWER', activity_step_status:'ADVANCE', next_step:{ id:'whyMatters' }, knowledge_event:null
  }), activity(signals), 'HELLO');
  assert.equal(classification.kind, 'uncertainty');
  assert.equal(result.disposition, 'CONVERSATION');
  assert.equal(result.activityStepStatus, 'PRESERVE');
  assert.equal(result.nextStep, null);
});

test('detour produces one conversational response and preserves activity', () => {
  const classification = sandbox.MSHGuidedReflection.classify("Let's talk about something else.", 'desiredChange');
  const signals = sandbox.MSHGuidedReflection.activitySignals(classification);
  const result = validateHelloActivityResponse(modelResult({
    message:'Of course. What is on your mind?', disposition:'CONVERSATION',
    activity_step_status:'PRESERVE', next_step:null, knowledge_event:null
  }), activity(signals), 'HELLO');
  assert.equal(classification.kind, 'detour');
  assert.equal(result.activityStepStatus, 'PRESERVE');
  assert.equal(result.nextStep, null);
});

test('return to activity produces one natural continuation without advancing', () => {
  const classification = sandbox.MSHGuidedReflection.classify('Can we return to my reflection?', 'desiredChange');
  const signals = sandbox.MSHGuidedReflection.activitySignals(classification);
  const result = validateHelloActivityResponse(modelResult({
    message:'We can pick up where you left off. What would you like to be different?', disposition:'RETURN',
    activity_step_status:'PRESERVE', next_step:null, knowledge_event:null
  }), activity(signals), 'HELLO');
  assert.equal(classification.kind, 'return');
  assert.equal(result.disposition, 'RETURN');
  assert.equal(result.activityStepStatus, 'PRESERVE');
});

test('confirmed inference can produce one provenance-safe learning event without another prompt', () => {
  const result = validateHelloActivityResponse(modelResult({
    message:'You confirmed that this is about preparing for the future, not being unhappy with your home now.',
    disposition:'CONVERSATION', activity_step_status:'PRESERVE', next_step:null,
    knowledge_event:{ type:'USER_CONFIRMED_LEARNING', statement:'This is about preparing for the future, not current dissatisfaction.', source_inference_id:'inference_housing_1' }
  }), activity({ directlyAnsweredCurrentStep:false, confirmationOccurred:true }), 'HELLO');
  assert.equal(result.knowledgeEvent.provenance, 'USER_CONFIRMED');
  assert.equal(result.knowledgeEvent.sourceInferenceId, 'inference_housing_1');
  assert.equal(result.nextStep, null);
});

test('an unconfirmed model inference cannot become a learning event', () => {
  const result = validateHelloActivityResponse(modelResult({
    message:'One possibility is that stability matters here. Does that fit?', disposition:'CONVERSATION',
    activity_step_status:'PRESERVE', next_step:null,
    knowledge_event:{ type:'USER_CONFIRMED_LEARNING', statement:'Stability matters.' }
  }), activity({ directlyAnsweredCurrentStep:false, confirmationOccurred:false }), 'HELLO');
  assert.equal(result.knowledgeEvent, null);
});

test('the browser has no second hidden prompt generator or canonical-question appender', () => {
  assert.match(helloSource, /renderHelloResponse\(data, data\.message\)/);
  assert.doesNotMatch(helloSource, /combineAssistantTurn|continuation|askGuidedQuestion/);
  assert.doesNotMatch(guardSource, /combineAssistantTurn/);
  assert.match(serverSource, /The browser will not append, regenerate, or repeat that question/);
});

test('activity context supplies state, construct, prior answers, constraints, and direct-answer status', () => {
  const context = activity();
  assert.equal(context.activity, 'guided_reflection');
  assert.equal(context.questionId, 'desiredChange');
  assert.equal(context.construct, 'desiredChange');
  assert.equal(context.priorActivityAnswers.whatWorks, 'My current home works for us now.');
  assert.deepEqual(context.allowedDispositions, ['ANSWER', 'CONVERSATION']);
  assert.equal(context.directlyAnsweredCurrentStep, true);
});

test('Pal and a non-answer cannot accidentally advance an activity', () => {
  const proposed = modelResult({
    message:'What happened?', disposition:'ANSWER', activity_step_status:'ADVANCE',
    next_step:{ id:'whyMatters' }, knowledge_event:null
  });
  assert.equal(validateHelloActivityResponse(proposed, activity(), 'PAL').activityStepStatus, 'PRESERVE');
  assert.equal(validateHelloActivityResponse(proposed, activity({ directlyAnsweredCurrentStep:false }), 'HELLO').activityStepStatus, 'PRESERVE');
});
