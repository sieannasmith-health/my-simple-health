import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import handler from '../api/hello.js';

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

test('Hello conversation history stays bounded inside shared MSH storage memory', async () => {
  const source = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');
  const values = new Map();
  const sandbox = { localStorage:{ getItem:key=>values.get(key)||null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) }, sessionStorage:{ removeItem(){} }, crypto:{ randomUUID:()=>String(Math.random()) }, Date, Math };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  for (let index=0; index<20; index += 1) sandbox.MSHStorage.appendHelloTurn(index % 2 ? 'assistant' : 'user', `turn ${index}`);
  const history = sandbox.MSHStorage.getHelloConversation();
  assert.equal(history.length, sandbox.MSHStorage.HELLO_HISTORY_LIMIT);
  assert.equal(history.at(-1).content, 'turn 19');
  assert.ok(sandbox.MSHStorage.getState().settings.memory.helloConversation);
});

test('shared conversation history preserves which intelligence role authored assistant turns', async () => {
  const source = await readFile(new URL('../js/msh-storage.js', import.meta.url), 'utf8');
  const values = new Map();
  const sandbox = { localStorage:{ getItem:key=>values.get(key)||null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) }, sessionStorage:{ removeItem(){} }, crypto:{ randomUUID:()=>String(Math.random()) }, Date, Math };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  sandbox.MSHStorage.appendHelloTurn('user', 'Today irritated me.');
  sandbox.MSHStorage.appendHelloTurn('assistant', 'That sounds like a day.', 'PAL');
  sandbox.MSHStorage.appendHelloTurn('assistant', 'I can help explain that.', 'HELLO');
  const history = sandbox.MSHStorage.getHelloConversation();
  assert.equal(history[1].assistantRole, 'PAL');
  assert.equal(history[2].assistantRole, 'HELLO');
  assert.equal(history[0].assistantRole, undefined);
});

