import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/hello.js';
import {
  HELLO_VOICE_AND_HUMANIZATION_CONTRACT_V1,
  evaluateHelloVoice,
  refineHelloConversationalSurface
} from '../server/hello/helloVoiceContract.js';

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

async function runWithMockModel({ message, outputText, assistantRole = 'HELLO' }) {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  let requestBody;
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok:true, status:200, async json() { return { output_text:outputText }; } };
  };
  try {
    const response = responseRecorder();
    await handler({
      method:'POST',
      body:{ message, assistantRole, conversation:[], journeyContext:null, activityContext:null }
    }, response);
    return { response:response.result.body, requestBody };
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
}

test('the dedicated contract defines the required voice priorities and boundaries', () => {
  assert.match(HELLO_VOICE_AND_HUMANIZATION_CONTRACT_V1, /Accuracy → Safety → Provenance → User autonomy → Relevance → Clarity → Naturalness → Warmth → Brevity/);
  assert.match(HELLO_VOICE_AND_HUMANIZATION_CONTRACT_V1, /warm, calm, attentive, grounded, curious, intelligent, and conversational/);
  assert.match(HELLO_VOICE_AND_HUMANIZATION_CONTRACT_V1, /Prefer active, direct language/);
  assert.match(HELLO_VOICE_AND_HUMANIZATION_CONTRACT_V1, /Do not restate the person's entire message/);
  assert.match(HELLO_VOICE_AND_HUMANIZATION_CONTRACT_V1, /Do not end every response with a question/);
  assert.match(HELLO_VOICE_AND_HUMANIZATION_CONTRACT_V1, /one to three short paragraphs/);
  assert.match(HELLO_VOICE_AND_HUMANIZATION_CONTRACT_V1, /Naturalness never outranks epistemic precision/);
});

test('Hello receives the voice contract while Pal retains its separate role contract', async () => {
  const hello = await runWithMockModel({
    message:'Tell me what you notice.',
    outputText:'ACTIVITY_DISPOSITION: CONVERSATION\n\nI see one possibility.'
  });
  assert.match(hello.requestBody.instructions, /HELLO VOICE AND HUMANIZATION CONTRACT V1/);

  const pal = await runWithMockModel({
    message:'Today was irritating.',
    assistantRole:'PAL',
    outputText:'ACTIVITY_DISPOSITION: CONVERSATION\n\nWhat happened?'
  });
  assert.doesNotMatch(pal.requestBody.instructions, /HELLO VOICE AND HUMANIZATION CONTRACT V1/);
  assert.match(pal.requestBody.instructions, /You are Pal: Talk It Through/);
});

test('natural personal-context synthesis is concise and epistemically precise', () => {
  const response = "You've said that having more space matters to you. I wonder whether homeownership represents stability for you as much as more space does. Does that fit?";
  assert.deepEqual(evaluateHelloVoice(response), []);
  assert.match(response, /You've said/);
  assert.match(response, /I wonder whether/);
});

test('varied conversational openings do not require a robotic acknowledgment template', () => {
  const responses = [
    'That helps clarify the practical constraint.',
    "You've returned to housing and financial stability several times.",
    'One possibility is that the schedule change matters more than the workload.'
  ];
  assert.equal(new Set(responses.map(value => value.split(/\s+/)[0])).size, 3);
  for (const response of responses) assert.deepEqual(evaluateHelloVoice(response), []);
});

test('the evaluator catches passive voice, robotic acknowledgment, therapy-speak, and excessive validation', () => {
  assert.ok(evaluateHelloVoice('Environment was selected.').includes('passive_voice'));
  assert.ok(evaluateHelloVoice('Thank you for providing that information.').includes('robotic_acknowledgment'));
  assert.ok(evaluateHelloVoice('I can hold space for you.').includes('therapy_speak'));
  assert.ok(evaluateHelloVoice('You are amazing and everything you feel is completely valid.').includes('excessive_validation'));
  assert.deepEqual(evaluateHelloVoice('You chose Environment.'), []);
});

test('the evaluator catches unnecessary repetition, questions, disclaimers, and unsolicited reflection writing', () => {
  const userMessage = 'My schedule is changing tomorrow when my program begins.';
  assert.ok(evaluateHelloVoice(`You said: ${userMessage}`, { userMessage }).includes('repeated_user_message'));
  assert.ok(evaluateHelloVoice('That is saved. Does that fit?', { questionNeeded:false }).includes('unnecessary_question'));
  assert.ok(evaluateHelloVoice('This is not a diagnosis, but your answer is saved.').includes('unnecessary_disclaimer'));
  assert.ok(evaluateHelloVoice('You could write: I want more room.').includes('unsolicited_writing'));
  assert.deepEqual(evaluateHelloVoice('You confirmed that this is about preparing for the future.', { questionNeeded:false }), []);
});

test('plain prose is the default and requested lists remain valid', () => {
  assert.ok(evaluateHelloVoice('- First idea\n- Second idea').includes('unrequested_structure'));
  assert.deepEqual(evaluateHelloVoice('- First idea\n- Second idea', { structuredRequested:true }), []);
  assert.deepEqual(evaluateHelloVoice('The first option protects your current routine. The second creates more flexibility.'), []);
});

test('natural first-person capability language does not simulate human experience', () => {
  assert.deepEqual(evaluateHelloVoice("I can help you explore that. I'm not sure those things are connected yet."), []);
  assert.ok(evaluateHelloVoice('I know exactly how you feel because I went through that in my own life.').includes('human_pretence'));
});

test('Hello removes unmistakably robotic opening filler at the runtime surface', async () => {
  assert.equal(
    refineHelloConversationalSurface('Thank you for providing that information. You chose Environment.'),
    'You chose Environment.'
  );
  const result = await runWithMockModel({
    message:'I chose Environment.',
    outputText:'ACTIVITY_DISPOSITION: CONVERSATION\n\nThank you for providing that information. You chose Environment.'
  });
  assert.equal(result.response.response, 'You chose Environment.');
  assert.equal(result.response.activityDisposition, 'CONVERSATION');
});

test('internal provenance labels and multiple conversational moves remain violations', () => {
  assert.ok(evaluateHelloVoice('USER_STATED: You chose Environment.').includes('internal_label'));
  assert.ok(evaluateHelloVoice('What matters here? What would you try next?').includes('multiple_questions'));
});