test('existing Hello endpoint sends history and activity context to the model and parses disposition', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  let providerRequest;
  globalThis.fetch = async (url, options) => {
    providerRequest = { url, body:JSON.parse(options.body) };
    return { ok:true, status:200, async json(){ return { output_text:'ACTIVITY_DISPOSITION: CONVERSATION\n\nI am here with you. The reflection can stay where it is.' }; } };
  };
  try {
    const response = responseRecorder();
    await handler({ method:'POST', body:{ message:'hey how are you?', conversation:[{role:'user',content:'Earlier turn'},{role:'assistant',content:'Earlier response'}], journeyContext:null, activityContext:{page:'hello',activity:'guided_reflection',questionId:'barriers',questionText:'What might get in the way?',currentResponse:null} } }, response);
    assert.equal(response.result.statusCode, 200);
    assert.equal(response.result.body.activityDisposition, 'CONVERSATION');
    assert.equal(response.result.body.response, 'I am here with you. The reflection can stay where it is.');
    assert.equal(providerRequest.url, 'https://api.openai.com/v1/responses');
    assert.match(providerRequest.body.input, /Earlier turn/);
    assert.match(providerRequest.body.input, /What might get in the way\?/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('Pal uses the shared model path without invoking evidence retrieval', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body:JSON.parse(options.body) });
    return { ok:true, status:200, async json(){ return { output_text:'ACTIVITY_DISPOSITION: CONVERSATION\n\nThat sounds irritating. What happened?' }; } };
  };
  try {
    const response = responseRecorder();
    await handler({ method:'POST', body:{ message:'Today irritated me so bad 😂', assistantRole:'PAL', conversation:[], journeyContext:null, activityContext:null } }, response);
    assert.equal(response.result.statusCode, 200);
    assert.equal(response.result.body.assistantRole, 'PAL');
    assert.deepEqual(response.result.body.capabilitiesUsed, []);
    assert.equal(requests.length, 1);
    assert.match(requests[0].body.instructions, /You are Pal: Talk It Through/);
    assert.match(requests[0].body.instructions, /CORE PHILOSOPHY — SELF-INTELLIGENCE, AGENCY, DOMINION/);
    assert.match(requests[0].body.instructions, /DATA → INFORMATION → UNDERSTANDING → SELF-INTELLIGENCE/);
    assert.match(requests[0].body.instructions, /DESCRIBING WHAT IS KNOWN ABOUT THE PERSON/);
    assert.doesNotMatch(requests[0].body.instructions, /You are Hello: Understand & Navigate/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('Hello explains a simple concept without automatically invoking evidence', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body:JSON.parse(options.body) });
    return { ok:true, status:200, async json(){ return { output_text:'ACTIVITY_DISPOSITION: CONVERSATION\n\nEpidemiology studies patterns of health in groups of people.' }; } };
  };
  try {
    const response = responseRecorder();
    await handler({ method:'POST', body:{ message:'What does epidemiology mean?', assistantRole:'HELLO', conversation:[], journeyContext:null, activityContext:null } }, response);
    assert.equal(response.result.statusCode, 200);
    assert.equal(response.result.body.assistantRole, 'HELLO');
    assert.deepEqual(response.result.body.capabilitiesUsed, []);
    assert.equal(requests.length, 1);
    assert.match(requests[0].body.instructions, /You are Hello: Understand & Navigate/);
    assert.match(requests[0].body.instructions, /CORE PHILOSOPHY — SELF-INTELLIGENCE, AGENCY, DOMINION/);
    assert.match(requests[0].body.instructions, /Science informs the person; it does not define the person/);
    assert.match(requests[0].body.instructions, /I don't have additional confirmed My Health information available here\./);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('switching Pal to Hello retains labelled recent conversation through the shared history', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  let providerRequest;
  globalThis.fetch = async (url, options) => {
    providerRequest = { url, body:JSON.parse(options.body) };
    return { ok:true, status:200, async json(){ return { output_text:'ACTIVITY_DISPOSITION: CONVERSATION\n\nI remember you said the day felt irritating.' }; } };
  };
  try {
    const response = responseRecorder();
    await handler({ method:'POST', body:{ message:'Hello, can you help me make sense of that?', assistantRole:'HELLO', conversation:[{role:'user',content:'Today irritated me so bad 😂'},{role:'assistant',assistantRole:'PAL',content:'That sounds like a lot. Want to talk through what happened?'}], journeyContext:null, activityContext:null } }, response);
    assert.match(providerRequest.body.input, /PAL: That sounds like a lot/);
    assert.match(providerRequest.body.input, /USER: Today irritated me so bad/);
    assert.equal(response.result.body.assistantRole, 'HELLO');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('local runtime and secret boundaries are explicit', async () => {
  const [server, example, ignore, client] = await Promise.all([
    readFile(new URL('../dev-server.js', import.meta.url), 'utf8'),
    readFile(new URL('../.env.example', import.meta.url), 'utf8'),
    readFile(new URL('../.gitignore', import.meta.url), 'utf8'),
    readFile(new URL('../hello.html', import.meta.url), 'utf8')
  ]);
  assert.match(server, /helloHandler/);
  assert.match(server, /OPENAI_API_KEY detected/);
  assert.match(example, /^OPENAI_API_KEY=/m);
  assert.match(ignore, /^\.env\.\*/m);
  assert.doesNotMatch(client, /OPENAI_API_KEY/);
});

test('Hello instructions establish conversational entry without a capability menu', async () => {
  const source = await readFile(new URL('../api/hello.js', import.meta.url), 'utf8');
  assert.match(source, /CONVERSATIONAL ENTRY — DO NOT PRESENT A MENU/);
  assert.match(source, /never needs a goal, Project, assessment result, problem/);
  assert.match(source, /If they just want to talk, allow that/);
  assert.match(source, /If they do not want a goal, accept that boundary without persuasion/);
  assert.match(source, /explicitly asks for a comprehensive list or overview[\s\S]*concise capability overview is appropriate/);
  assert.match(source, /Do not prematurely push the person toward a Project, goal, Practice/);
  assert.doesNotMatch(source, /message\.includes\(["']what can you help me with/i);
});

test('Hello instructions preserve self-understanding, agency, and provenance', async () => {
  const source = await readFile(new URL('../api/hello.js', import.meta.url), 'utf8');
  assert.match(source, /SELF-UNDERSTANDING WITHOUT IDENTITY CLAIMS/);
  assert.match(source, /It does not\s+define them/);
  assert.match(source, /USER_STATED, SYSTEM_OBSERVED,\s+MODEL_INFERRED, and USER_CONFIRMED/);
  assert.match(source, /Never silently\s+convert an inference into a fact/);
  assert.match(source, /Do not sound like a feature list, marketing page, or formal health\s+coach by default/);
  assert.match(source, /Avoid reflexive openings such as "Absolutely!"/);
});

test('Hello instructions prioritize and directly use relevant current activity context', async () => {
  const source = await readFile(new URL('../api/hello.js', import.meta.url), 'utf8');
  assert.match(source, /CONTEXT-GROUNDED RESPONSES/);
  assert.match(source, /1\. current user message[\s\S]*2\. immediate conversation history[\s\S]*3\. current activity or page[\s\S]*4\. relevant My Health information[\s\S]*5\. scientific evidence/);
  assert.match(source, /Do not ask them to paste, describe, or identify a screen that the supplied\s+activity context already identifies/);
  assert.match(source, /explain that actual activity/);
  assert.match(source, /current screen is SYSTEM_OBSERVED display context/);
  assert.match(source, /Explaining an activity does not answer it/);
  assert.doesNotMatch(source, /message\.includes\(["']help me understand what i['’]m looking at/i);
});

test('intelligence architecture shares one backend while keeping role and capability contracts separate', async () => {
  const [server, client] = await Promise.all([
    readFile(new URL('../api/hello.js', import.meta.url), 'utf8'),
    readFile(new URL('../hello.html', import.meta.url), 'utf8')
  ]);
  assert.match(server, /SHARED_INTELLIGENCE_INSTRUCTIONS/);
  assert.match(server, /HELLO_ROLE_INSTRUCTIONS/);
  assert.match(server, /PAL_ROLE_INSTRUCTIONS/);
  assert.match(server, /shouldInvokeEvidenceCapability/);
  assert.match(server, /normalizeAssistantRole\(assistantRole\) !== "HELLO"/);
  assert.doesNotMatch(server, /const factualHealthPatterns/);
  assert.match(server, /Never silently convert an inference/);
  assert.equal((server.match(/https:\/\/api\.openai\.com\/v1\/responses/g) || []).length, 1);
  assert.match(client, /assistantRole: currentIntelligenceRole/);
  assert.match(client, /MSHIntelligenceRoles/);
});

test('runtime philosophy requires agency, wise non-action, calibrated evidence, and growing independence', async () => {
  const server = await readFile(new URL('../api/hello.js', import.meta.url), 'utf8');
  assert.match(server, /The person is the primary agent in their own life/);
  assert.match(server, /Do not assume that every difficulty should be fixed, every low score should improve, every insight should become a goal, or every pattern requires intervention/);
  assert.match(server, /choosing not to act, accepting a constraint, changing direction, releasing a goal/);
  assert.match(server, /Do not replace every answer with a question/);
  assert.match(server, /Population evidence describes observations across groups\. It does not automatically determine what is true for one individual/);
  assert.match(server, /Personal data can reveal signals and patterns without establishing meaning or causation/);
  assert.match(server, /The goal is not for Hello or Pal to become indispensable/);
  assert.match(server, /return `\$\{SHARED_INTELLIGENCE_INSTRUCTIONS\}\\n\\n\$\{/);
});

test('runtime knowledge-description contract filters relevance and preserves source boundaries', async () => {
  const server = await readFile(new URL('../api/hello.js', import.meta.url), 'utf8');
  assert.match(server, /apply relevance filtering before provenance categorization/);
  assert.match(server, /Do not list trivial, incidental, or unrelated facts/);
  assert.match(server, /apply relevance filtering before provenance categorization/);
  assert.match(server, /Never say that another fact is confirmed but irrelevant/);
  assert.match(server, /what appears only in the current conversation/);
  assert.match(server, /confirmed My Health context/);
  assert.match(server, /system observations, including current screen or activity context/);
  assert.match(server, /tentative model inference/);
  assert.match(server, /Absence of additional context in the current request is not proof that the broader system stores nothing/);
  assert.match(server, /"I don't have additional confirmed My Health information available here\."/);
  assert.match(server, /Whenever a response includes a model inference, it must also explicitly ask whether that inference fits the person's experience/);
});
